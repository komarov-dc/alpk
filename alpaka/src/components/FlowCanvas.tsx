'use client';

import { useCallback, useRef, useEffect, useState, memo } from 'react';
import { useThrottledCallback } from '@/utils/performance';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '@/store/useFlowStore';
import { selectSelectedNodes, selectCanUndo, selectCanRedo } from '@/store/selectors';
import { useKeyboardShortcuts, isMac } from '@/hooks/useKeyboardShortcuts';
import { useUniversalContextMenu } from '@/hooks/useUniversalContextMenu';

import { HierarchicalContextMenu } from './ui/HierarchicalContextMenu';
import { ZoomIndicator } from './ui/ZoomIndicator';
import { UndoRedoIndicator } from './ui/UndoRedoIndicator';
import { FitViewButton } from './ui/FitViewButton';
import NodeErrorBoundary from './NodeErrorBoundary';
import ClientErrorBoundary from './ClientErrorBoundary';
import { getPerformanceSettings } from '@/config/performance';

import { NoteNode } from './nodes/NoteNode';
import { ModelProviderNode } from './nodes/ModelProviderNode';
import { BasicLLMChainNode } from './nodes/BasicLLMChainNode';
import { TriggerNode } from './nodes/TriggerNode';
import { OutputSenderNode } from './nodes/OutputSenderNode';

// HOC to wrap nodes with error boundaries
interface NodeProps {
  id: string;
  data: unknown;
  selected?: boolean;
}

const withErrorBoundary = <T extends NodeProps>(Component: React.ComponentType<T>, nodeType: string) => {
  const WrappedComponent = (props: T) => (
    <NodeErrorBoundary nodeId={props.id} nodeType={nodeType}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
  WrappedComponent.displayName = `withErrorBoundary(${nodeType})`;
  return WrappedComponent;
};

// CRITICAL: nodeTypes MUST be created once and reused to prevent recreation on every render
// This was causing the freeze with 2500+ nodes!
const STABLE_NODE_TYPES = {
  note: withErrorBoundary(NoteNode, 'note'),
  modelProvider: withErrorBoundary(ModelProviderNode, 'modelProvider'),
  basicLLMChain: withErrorBoundary(BasicLLMChainNode, 'basicLLMChain'),
  trigger: withErrorBoundary(TriggerNode, 'trigger'),
  outputSender: withErrorBoundary(OutputSenderNode, 'outputSender')
};

const FlowCanvasInner = memo(() => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Use selectors for frequently changing state
  const nodes = useFlowStore(state => state.nodes);
  const edges = useFlowStore(state => state.edges);
  const selectedNodes = useFlowStore(selectSelectedNodes);
  const canUndo = useFlowStore(selectCanUndo);
  const canRedo = useFlowStore(selectCanRedo);
  const clipboard = useFlowStore(state => state.clipboard);
  const cursorMode = useFlowStore(state => state.cursorMode);
  const storedViewport = useFlowStore(state => state.viewport);
  const setStoredViewport = useFlowStore(state => state.setViewport);

  // Simple viewport update in store (without auto-save to DB)
  const handleViewportChange = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      setStoredViewport(viewport);
    },
    [setStoredViewport]
  );

  // Functions that don't change often
  const onNodesChange = useFlowStore(state => state.onNodesChange);
  const onEdgesChange = useFlowStore(state => state.onEdgesChange);
  const onConnect = useFlowStore(state => state.onConnect);
  const setSelectedNodes = useFlowStore(state => state.setSelectedNodes);
  const duplicateNodes = useFlowStore(state => state.duplicateNodes);
  const copyNodes = useFlowStore(state => state.copyNodes);
  const pasteNodes = useFlowStore(state => state.pasteNodes);
  const deleteSelectedNodes = useFlowStore(state => state.deleteSelectedNodes);
  const selectAllNodes = useFlowStore(state => state.selectAllNodes);
  const addNodeAtPosition = useFlowStore(state => state.addNodeAtPosition);
  const undo = useFlowStore(state => state.undo);
  const redo = useFlowStore(state => state.redo);
  const saveHistory = useFlowStore(state => state.saveHistory);

  // State for middle mouse button panning
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [hasInitialFitView, setHasInitialFitView] = useState(false);

  const { screenToFlowPosition, setViewport, getViewport, fitView } = useReactFlow();

  // Track last applied viewport to prevent unnecessary updates
  const lastAppliedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // Restore viewport when project loads
  useEffect(() => {
    if (storedViewport &&
      (!lastAppliedViewportRef.current ||
        lastAppliedViewportRef.current.x !== storedViewport.x ||
        lastAppliedViewportRef.current.y !== storedViewport.y ||
        lastAppliedViewportRef.current.zoom !== storedViewport.zoom)) {
      setViewport(storedViewport);
      lastAppliedViewportRef.current = storedViewport;
    }
  }, [storedViewport, setViewport]);

  // Smart fitView - only for empty projects or first load without positioned nodes
  useEffect(() => {
    if (nodes.length === 0) {
      // Reset fitView state when nodes are cleared
      setHasInitialFitView(false);
    } else if (!hasInitialFitView && !storedViewport) {
      // Only auto-fit if we don't have a saved viewport
      // Check if nodes have meaningful positions (not all at origin)
      const hasPositionedNodes = nodes.some(node =>
        node.position.x !== 0 || node.position.y !== 0
      );

      if (!hasPositionedNodes) {
        // Only fitView if all nodes are at origin (newly created)
        fitView({ duration: 300 });
      }
      setHasInitialFitView(true);
    }
  }, [nodes, fitView, hasInitialFitView, storedViewport]);

  // Middle mouse button panning handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      setIsMiddleMouseDown(true);
      setLastPanPosition({ x: event.clientX, y: event.clientY });

      // Change cursor to grabbing
      if (reactFlowWrapper.current) {
        reactFlowWrapper.current.style.cursor = 'grabbing';
      }
    }
  }, []);

  // Throttled mouse move for better performance
  const handleMouseMoveInternal = useCallback((event: React.MouseEvent) => {
    if (isMiddleMouseDown) {
      event.preventDefault();

      const deltaX = event.clientX - lastPanPosition.x;
      const deltaY = event.clientY - lastPanPosition.y;

      const viewport = getViewport();
      setViewport({
        x: viewport.x + deltaX,
        y: viewport.y + deltaY,
        zoom: viewport.zoom
      });

      setLastPanPosition({ x: event.clientX, y: event.clientY });
    }
  }, [isMiddleMouseDown, lastPanPosition, getViewport, setViewport]);

  // Throttle mouse move to 60fps for smoother panning
  const handleMouseMove = useThrottledCallback(handleMouseMoveInternal, 16);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      setIsMiddleMouseDown(false);

      // Reset cursor
      if (reactFlowWrapper.current) {
        reactFlowWrapper.current.style.cursor = cursorMode === 'grab' ? 'grab' : 'default';
      }
    }
  }, [cursorMode]);

  // Global mouse up handler for when mouse leaves canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMiddleMouseDown) {
        setIsMiddleMouseDown(false);
        if (reactFlowWrapper.current) {
          reactFlowWrapper.current.style.cursor = cursorMode === 'grab' ? 'grab' : 'default';
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isMiddleMouseDown, cursorMode]);
  const { contextMenu, closeContextMenu, handleContextMenu, getContextMenuItems } = useUniversalContextMenu();

  // Keyboard shortcuts for copy/paste/delete
  useKeyboardShortcuts([
    {
      key: 'c',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => {
        if (selectedNodes.length > 0) {
          copyNodes(selectedNodes);
        }
      }
    },
    {
      key: 'v',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => {
        if (clipboard.nodes.length > 0) {
          pasteNodes();
        }
      }
    },
    {
      key: 'd',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => {
        if (selectedNodes.length > 0) {
          duplicateNodes(selectedNodes);
        }
      }
    },
    {
      key: 'Delete',
      handler: () => {
        if (selectedNodes.length > 0) {
          deleteSelectedNodes();
        }
      }
    },
    {
      key: 'Backspace',
      handler: () => {
        if (selectedNodes.length > 0) {
          deleteSelectedNodes();
        }
      }
    },
    {
      key: 'a',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => {
        selectAllNodes();
      }
    },
    {
      key: 'z',
      metaKey: isMac,
      ctrlKey: !isMac,
      shiftKey: false,
      handler: () => {
        if (canUndo) {
          undo();
        }
      }
    },
    {
      key: 'z',
      metaKey: isMac,
      ctrlKey: !isMac,
      shiftKey: true,
      handler: () => {
        if (canRedo) {
          redo();
        }
      }
    },
    {
      key: 'f',
      handler: () => {
        // Jump to nearest node
        console.log('=== F key pressed! ===');
        console.log('Total nodes:', nodes.length);
        if (nodes.length === 0) return;

        const viewport = getViewport();
        console.log('Current viewport:', viewport);
        const screenCenterX = -viewport.x / viewport.zoom;
        const screenCenterY = -viewport.y / viewport.zoom;
        console.log('Screen center:', { screenCenterX, screenCenterY });

        // Find the nearest node to the current screen center
        let nearestNode = nodes[0];
        let minDistance = Infinity;

        nodes.forEach(node => {
          const nodeX = node.position.x;
          const nodeY = node.position.y;
          const distance = Math.sqrt(
            Math.pow(nodeX - screenCenterX, 2) + Math.pow(nodeY - screenCenterY, 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
          }
        });

        // Center the view on the nearest node with animation
        if (nearestNode) {
          // Calculate the center of the viewport to position the node in the middle of the screen
          const nodeWidth = nearestNode.measured?.width || 300;
          const nodeHeight = nearestNode.measured?.height || 200;

          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;

          // Use a better zoom level - if current zoom is too small, increase it
          const targetZoom = viewport.zoom < 0.5 ? 1 : viewport.zoom;

          const newX = -(nearestNode.position.x * targetZoom) + (windowWidth / 2) - (nodeWidth * targetZoom / 2);
          const newY = -(nearestNode.position.y * targetZoom) + (windowHeight / 2) - (nodeHeight * targetZoom / 2);

          console.log('F key - Moving viewport to:', { x: newX, y: newY, zoom: targetZoom });
          console.log('F key - Zoom changed from', viewport.zoom, 'to', targetZoom);

          const newViewport = { x: newX, y: newY, zoom: targetZoom };
          setViewport(newViewport, { duration: 400 });
          setStoredViewport(newViewport); // Update store so it doesn't get overwritten!
        }
      }
    }
  ]);

  const coloredEdges = edges;

  // Performance optimizations for large projects
  const performanceSettings = getPerformanceSettings(nodes.length);
  const shouldShowMinimap = performanceSettings.showMinimap;

  // Performance optimization message for large projects
  useEffect(() => {
    if (nodes.length > 1000) {
      // Large project detected
      if (nodes.length > 2000) {
        // Consider splitting into smaller workflows for better performance
      }
    }
  }, [nodes.length]);



  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if it's a node from sidebar
      const type = event.dataTransfer.getData('application/reactflow');
      if (type) {
        addNodeAtPosition(type, position);
        return;
      }

      // File drop functionality removed (Input nodes removed)
    },
    [screenToFlowPosition, addNodeAtPosition]
  );

  // Handle node selection changes
  const handleSelectionChange = useCallback((params: { nodes: { id: string }[] }) => {
    const selectedNodeIds = params.nodes.map((node: { id: string }) => node.id);
    setSelectedNodes(selectedNodeIds);
  }, [setSelectedNodes]);

  // Handle group node dragging - move grouped nodes together
  const handleNodeDrag = useCallback(() => {
    // Group dragging is handled differently now
    // Grouped nodes are moved together through selection
  }, []);

  // Save history when node dragging stops
  const onNodeDragStop = useCallback(() => {
    saveHistory();
  }, [saveHistory]);


  // Figma-style trackpad navigation (only in selection mode)
  const handleWheel = useCallback((event: Event) => {
    const wheelEvent = event as WheelEvent;
    // Only handle wheel events in selection mode for Mac-style navigation
    if (cursorMode !== 'selection') return;

    // Check if we're scrolling inside a node's scrollable area
    const target = wheelEvent.target as Element;
    const scrollableParent = target?.closest('.overflow-auto, .overflow-y-auto, .overflow-x-auto, .overflow-scroll, .overflow-y-scroll, .overflow-x-scroll');
    const isInsideNode = target?.closest('.react-flow__node');

    // If scrolling inside a node's scrollable area, allow native scroll
    if (isInsideNode && scrollableParent) {
      return; // Don't prevent default, allow native scrolling
    }

    wheelEvent.preventDefault();
    const viewport = getViewport();

    // Check if it's a pinch gesture (zoom)
    if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
      // Pinch zoom with extended zoom out range
      // Adaptive zoom speed - slower when very zoomed out
      const zoomSpeed = viewport.zoom < 0.1 ? 0.005 : 0.01;
      const zoomFactor = 1 - wheelEvent.deltaY * zoomSpeed;
      const newZoom = Math.max(0.02, Math.min(4, viewport.zoom * zoomFactor));

      const newViewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: newZoom
      };

      setViewport(newViewport);
    } else {
      // Pan with scroll (like Figma)
      const panSpeed = 1;
      const newViewport = {
        x: viewport.x - wheelEvent.deltaX * panSpeed,
        y: viewport.y - wheelEvent.deltaY * panSpeed,
        zoom: viewport.zoom
      };

      setViewport(newViewport);
    }
  }, [cursorMode, getViewport, setViewport]);

  // Add wheel event listener for Figma-style navigation
  useEffect(() => {
    const handleGlobalWheel = (event: WheelEvent) => {
      // Check if the wheel event is happening over the canvas area
      const target = event.target as Element;

      // Check if we're scrolling inside a scrollable element within a node
      const scrollableParent = target?.closest('.overflow-auto, .overflow-y-auto, .overflow-x-auto, .overflow-scroll, .overflow-y-scroll, .overflow-x-scroll');
      const isInsideNode = target?.closest('.react-flow__node');

      // If scrolling inside a node's scrollable area, don't handle with Figma navigation
      if (isInsideNode && scrollableParent) {
        return; // Let native scrolling work
      }

      const isOverCanvas = target?.closest('.react-flow');

      // Handle wheel event for canvas or non-scrollable node areas
      if (isOverCanvas) {
        handleWheel(event);
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    // Proper cleanup - removing the exact same function reference
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, [handleWheel]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'd',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => duplicateNodes([]),
    },
    {
      key: 'c',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => copyNodes([]),
    },
    {
      key: 'v',
      metaKey: isMac,
      ctrlKey: !isMac,
      handler: () => pasteNodes(),
    }
  ]);

  // Get current viewport for conditional optimizations
  const currentViewport = getViewport();
  const isVeryZoomedOut = currentViewport.zoom < 0.1;

  // Disable interactions when very zoomed out for better performance
  const nodesDraggable = !isVeryZoomedOut;
  const nodesConnectable = true; // Always allow manual connections

  return (
    <div className="w-full h-full bg-gray-50" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        onlyRenderVisibleElements={true}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={handleSelectionChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={(event) => handleContextMenu(event as React.MouseEvent)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          event.stopPropagation();

          // If the node is not selected, select only this node
          if (!selectedNodes.includes(node.id)) {
            setSelectedNodes([node.id]);
          }

          // Open context menu
          handleContextMenu(event as React.MouseEvent, node.id);
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onViewportChange={handleViewportChange}
        nodeTypes={STABLE_NODE_TYPES}
        className={`bg-gray-50 cursor-${cursorMode} ${isMiddleMouseDown ? '!cursor-grabbing' : ''}`}
        panOnDrag={cursorMode === 'grab' || isMiddleMouseDown}
        selectionOnDrag={cursorMode === 'selection' && !isMiddleMouseDown}
        zoomOnScroll={cursorMode === 'grab'}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.02}
        maxZoom={4}
        nodesDraggable={nodesDraggable}
        nodesConnectable={nodesConnectable}
        elevateNodesOnSelect={false}
        connectOnClick={false}
        nodeOrigin={[0.5, 0.5]}
        defaultEdgeOptions={{
          type: performanceSettings.edgeType,
          animated: false
        }}
        disableKeyboardA11y={performanceSettings.isHugeProject}
        autoPanOnConnect={false}
        autoPanOnNodeDrag={false}
      >
        {/* Only show background when zoomed in enough - saves performance */}
        {currentViewport.zoom >= 0.05 && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#e5e7eb"
          />
        )}
        {/* Controls removed - using custom zoom indicator instead */}
        {shouldShowMinimap && (
          <MiniMap
            className="react-flow-minimap-custom"
            nodeColor="#ffffff"
            maskColor="rgba(0, 0, 0, 0.6)"
            nodeStrokeWidth={2}
            nodeStrokeColor="#666666"
          />
        )}

        {/* Zoom Indicator & Fit View Button */}
        <Panel position="top-right" className="m-4">
          <div className="flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
            <ZoomIndicator />
            <FitViewButton />
          </div>
        </Panel>

        {/* Undo/Redo Controls */}
        <Panel position="top-left" className="m-4">
          <UndoRedoIndicator />
        </Panel>

        {/* Node Count Info & Performance Mode */}
        <Panel position="bottom-right" className="m-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 text-xs text-gray-600">
            <div>{nodes.length} nodes, {edges.length} connections</div>
            {performanceSettings.isHugeProject && (
              <div className="text-orange-600 font-semibold mt-1">
                ⚡ Performance mode: Optimizations enabled
              </div>
            )}
            {performanceSettings.isLargeProject && !performanceSettings.isHugeProject && (
              <div className="text-blue-600 mt-1">
                🚀 Large project mode active
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {/* Hierarchical Context Menu */}
      <HierarchicalContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        items={getContextMenuItems(screenToFlowPosition({ x: contextMenu.position.x, y: contextMenu.position.y }))}
        onClose={closeContextMenu}
      />
    </div>
  );
});

FlowCanvasInner.displayName = 'FlowCanvasInner';

export const FlowCanvas = () => {
  return (
    <ReactFlowProvider>
      <ClientErrorBoundary context="FlowCanvas">
        <FlowCanvasInner />
      </ClientErrorBoundary>
    </ReactFlowProvider>
  );
};
