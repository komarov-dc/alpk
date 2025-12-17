import { NodeExecutor } from '../types';
import { IExecutionContext } from '../executionContext';
import { Node } from '@xyflow/react';

/**
 * ModelProviderNodeExecutor
 * 
 * This node doesn't execute any logic itself - it just provides configuration
 * for other nodes (like LLMChain) to use. During execution, we just mark it
 * as executed to show it's been processed.
 */
export class ModelProviderNodeExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'modelProvider';
  }
  
  async execute(
    node: Node,
    context: IExecutionContext
  ): Promise<void> {
    
    try {
      // Validate that the node has required configuration
      if (!node.data?.provider) {
        throw new Error('No provider selected');
      }
      
      if (!node.data?.model) {
        throw new Error('No model selected');
      }
      
      // Mark as executed with the configuration as output
      // IMPORTANT: Keep apiKey in output for LLM nodes to use (not just for display)
      const result = {
        nodeId: node.id,
        success: true,
        output: {
          type: 'modelProvider',
          provider: node.data.provider,
          model: node.data.model,
          groupId: node.data.groupId || 1,
          temperature: node.data.temperature,
          topP: node.data.topP,
          maxTokens: node.data.maxTokens,
          apiKey: node.data.apiKey, // Keep real API key for LLM nodes
          oauthToken: node.data.oauthToken, // Keep OAuth token for LLM nodes
        },
        duration: 0
      };
      
      // Pass only this node's result for atomic merging
      context.setExecutionResults({
        [node.id]: result
      });
      
      // Mark as complete - execution state is tracked via executionResults
      
    } catch (error) {
      // Mark as failed
      context.updateNodeData(node.id, { 
        error: error instanceof Error ? error.message : 'Configuration error'
      });
      
      // Pass only this node's result for atomic merging
      context.setExecutionResults({
        [node.id]: {
          nodeId: node.id,
          success: false,
          error: error instanceof Error ? error.message : 'Configuration error',
          output: undefined,
          duration: 0
        }
      });
      
      throw error;
    }
  }
}
