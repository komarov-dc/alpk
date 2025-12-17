'use client';

import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import { useFlowStore } from '@/store/useFlowStore';

export const FitViewButton = () => {
  const { getViewport, setViewport } = useReactFlow();
  const nodes = useFlowStore(state => state.nodes);
  const setStoredViewport = useFlowStore(state => state.setViewport);

  const jumpToNearestNode = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('=== Jump to nearest node clicked! ===');
    console.log('Total nodes:', nodes.length);
    
    if (nodes.length === 0) {
      console.log('No nodes to jump to');
      return;
    }

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

    if (!nearestNode) {
      console.log('No nearest node found');
      return;
    }

    console.log(`Jumping to nearest node: ${nearestNode.id} at (${nearestNode.position.x}, ${nearestNode.position.y})`);
    console.log('Distance was:', minDistance);

    // Calculate the center of the viewport to position the node in the middle of the screen
    const nodeWidth = nearestNode.measured?.width || 300; // Default width if not measured
    const nodeHeight = nearestNode.measured?.height || 200; // Default height if not measured
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Use a better zoom level - if current zoom is too small, increase it
    const targetZoom = viewport.zoom < 0.5 ? 1 : viewport.zoom;
    
    // Calculate viewport position to center the node
    // Formula: viewport.x = -(nodeX * zoom) + (windowWidth / 2) - (nodeWidth * zoom / 2)
    const newX = -(nearestNode.position.x * targetZoom) + (windowWidth / 2) - (nodeWidth * targetZoom / 2);
    const newY = -(nearestNode.position.y * targetZoom) + (windowHeight / 2) - (nodeHeight * targetZoom / 2);
    
    console.log('Moving viewport to:', { x: newX, y: newY, zoom: targetZoom });
    console.log('Zoom changed from', viewport.zoom, 'to', targetZoom);
    
    const newViewport = { x: newX, y: newY, zoom: targetZoom };
    
    // Center the view on the nearest node
    try {
      // Update both React Flow viewport AND store
      setViewport(newViewport, { duration: 400 });
      setStoredViewport(newViewport); // ← CRITICAL: Update store so it doesn't get overwritten!
      console.log('setViewport called successfully');
    } catch (error) {
      console.error('Error calling setViewport:', error);
    }
  }, [nodes, getViewport, setViewport, setStoredViewport]);

  return (
    <button
      onClick={jumpToNearestNode}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer relative z-50"
      style={{ pointerEvents: 'auto' }}
      title="Jump to nearest node (F)"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-700 pointer-events-none"
      >
        {/* Crosshair/target icon */}
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    </button>
  );
};
