import { Node, Edge } from '@xyflow/react';
import { jsonClone } from '@/utils/safeJson';
import { GlobalVariable } from '../slices/types';

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];
  globalVariables?: Record<string, GlobalVariable>;
}

export interface HistoryManagerState {
  history: HistoryState[];
  currentIndex: number;
  maxHistorySize: number;
}

export interface HistoryManagerActions {
  saveToHistory: (state: HistoryState) => void;
  undo: () => HistoryState | null;
  redo: () => HistoryState | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

// History manager implementation
export const createHistoryManager = (): HistoryManagerState & HistoryManagerActions => {
  const state: HistoryManagerState = {
    history: [],
    currentIndex: -1,
    maxHistorySize: 10  // Reduced from 50 to prevent memory explosion
  };

  const saveToHistory = (newState: HistoryState) => {
    // Remove any future history if we're not at the end
    if (state.currentIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.currentIndex + 1);
    }

    // Clean node data to remove memory-heavy fields before saving to history
    const cleanedNodes = newState.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        // Remove memory-heavy debug fields from history
        fullContext: undefined,
        providerRequest: undefined,
        providerResponse: undefined,
        // Keep only essential fields for undo/redo
        id: node.data?.id,
        type: node.data?.type,
        label: node.data?.label,
        isExecuting: node.data?.isExecuting,
        lastResponse: node.data?.lastResponse,
        lastThinking: node.data?.lastThinking,
        error: node.data?.error,
        executionStats: node.data?.executionStats
      }
    }));

    // Add new state with cleaned data
    const clonedNodes = jsonClone(cleanedNodes) || cleanedNodes;
    const clonedEdges = jsonClone(newState.edges) || newState.edges;
    const clonedGlobalVariables = newState.globalVariables ? jsonClone(newState.globalVariables) : undefined;
    
    state.history.push({
      nodes: clonedNodes,
      edges: clonedEdges,
      selectedNodes: [...newState.selectedNodes],
      ...(clonedGlobalVariables && { globalVariables: clonedGlobalVariables })
    });

    // Limit history size
    if (state.history.length > state.maxHistorySize) {
      state.history = state.history.slice(-state.maxHistorySize);
    }

    state.currentIndex = state.history.length - 1;
  };

  const undo = (): HistoryState | null => {
    if (state.currentIndex > 0 && state.history.length > 1) {
      state.currentIndex--;
      return jsonClone(state.history[state.currentIndex]) || null;
    }
    return null;
  };

  const redo = (): HistoryState | null => {
    if (state.currentIndex < state.history.length - 1) {
      state.currentIndex++;
      return jsonClone(state.history[state.currentIndex]) || null;
    }
    return null;
  };

  const canUndo = (): boolean => {
    return state.currentIndex > 0 && state.history.length > 1;
  };

  const canRedo = (): boolean => {
    return state.currentIndex < state.history.length - 1;
  };

  const clearHistory = () => {
    state.history = [];
    state.currentIndex = -1;
    // Force garbage collection of old snapshots (Chrome only)
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as unknown as { gc: () => void }).gc();
    }
  };

  return {
    ...state,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  };
};

// Global history manager instance
export const historyManager = createHistoryManager();
