import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { StoreState } from './slices/types';

// Import all slices
import { createCanvasSlice } from './slices/canvasSlice';
import { createExecutionSlice } from './slices/executionSlice';
import { createVariablesSlice } from './slices/variablesSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createNodeOperationsSlice } from './slices/nodeOperationsSlice';
import { createHistorySlice } from './slices/historySlice';

// Import additional functions that haven't been migrated yet
import {
  buildVariableContext,
  getAvailableVariables,
  getNodeVariableSchema,
  buildExtendedVariableContext
} from './modules/variableSystem';
import { historyManager } from './modules/historyManager';

// Register store getter for external access
import { registerStoreGetter } from './storeAccessor';


// Additional methods that need to be added to the store
interface AdditionalMethods {
  // Variable system helpers (these use the underlying state)
  buildVariableContext: () => Record<string, string>;
  getAvailableVariables: () => Record<string, string>;
  getNodeVariableSchema: (nodeId: string) => Array<{name: string, type: string, hasValue: boolean}>;
  buildExtendedVariableContext: () => Array<{name: string, type: string, hasValue: boolean, value?: string}>;
  
  // Edge management
  clearAllEdges: () => void;
  
}

// Create the combined store type
export type FlowStore = StoreState & AdditionalMethods;

// Create the modular store
export const useFlowStore = create<FlowStore>()(
  devtools(
    (set, get, api) => ({
      // Combine all slices
      ...createCanvasSlice(set, get, api),
      ...createExecutionSlice(set, get, api),
      ...createVariablesSlice(set, get, api),
      ...createSelectionSlice(set, get, api),
      ...createProjectSlice(set, get, api),
      ...createNodeOperationsSlice(set, get, api),
      ...createHistorySlice(set, get, api),
      
      // Additional methods that use the modular state
      buildVariableContext: () => {
        const state = get();
        return buildVariableContext(state.nodes, state.executionResults, state.globalVariables);
      },
      
      getAvailableVariables: () => {
        const state = get();
        return getAvailableVariables(state.nodes, state.executionResults, state.globalVariables);
      },
      
      getNodeVariableSchema: (nodeId: string) => {
        return getNodeVariableSchema(nodeId, get().nodes);
      },
      
      buildExtendedVariableContext: () => {
        const state = get();
        return buildExtendedVariableContext(state.nodes, state.executionResults, state.globalVariables);
      },
      
      // Edge management
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
          canUndo: true,
          canRedo: false
        });
      }
    }),
    {
      name: 'flow-store',
    }
  )
);

// Register the store getter for external access
registerStoreGetter(() => useFlowStore.getState());

// Export the store hook as default
export default useFlowStore;
