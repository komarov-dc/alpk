import { StateCreator } from 'zustand';
import { StoreState } from './types';
import { historyManager } from '../modules/historyManager';

export interface HistorySlice {
  // State
  canUndo: boolean;
  canRedo: boolean;
  isUndoRedoOperation: boolean;
  
  // Actions
  undo: () => void;
  redo: () => void;
}

export const createHistorySlice: StateCreator<
  StoreState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  // Initial state
  canUndo: false,
  canRedo: false,
  isUndoRedoOperation: false,
  
  // Actions
  undo: () => {
    const snapshot = historyManager.undo();
    if (snapshot) {
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        selectedNodes: snapshot.selectedNodes || [],
        globalVariables: snapshot.globalVariables || get().globalVariables,
        isUndoRedoOperation: true,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      // Reset the flag after operation
      setTimeout(() => set({ isUndoRedoOperation: false }), 0);
    }
  },
  
  redo: () => {
    const snapshot = historyManager.redo();
    if (snapshot) {
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        selectedNodes: snapshot.selectedNodes || [],
        globalVariables: snapshot.globalVariables || get().globalVariables,
        isUndoRedoOperation: true,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      // Reset the flag after operation
      setTimeout(() => set({ isUndoRedoOperation: false }), 0);
    }
  }
});
