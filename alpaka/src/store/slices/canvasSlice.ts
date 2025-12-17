import { StateCreator } from 'zustand';
import { Node, Edge, NodeChange, EdgeChange, Connection, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { historyManager } from '../modules/historyManager';
import { canvasActions, updateEdgeColors as updateEdgeColorsHelper, getEdgeColor as getEdgeColorHelper, getVariableColorForNodes } from '../modules/canvasState';
import { StoreState } from './types';
import { ensureCorrectNodeOrder } from '@/utils/nodeOrdering';

export interface CanvasSlice {
  // State
  nodes: Node[];
  edges: Edge[];
  edgeColors: Record<string, string>;
  cursorMode: 'grab' | 'selection';
  viewport: { x: number; y: number; zoom: number } | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => Promise<void>;
  setCursorMode: (mode: 'grab' | 'selection') => void;
  clearAllEdges: () => void;
  updateEdgeColors: () => void;
  getEdgeColor: (edgeId: string) => string;
  getVariableColor: (sourceNodeId: string, targetNodeId: string) => string;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  saveHistory: () => void;
}

export const createCanvasSlice: StateCreator<
  StoreState,
  [],
  [],
  CanvasSlice
> = (set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  edgeColors: {},
  cursorMode: 'selection' as const,
  viewport: null,

  // Actions
  saveHistory: () => {
    const currentState = get();
    if (!currentState.isUndoRedoOperation) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }
  },

  setNodes: (nodes) => {
    const currentState = get();
    // Only save to history if this is not an undo/redo operation
    if (!currentState.isUndoRedoOperation) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }
    // Ensure correct parent-child ordering
    const orderedNodes = ensureCorrectNodeOrder(nodes);
    set({
      nodes: orderedNodes,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  setEdges: (edges) => {
    const currentState = get();
    // Only save to history if this is not an undo/redo operation
    if (!currentState.isUndoRedoOperation) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }
    set({
      edges,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  onNodesChange: (changes: NodeChange[]) => {
    const currentState = get();

    // Save to history only for structural changes (add/remove)
    // Position changes are now handled by onNodeDragStop to prevent excessive saving
    const hasMeaningfulChanges = changes.some(change =>
      change.type === 'remove' ||
      change.type === 'add'
    );

    if (hasMeaningfulChanges) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }

    const newNodes = applyNodeChanges(changes, currentState.nodes);
    set({
      nodes: newNodes,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const currentState = get();

    // Save to history for edge changes
    if (changes.some(change => change.type === 'remove')) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }

    const newEdges = applyEdgeChanges(changes, currentState.edges);
    set({
      edges: newEdges,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  onConnect: async (connection: Connection) => {
    const currentState = get();
    // Save current state to history before connecting
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes
    });

    const newEdges = await canvasActions.onConnect(
      connection,
      currentState.edges,
      get().executeNode,
      get().updateEdgeColors,
      currentState.nodes
    );
    set({
      edges: newEdges,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  setCursorMode: (mode) => set({ cursorMode: mode }),

  clearAllEdges: () => {
    const currentState = get();
    // Save current state to history before clearing
    if (!currentState.isUndoRedoOperation) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes
      });
    }
    // Clear all edges
    set({
      edges: [],
      edgeColors: {},
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
  },

  updateEdgeColors: (() => {
    let edgeColorsUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (edgeColorsUpdateTimer) {
        clearTimeout(edgeColorsUpdateTimer);
      }
      // Throttle updates to ~60fps
      edgeColorsUpdateTimer = setTimeout(() => {
        const newEdgeColors = updateEdgeColorsHelper(get().nodes, get().edges, get().executionResults);
        set({ edgeColors: newEdgeColors });
        edgeColorsUpdateTimer = null;
      }, 16);
    };
  })(),

  getEdgeColor: (edgeId: string) => {
    return getEdgeColorHelper(edgeId, get().edgeColors);
  },

  getVariableColor: (sourceNodeId: string, targetNodeId: string) => {
    return getVariableColorForNodes(sourceNodeId, targetNodeId, get().nodes, get().executionResults);
  },

  setViewport: (viewport) => {
    set({ viewport });
  },
});
