'use client';

import { useState, useCallback } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { MenuItem } from '@/components/ui/HierarchicalContextMenu';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  target: string | null; // node id or 'canvas'
}

export const useUniversalContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    target: null,
  });

  const {
    selectedNodes,
    setSelectedNodes,
    clipboard,
    copyNodes,
    pasteNodes,
    duplicateNodes,
    deleteSelectedNodes,
    selectAllNodes,
    setNodes,
    nodes,
    addNodeAtPosition,
    addNoteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    executeNode,
    executeFromNode,
    hideSelectedNodes,
    showAllNodes
  } = useFlowStore();

  const openContextMenu = useCallback((x: number, y: number, target?: string) => {
    setContextMenu({
      isOpen: true,
      position: { x, y },
      target: target || 'canvas',
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      target: null,
    });
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, nodeId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    // If right-clicking on a node
    if (nodeId) {
      // If the node is not selected, select only this node
      if (!selectedNodes.includes(nodeId)) {
        setSelectedNodes([nodeId]);
      }
      // If the node is already selected and there are multiple selections, keep the selection
    }
    
    openContextMenu(event.clientX, event.clientY, nodeId || 'canvas');
  }, [openContextMenu, selectedNodes, setSelectedNodes]);

  // Generate context menu items based on current state
  const getContextMenuItems = useCallback((flowPosition?: { x: number; y: number }): MenuItem[] => {
    const hasSelection = selectedNodes.length > 0;
    const hasClipboard = clipboard.nodes.length > 0;
    const isMultiSelection = selectedNodes.length > 1;

    if (hasSelection) {
      // Actions when nodes are selected
      return [
        {
          id: 'copy',
          label: isMultiSelection ? `Copy (${selectedNodes.length})` : 'Copy',
          icon: '📋',
          onClick: () => {
            copyNodes(selectedNodes);
          },
        },
        {
          id: 'duplicate',
          label: isMultiSelection ? `Duplicate (${selectedNodes.length})` : 'Duplicate',
          icon: '⚡',
          onClick: () => {
            duplicateNodes(selectedNodes);
          },
        },
        {
          id: 'delete',
          label: isMultiSelection ? `Delete (${selectedNodes.length})` : 'Delete',
          icon: '🗑️',
          onClick: () => {
            deleteSelectedNodes();
          },
        },
        {
          id: 'separator1',
          label: '',
          separator: true,
        },
        {
          id: 'hide',
          label: isMultiSelection ? `Hide Selected (${selectedNodes.length})` : 'Hide Node',
          icon: '👁️‍🗨️',
          onClick: () => {
            hideSelectedNodes(selectedNodes);
          },
        },
        {
          id: 'execute',
          label: isMultiSelection ? `Execute (${selectedNodes.length})` : 'Execute Node',
          icon: '▶️',
          onClick: async () => {
            // Check if any nodes are currently executing
            const anyNodeExecuting = nodes.some(n => n.data?.isExecuting);
            
            if (anyNodeExecuting) {
              // If nodes are running, add to queue
              const { queueManager } = await import('@/store/modules/execution/queueManager');
              for (const nodeId of selectedNodes) {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                  await queueManager.addToQueue(node, 0);
                }
              }
            } else {
              // No nodes running - execute directly
              for (const nodeId of selectedNodes) {
                await executeNode(nodeId);
              }
            }
          },
        },
        {
          id: 'execute-from',
          label: 'Execute from Here',
          icon: '⚡',
          onClick: async () => {
            if (selectedNodes.length === 1) {
              const firstNode = selectedNodes[0];
              if (firstNode) {
                await executeFromNode(firstNode);
              }
            }
          },
          disabled: isMultiSelection,
        },
        {
          id: 'add-to-queue',
          label: 'Add to Queue',
          icon: '📋',
          submenu: [
            {
              id: 'queue-normal',
              label: 'Normal Priority',
              icon: '✅',
              onClick: async () => {
                const { queueManager } = await import('@/store/modules/execution/queueManager');
                for (const nodeId of selectedNodes) {
                  const node = nodes.find(n => n.id === nodeId);
                  if (node) {
                    await queueManager.addToQueue(node, 0);
                  }
                }
              },
            },
            {
              id: 'queue-high',
              label: 'High Priority',
              icon: '🔴',
              onClick: async () => {
                const { queueManager } = await import('@/store/modules/execution/queueManager');
                for (const nodeId of selectedNodes) {
                  const node = nodes.find(n => n.id === nodeId);
                  if (node) {
                    await queueManager.addToQueue(node, 10);
                  }
                }
              },
            },
            {
              id: 'queue-low',
              label: 'Low Priority',
              icon: '🟢',
              onClick: async () => {
                const { queueManager } = await import('@/store/modules/execution/queueManager');
                for (const nodeId of selectedNodes) {
                  const node = nodes.find(n => n.id === nodeId);
                  if (node) {
                    await queueManager.addToQueue(node, 1);
                  }
                }
              },
            },
          ],
        },
        {
          id: 'separator2',
          label: '',
          separator: true,
        },
        {
          id: 'set-active-tab',
          label: 'Set Active Tab',
          icon: '📑',
          submenu: [
            {
              id: 'tab-messages',
              label: 'Messages',
              icon: '💬',
              onClick: () => {
                const newNodes = nodes.map(node => {
                  if (selectedNodes.includes(node.id) && node.type === 'basicLLMChain') {
                    return { ...node, data: { ...node.data, activeTab: 'messages' } };
                  }
                  return node;
                });
                setNodes(newNodes);
              },
            },
            {
              id: 'tab-response',
              label: 'Response',
              icon: '📝',
              onClick: () => {
                const newNodes = nodes.map(node => {
                  if (selectedNodes.includes(node.id) && node.type === 'basicLLMChain') {
                    return { ...node, data: { ...node.data, activeTab: 'response' } };
                  }
                  return node;
                });
                setNodes(newNodes);
              },
            },
            {
              id: 'tab-settings',
              label: 'Settings',
              icon: '⚙️',
              onClick: () => {
                const newNodes = nodes.map(node => {
                  if (selectedNodes.includes(node.id) && node.type === 'basicLLMChain') {
                    return { ...node, data: { ...node.data, activeTab: 'settings' } };
                  }
                  return node;
                });
                setNodes(newNodes);
              },
            },
            {
              id: 'tab-debug',
              label: 'Debug',
              icon: '🐛',
              onClick: () => {
                const newNodes = nodes.map(node => {
                  if (selectedNodes.includes(node.id) && node.type === 'basicLLMChain') {
                    return { ...node, data: { ...node.data, activeTab: 'debug' } };
                  }
                  return node;
                });
                setNodes(newNodes);
              },
            },
          ],
        },
        {
          id: 'separator3',
          label: '',
          separator: true,
        },
        {
          id: 'collapse',
          label: isMultiSelection ? 'Collapse Selected' : 'Collapse',
          icon: '📦',
          onClick: () => {
            const newNodes = nodes.map(node => 
              selectedNodes.includes(node.id) 
                ? { ...node, data: { ...node.data, isCollapsed: true } }
                : node
            );
            setNodes(newNodes);
          },
        },
        {
          id: 'expand',
          label: isMultiSelection ? 'Expand Selected' : 'Expand',
          icon: '📂',
          onClick: () => {
            const newNodes = nodes.map(node => 
              selectedNodes.includes(node.id) 
                ? { ...node, data: { ...node.data, isCollapsed: false } }
                : node
            );
            setNodes(newNodes);
          },
        },
      ];
    } else {
      // Actions when clicking on canvas
      return [
        {
          id: 'paste',
          label: 'Paste',
          icon: '📋',
          onClick: () => {
            pasteNodes();
          },
          disabled: !hasClipboard,
        },
        {
          id: 'select-all',
          label: 'Select All',
          icon: '🔘',
          onClick: () => {
            selectAllNodes();
          },
        },
        {
          id: 'separator1',
          label: '',
          separator: true,
        },
        {
          id: 'undo',
          label: 'Undo',
          icon: '↶',
          onClick: undo,
          disabled: !canUndo,
        },
        {
          id: 'redo',
          label: 'Redo',
          icon: '↷',
          onClick: redo,
          disabled: !canRedo,
        },
        {
          id: 'separator2',
          label: '',
          separator: true,
        },
        {
          id: 'show-all',
          label: 'Show All Hidden Nodes',
          icon: '👁️',
          onClick: () => {
            showAllNodes();
          },
        },
        {
          id: 'add-nodes',
          label: 'Add Node',
          icon: '➕',
          submenu: [
            {
              id: 'ai-models',
              label: 'AI Models',
              icon: '🤖',
              submenu: [
                {
                  id: 'add-model-provider',
                  label: 'Model Provider',
                  icon: '🏭',
                  onClick: () => addNodeAtPosition('modelProvider', flowPosition || { x: 100, y: 100 }),
                },
                {
                  id: 'add-basic-llm-chain',
                  label: 'Basic LLM Chain',
                  icon: '🔗',
                  onClick: () => addNodeAtPosition('basicLLMChain', flowPosition || { x: 100, y: 100 }),
                },
              ]
            },
            {
              id: 'control-flow',
              label: 'Control Flow',
              icon: '⚡',
              submenu: [
                {
                  id: 'add-trigger',
                  label: 'API Trigger',
                  icon: '📥',
                  onClick: () => addNodeAtPosition('trigger', flowPosition || { x: 100, y: 100 }),
                },
                {
                  id: 'add-output-sender',
                  label: 'Output Sender',
                  icon: '📤',
                  onClick: () => addNodeAtPosition('outputSender', flowPosition || { x: 100, y: 100 }),
                },
              ]
            },
            {
              id: 'utilities',
              label: 'Utilities',
              icon: '🛠️',
              submenu: [
                {
                  id: 'add-note',
                  label: 'Note',
                  icon: '📄',
                  onClick: () => addNoteNode(flowPosition || { x: 100, y: 100 }),
                },
              ]
            },
          ]
        }
      ];
    }
  }, [selectedNodes, clipboard.nodes.length, nodes, copyNodes, duplicateNodes, deleteSelectedNodes, setNodes, pasteNodes, selectAllNodes, undo, redo, canUndo, canRedo, addNodeAtPosition, addNoteNode, executeNode, executeFromNode, hideSelectedNodes, showAllNodes]);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextMenu,
    getContextMenuItems,
  };
};
