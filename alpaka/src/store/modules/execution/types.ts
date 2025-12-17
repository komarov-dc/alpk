/**
 * Base types and interfaces for the execution system
 */

import { Node } from '@xyflow/react';
import { ExecutionResult, UnifiedNodeData } from '@/types';
import { IExecutionContext } from './executionContext';

/**
 * Base interface for all node executors
 */
export interface NodeExecutor {
  /**
   * Check if this executor can handle the given node
   */
  canExecute(node: Node): boolean;
  
  /**
   * Execute the node and save results via context
   */
  execute(
    node: Node,
    context: IExecutionContext
  ): Promise<void>;
  
  /**
   * Optional: Build dependencies for this node type
   */
  getDependencies?(node: Node): string[];
}

/**
 * Helper functions available during execution
 */
export interface ExecutionHelpers {
  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>) => void;
  setExecutionResults: (results: Record<string, ExecutionResult>) => void;
  updateEdgeColors: () => void;
  buildVariableContext: () => Record<string, string>;
  
  // For recursive execution
  executeNode?: (nodeId: string) => Promise<void>;
}

/**
 * Registry for node executors
 */
export class NodeExecutorRegistry {
  private executors: Map<string, NodeExecutor> = new Map();
  
  register(nodeType: string, executor: NodeExecutor): void {
    this.executors.set(nodeType, executor);
  }
  
  get(nodeType: string): NodeExecutor | undefined {
    return this.executors.get(nodeType);
  }
  
  getForNode(node: Node): NodeExecutor | undefined {
    // First try exact type match
    const executor = this.executors.get(node.type || '');
    if (executor) return executor;
    
    // Then try to find executor that can handle this node
    for (const exec of this.executors.values()) {
      if (exec.canExecute(node)) {
        return exec;
      }
    }
    
    return undefined;
  }
}
