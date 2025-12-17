import { StateCreator } from 'zustand';
import { ExecutionResult } from '@/types';
import { StoreState } from './types';
import { executeNodeModular } from '../modules/execution';
import { FeatureChecks } from '@/config/featureFlags';
import { extractNodeOutput, nodeProducesOutput } from './nodeOutputExtractors';
import { logger } from '@/utils/logger';

export interface ExecutionSlice {
  // State
  isExecuting: boolean;
  executionResults: Record<string, ExecutionResult>;
  
  // Actions
  executeFlow: (clearResults?: boolean) => Promise<void>;
  executeFromNode: (nodeId: string) => Promise<void>;
  executeNode: (nodeId: string, useQueue?: boolean) => Promise<void>;
  clearExecutionResults: () => void;
  setExecutionResults: (results: Record<string, ExecutionResult>) => void;
  setExecuting: (isExecuting: boolean) => void;
  resetAllLLMNodes: () => void;
  autoExecuteInputNodes: () => Promise<void>;
  restoreVariablesFromExecutionResults: () => Promise<void>;
}

export const createExecutionSlice: StateCreator<
  StoreState,
  [],
  [],
  ExecutionSlice
> = (set, get) => ({
  // Initial state
  isExecuting: false,
  executionResults: {},
  
  // Actions
  executeFlow: async (clearResults: boolean = false) => {
    // Optionally clear results, but by default keep them for history
    if (clearResults) {
      set({ isExecuting: true, executionResults: {} });
    } else {
      set({ isExecuting: true });
    }
    
    try {
      const { nodes, edges } = get();
      const { ExecutionQueueManager } = await import('../modules/execution/queueManager');
      const { ExecutionContext } = await import('../modules/execution/executionContext');
      
      // Create execution context for modular system - lazy access pattern
      const config = {
        getNodes: () => get().nodes,
        getEdges: () => get().edges,
        getExecutionResults: () => get().executionResults,
        getGlobalVariables: () => get().globalVariables,
        updateNodeData: get().updateNodeData,
        setExecutionResults: (results: Record<string, ExecutionResult>) => {
          set((state) => ({
            executionResults: {
              ...state.executionResults,
              ...results
            }
          }));
        },
        addGlobalVariable: get().addGlobalVariable,
        updateGlobalVariable: get().updateGlobalVariable,
        interpolateTemplate: (template: string) => {
          // Use optimized interpolation based on feature flags
          return FeatureChecks.isFastInterpolationEnabled()
            ? get().fastInterpolateTemplate(template)
            : get().interpolateTemplate(template);
        },
        executeNode: get().executeNode,
        updateEdgeColors: get().updateEdgeColors,
        isExecuting: true,
        setExecuting: (value: boolean) => set({ isExecuting: value })
      };
      
      const context = new ExecutionContext(config);
      const queueManager = ExecutionQueueManager.getInstance();
      
      // Set context and clear queue
      queueManager.setExecutionContext(context);
      queueManager.clearQueue();
      
      // Conditionally clear or restore completed nodes
      if (clearResults) {
        queueManager.clearCompletedNodeIds();
      } else {
        // Restore completed nodes from execution results for incremental execution
        queueManager.restoreCompletedNodesFromExecutionResults(get().executionResults);
      }
      
      // Find executable nodes using topological sort
      const executableTypes = ['trigger', 'basicLLMChain', 'note', 'modelProvider', 'outputSender'];
      
      // Build dependency graph
      const inDegree = new Map<string, number>();
      const adjacencyList = new Map<string, string[]>();
      const originalInDegree = new Map<string, number>();
      
      nodes.forEach(node => {
        adjacencyList.set(node.id, []);
        inDegree.set(node.id, 0);
        originalInDegree.set(node.id, 0);
      });
      
      edges.forEach(edge => {
        const neighbors = adjacencyList.get(edge.source) || [];
        neighbors.push(edge.target);
        adjacencyList.set(edge.source, neighbors);
        const deg = (inDegree.get(edge.target) || 0) + 1;
        inDegree.set(edge.target, deg);
        originalInDegree.set(edge.target, deg);
      });
      
      // Discover nodes connected to inputs/triggers via BFS
      const connectedToInputs = new Set<string>();
      const startNodes = nodes.filter(n => n.type === 'input' || n.type === 'trigger');
      const bfs = (starts: string[]) => {
        const q = [...starts];
        const visited = new Set<string>();
        while (q.length) {
          const id = q.shift()!;
          if (visited.has(id)) continue;
          visited.add(id);
          connectedToInputs.add(id);
          const outs = adjacencyList.get(id) || [];
          outs.forEach(t => { if (!visited.has(t)) q.push(t); });
        }
      };
      bfs(startNodes.map(n => n.id));
      
      // Topological sort
      const queue: string[] = [];
      const topologicalOrder: string[] = [];
      
      // Find nodes with no dependencies
      inDegree.forEach((degree, nodeId) => {
        if (degree === 0) {
          queue.push(nodeId);
        }
      });
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        topologicalOrder.push(current);
        
        const neighbors = adjacencyList.get(current) || [];
        neighbors.forEach(neighbor => {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        });
      }
      
      // Separate connected vs isolated executable nodes
      const execNodes = topologicalOrder
        .map(id => nodes.find(n => n.id === id))
        .filter((n): n is NonNullable<typeof n> => !!n && executableTypes.includes(n.type || ''));
      
      const connectedNodes = execNodes.filter(n => connectedToInputs.has(n.id));
      const isolatedNodes = execNodes.filter(n => !connectedToInputs.has(n.id) && ((originalInDegree.get(n.id) || 0) > 0 || (adjacencyList.get(n.id) || []).length > 0));
      
      // Phase 1: connected nodes get higher priority
      for (let i = 0; i < connectedNodes.length; i++) {
        const node = connectedNodes[i];
        if (!node) continue;
        
        // Skip nodes that are already completed (unless we're clearing results)
        if (!clearResults && queueManager.isNodeCompleted(node.id)) {
          logger.dev(`⏭️ Skipping already completed node: ${node.data?.label || node.id}`);
          continue;
        }
        
        const base = node.type === 'trigger' ? 2000 : node.type === 'input' ? 1800 : 1200;
        const priority = base + (connectedNodes.length - i);
        await queueManager.addToQueue(node, priority, context);
      }
      
      // Phase 2: isolated nodes with lower priority
      for (let i = 0; i < isolatedNodes.length; i++) {
        const node = isolatedNodes[i];
        if (!node) continue;
        
        // Skip nodes that are already completed (unless we're clearing results)
        if (!clearResults && queueManager.isNodeCompleted(node.id)) {
          logger.dev(`⏭️ Skipping already completed node: ${node.data?.label || node.id}`);
          continue;
        }
        
        const base = node.type === 'trigger' ? 900 : node.type === 'input' ? 800 : 400;
        const priority = base + (isolatedNodes.length - i);
        await queueManager.addToQueue(node, priority, context);
      }
      
    } catch (error) {
      logger.error('Flow execution failed:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      set({ isExecuting: false });
    }
  },
  
  executeFromNode: async (nodeId: string) => {
    const { nodes, edges } = get();
    const startNode = nodes.find(n => n.id === nodeId);
    if (!startNode) return;
    
    // Execute the start node
    await get().executeNode(nodeId);
    
    // Find and execute connected downstream nodes
    const visited = new Set<string>();
    visited.add(nodeId);
    
    const executeDownstream = async (currentNodeId: string) => {
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          await get().executeNode(edge.target);
          await executeDownstream(edge.target);
        }
      }
    };
    
    await executeDownstream(nodeId);
  },
  
  executeNode: async (nodeId: string, useQueue: boolean = false) => {
    const { nodes } = get();
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      return;
    }
    
    // Check if node is already executing to prevent recursion
    if (node.data?.isExecuting) {
      logger.dev(`Node ${nodeId} is already executing, skipping`);
      return;
    }
    
    // Check if we should use the queue
    const shouldUseQueue = useQueue || 
      (FeatureChecks.isExecutionQueueEnabled() && !get().isExecuting);
    
    if (shouldUseQueue) {
      // Add to queue for managed execution
      const { queueManager } = await import('../modules/execution/queueManager');
      const priority = node.type === 'input' ? 1000 : 
                      node.type === 'trigger' ? 900 : 
                      500;
      
      // Create execution context for queue manager
      const { ExecutionContext } = await import('../modules/execution/executionContext');
      const { edges, executionResults, globalVariables } = get();
      const context = new ExecutionContext({
        getNodes: () => nodes,
        getEdges: () => edges,
        getExecutionResults: () => executionResults,
        getGlobalVariables: () => globalVariables,
        updateNodeData: get().updateNodeData,
        setExecutionResults: (results: Record<string, ExecutionResult>) => {
          set((state) => ({
            executionResults: {
              ...state.executionResults,
              ...results
            }
          }));
        },
        addGlobalVariable: get().addGlobalVariable,
        updateGlobalVariable: get().updateGlobalVariable,
        interpolateTemplate: (template: string) => {
          return FeatureChecks.isFastInterpolationEnabled()
            ? get().fastInterpolateTemplate(template)
            : get().interpolateTemplate(template);
        },
        executeNode: get().executeNode,
        updateEdgeColors: get().updateEdgeColors,
        isExecuting: get().isExecuting,
        setExecuting: get().setExecuting
      });
      
      await queueManager.addToQueue(node, priority, context);
      return;
    }
    
    // Direct execution using modular system
    const { edges, executionResults, globalVariables } = get();
    
    await executeNodeModular(
      nodeId,
      nodes,
      edges,
      get().updateNodeData,
      executionResults,
      globalVariables,
      (results: Record<string, ExecutionResult>) => {
        // Use atomic state update to prevent race conditions
        set((state) => ({
          executionResults: {
            ...state.executionResults,
            ...results
          }
        }));
      },
      get().updateEdgeColors,
      get().executeNode,
      (template: string) => {
        // Use optimized interpolation for direct node execution  
        return FeatureChecks.isFastInterpolationEnabled()
          ? get().fastInterpolateTemplate(template)
          : get().interpolateTemplate(template);
      },
      get().addGlobalVariable,
      get().updateGlobalVariable
    );
  },
  
  clearExecutionResults: () => {
    set({ executionResults: {} });
  },
  
  setExecutionResults: (results: Record<string, ExecutionResult>) => {
    set({ executionResults: results });
  },
  
  setExecuting: (isExecuting: boolean) => {
    set({ isExecuting });
  },
  
  resetAllLLMNodes: () => {
    const { nodes, updateNodeData, clearWorkflowVariables } = get();
    
    // Clear LLM nodes data
    nodes.forEach(node => {
      if (node.type === 'basicLLMChain' || node.type === 'llmChain') {
        // Clear node data
        updateNodeData(node.id, {
          lastResponse: undefined,
          lastThinking: undefined,
          isExecuting: false,
          lastError: undefined,
          error: undefined,
          queueStatus: undefined
        });
      } else {
        // Clear execution data for all other node types too
        const cleanData: Record<string, unknown> = { ...node.data };
        
        // Remove execution-related fields
        delete cleanData.output;
        delete cleanData.lastOutput;
        delete cleanData.result;
        delete cleanData.lastResult;
        delete cleanData.lastError;
        delete cleanData.executionStats;
        delete cleanData.queueStatus;
        
        // Reset states
        cleanData.isLoading = false;
        cleanData.error = undefined;
        cleanData.isExecuting = false;
        cleanData.lastExecuted = undefined;
        
        updateNodeData(node.id, cleanData as Partial<typeof node.data>);
      }
    });
    
    // Clear ALL execution results (not just LLM nodes)
    set({ executionResults: {} });
    
    // Clear all workflow variables
    clearWorkflowVariables();
    
    // Clear any active queue items
    import('../modules/execution/queueManager').then(({ queueManager }) => {
      const queue = queueManager.getQueue();
      queue.forEach(item => {
        if (item.status === 'queued' || item.status === 'waiting') {
          queueManager.cancelItem(item.id);
        }
      });
    });
  },
  
  autoExecuteInputNodes: async () => {
    const { nodes } = get();
    const inputNodes = nodes.filter(node => 
      node.type === 'input' && 
      node.data?.value && 
      typeof node.data.value === 'string' && 
      node.data.value.trim()
    );
    
    for (const node of inputNodes) {
      await get().executeNode(node.id);
    }
  },
  
  restoreVariablesFromExecutionResults: async () => {
    const { nodes, executionResults, globalVariables } = get();
    const currentGlobalVariables = globalVariables;
    const newGlobalVariables = { ...currentGlobalVariables };
    let variablesAdded = 0;
    
    // Iterate through execution results to restore variables
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      if (result.success && result.output) {
        const sourceNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode) return;
        
        const nodeLabel = (sourceNode.data?.label as string) || nodeId;
        
        // Skip if variable already exists
        if (currentGlobalVariables[nodeLabel]) return;
        
        // Skip non-output nodes
        if (!nodeProducesOutput(sourceNode.type || '')) return;
        
        // Extract output using strategy pattern
        const variableValue = extractNodeOutput(sourceNode.type || '', result.output);
        
        if (variableValue) {
          newGlobalVariables[nodeLabel] = {
            name: nodeLabel,
            value: variableValue,
            description: `Auto-restored from ${sourceNode.type}: ${sourceNode.data?.label || nodeId}`
          };
          variablesAdded++;
        }
      }
    });
    
    // If new variables were added, update store
    if (variablesAdded > 0) {
      set({ globalVariables: newGlobalVariables });
      
      // Save the updated project with new global variables
      const { currentProject, edges, viewport } = get();
      if (currentProject) {
        try {
          const { projectActions } = await import('../modules/projectManager');
          await projectActions.saveProject(
            currentProject,
            nodes,
            edges,
            newGlobalVariables,
            executionResults,
            viewport
          );
        } catch {
          // Failed to persist variables silently
        }
      }
    }
  },
});
