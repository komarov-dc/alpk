/**
 * Executor for Note nodes
 */

import { Node } from '@xyflow/react';
import { NodeExecutor } from '../types';
import { IExecutionContext } from '../executionContext';

export class NoteNodeExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'note';
  }
  
  async execute(
    node: Node,
    context: IExecutionContext
  ): Promise<void> {
    
    // Note nodes don't execute - they're just for documentation
    // But we need to mark them as "executed" so the flow continues
    const result = {
      nodeId: node.id,
      success: true,
      output: {
        type: 'note',
        text: String(node.data?.text || ''),
        // Notes don't produce output for other nodes
        value: null
      },
      duration: 0
    };
    
    // Pass only this node's result for atomic merging
    context.setExecutionResults({
      [node.id]: result
    });
    
    // Note complete
  }
}
