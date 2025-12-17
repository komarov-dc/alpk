/**
 * Executor for Trigger nodes
 */

import { Node } from '@xyflow/react';
import { NodeExecutor } from '../types';
import { IExecutionContext } from '../executionContext';

export class TriggerNodeExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'trigger';
  }
  
  async execute(
    node: Node,
    context: IExecutionContext
  ): Promise<void> {
    
    // Trigger nodes don't produce output, just trigger execution
    const result = {
      nodeId: node.id,
      success: true,
      output: {
        type: 'trigger',
        triggered: true
      },
      duration: 0
    };
    
    // Pass only this node's result for atomic merging
    context.setExecutionResults({
      [node.id]: result
    });
    
    // Trigger complete
  }
}
