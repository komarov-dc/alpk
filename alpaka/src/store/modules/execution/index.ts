/**
 * Main entry point for the modular execution system
 */

import { Node, Edge } from '@xyflow/react';
import { ExecutionResult, UnifiedNodeData } from '@/types';
import { NodeExecutorRegistry } from './types';
import { IExecutionContext, ExecutionContext as NewExecutionContext } from './executionContext';
import { logger } from '@/utils/logger';

// Import executors
import { TriggerNodeExecutor } from './nodeExecutors/triggerExecutor';
import { OutputSenderNodeExecutor } from './nodeExecutors/outputSenderExecutor';
import { LLMChainExecutor } from './nodeExecutors/llmChainExecutor';
import { NoteNodeExecutor } from './nodeExecutors/noteExecutor';
import { ModelProviderNodeExecutor } from './nodeExecutors/modelProviderExecutor';

// Create and populate registry
const registry = new NodeExecutorRegistry();

// Register executors (using new IExecutionContext)
registry.register('trigger', new TriggerNodeExecutor());
registry.register('outputSender', new OutputSenderNodeExecutor());
registry.register('note', new NoteNodeExecutor());
registry.register('modelProvider', new ModelProviderNodeExecutor());
registry.register('basicLLMChain', new LLMChainExecutor());

/**
 * Execute a single node using the modular system
 * Supports both legacy parameters and new IExecutionContext
 */
export async function executeNodeModular(
  nodeId: string,
  nodesOrContext: Node[] | IExecutionContext,
  edges?: Edge[],
  updateNodeData?: (nodeId: string, data: Partial<UnifiedNodeData>) => void,
  executionResults?: Record<string, ExecutionResult>,
  globalVariables?: Record<string, { name: string; value: string; description?: string }>,
  setExecutionResults?: (results: Record<string, ExecutionResult>) => void,
  updateEdgeColors?: () => void,
  executeNodeRecursive?: (nodeId: string) => Promise<void>,
  interpolateTemplate?: (template: string) => string,
  addGlobalVariable?: (name: string, value: string, description?: string, folder?: string) => void,
  updateGlobalVariable?: (name: string, value: string, description?: string, folder?: string) => void
): Promise<void> {
  // Check if using new ExecutionContext or legacy parameters
  const isNewContext = !Array.isArray(nodesOrContext);
  
  let context: IExecutionContext;
  let node: Node | undefined;
  
  if (isNewContext) {
    // Using new IExecutionContext
    context = nodesOrContext as IExecutionContext;
    node = context.getNode(nodeId);
  } else {
    // Using legacy parameters - create adapter context
    const nodes = nodesOrContext as Node[];
    node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      logger.error(`Node ${nodeId} not found`);
      return;
    }
    
    // Create a temporary ExecutionContext from parameters
    // If interpolateTemplate is not provided, create a basic one that handles global variables
    const interpolateFn = interpolateTemplate || ((template: string) => {
      // Basic interpolation for global variables if no function provided
      let result = template;
      const variablePattern = /\{\{([^}]+)\}\}/g;
      result = result.replace(variablePattern, (match, varName) => {
        const trimmedName = varName.trim();
        const variable = globalVariables?.[trimmedName];
        return variable ? variable.value : match;
      });
      return result;
    });
    
    const config = {
      getNodes: () => nodes,
      getEdges: () => edges!,
      getExecutionResults: () => executionResults!,
      getGlobalVariables: () => globalVariables!,
      updateNodeData: updateNodeData!,
      setExecutionResults: setExecutionResults!,
      addGlobalVariable: addGlobalVariable || (() => {}),
      updateGlobalVariable: updateGlobalVariable || (() => {}),
      interpolateTemplate: interpolateFn,
      executeNode: executeNodeRecursive!,
      updateEdgeColors: updateEdgeColors!,
      isExecuting: false,
      setExecuting: () => {}
    };
    context = new NewExecutionContext(config);
  }
  
  if (!node) {
    logger.error(`Node ${nodeId} not found`);
    return;
  }
  
  // Skip only if already executing (not if previously executed)
  if (node.data?.isExecuting) {
    logger.dev(`Node ${nodeId} is already executing, skipping`);
    return;
  }
  
  // Find executor for this node type
  const executor = registry.getForNode(node);
  
  // If no executor found, just log and return (nodes without executors are skipped)
  if (!executor) {
    logger.dev(`No executor for node type ${node.type}, skipping`);
    // Some nodes like Group don't need execution
    return;
  }
  
  // Mark node as executing
  logger.dev(`Node ${nodeId} starting execution (modular)`);
  context.updateNodeData(nodeId, { isExecuting: true });
  
  try {
    // Execute with the new context
    await executor.execute(node, context);
    
    // Mark node as not executing
    context.updateNodeData(nodeId, { isExecuting: false });
    
    // Update edge colors
    context.updateEdgeColors();
    
    logger.dev(`Node ${nodeId} completed (modular)`);
    
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error executing node ${nodeId}:`, errorObj);
    
    const errorResult: ExecutionResult = {
      nodeId,
      success: false,
      output: undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    };
    
    // Save error result
    context.setExecutionResults({
      [nodeId]: errorResult
    });
    
    context.updateNodeData(nodeId, { 
      isExecuting: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Export registry for adding custom executors
 */
export { registry as nodeExecutorRegistry };

/**
 * Helper function to clear execution state from nodes
 */
export function clearNodeExecutionState(nodes: Node[]): Node[] {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      isExecuting: false,
      executed: false,
      error: undefined,
      lastResponse: undefined,
      lastThinking: undefined,
      lastError: undefined,
      executionStats: undefined
    }
  }));
}
