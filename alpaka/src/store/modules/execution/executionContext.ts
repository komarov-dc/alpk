/**
 * ExecutionContext - Dependency Injection Container for Execution System
 * 
 * This class encapsulates all dependencies needed by node executors and queue manager,
 * eliminating the need for global store access and improving testability.
 */

import { Node, Edge } from '@xyflow/react';
import { ExecutionResult, UnifiedNodeData } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Interface defining all operations needed by the execution system
 */
export interface IExecutionContext {
  // Node operations
  getNode(nodeId: string): Node | undefined;
  getNodes(): Node[];
  updateNodeData(nodeId: string, data: Partial<UnifiedNodeData>): void;
  
  // Edge operations
  getEdges(): Edge[];
  getConnectedNodes(nodeId: string, direction: 'source' | 'target'): Node[];
  
  // Execution results
  getExecutionResult(nodeId: string): ExecutionResult | undefined;
  getExecutionResults(): Record<string, ExecutionResult>;
  setExecutionResult(nodeId: string, result: ExecutionResult): void;
  setExecutionResults(results: Record<string, ExecutionResult>): void;
  
  // Variables
  getGlobalVariables(): Record<string, { name: string; value: string; description?: string; folder?: string }>;
  addGlobalVariable(name: string, value: string, description?: string, folder?: string): void;
  updateGlobalVariable(name: string, value: string, description?: string, folder?: string): void;
  
  // Template interpolation
  interpolateTemplate(template: string): string;
  
  // Workflow execution
  executeNode(nodeId: string): Promise<void>;
  
  // UI updates
  updateEdgeColors(): void;
  
  // Variable context building
  buildVariableContext(): Record<string, string>;
  
  // Execution state
  isExecuting(): boolean;
  setExecuting(value: boolean): void;
}

/**
 * Configuration for ExecutionContext - Lazy Access Pattern
 * Uses getters instead of data copies to prevent massive memory duplication
 */
export interface ExecutionContextConfig {
  // Lazy data access - no copies, only fresh data on demand
  getNodes: () => Node[];
  getEdges: () => Edge[];
  getExecutionResults: () => Record<string, ExecutionResult>;
  getGlobalVariables: () => Record<string, { name: string; value: string; description?: string; folder?: string }>;
  
  // Action callbacks remain the same
  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>) => void;
  setExecutionResults: (results: Record<string, ExecutionResult>) => void;
  addGlobalVariable: (name: string, value: string, description?: string, folder?: string) => void;
  updateGlobalVariable: (name: string, value: string, description?: string, folder?: string) => void;
  interpolateTemplate: (template: string) => string;
  executeNode: (nodeId: string) => Promise<void>;
  updateEdgeColors: () => void;
  isExecuting: boolean;
  setExecuting: (value: boolean) => void;
}

/**
 * Main ExecutionContext implementation
 */
export class ExecutionContext implements IExecutionContext {
  // Lazy data access - no data storage, only getters
  private getNodesCallback: () => Node[];
  private getEdgesCallback: () => Edge[];
  private getExecutionResultsCallback: () => Record<string, ExecutionResult>;
  private getGlobalVariablesCallback: () => Record<string, { name: string; value: string; description?: string; folder?: string }>;
  
  // Action callbacks
  private updateNodeDataCallback: (nodeId: string, data: Partial<UnifiedNodeData>) => void;
  private setExecutionResultsCallback: (results: Record<string, ExecutionResult>) => void;
  private addGlobalVariableCallback: (name: string, value: string, description?: string, folder?: string) => void;
  private updateGlobalVariableCallback: (name: string, value: string, description?: string, folder?: string) => void;
  private interpolateTemplateCallback: (template: string) => string;
  private executeNodeCallback: (nodeId: string) => Promise<void>;
  private updateEdgeColorsCallback: () => void;
  private isExecutingValue: boolean;
  private setExecutingCallback: (value: boolean) => void;
  
  constructor(config: ExecutionContextConfig) {
    // Store getter functions - NO DATA COPIES
    this.getNodesCallback = config.getNodes;
    this.getEdgesCallback = config.getEdges;
    this.getExecutionResultsCallback = config.getExecutionResults;
    this.getGlobalVariablesCallback = config.getGlobalVariables;
    
    // Store action callbacks
    this.updateNodeDataCallback = config.updateNodeData;
    this.setExecutionResultsCallback = config.setExecutionResults;
    this.addGlobalVariableCallback = config.addGlobalVariable;
    this.updateGlobalVariableCallback = config.updateGlobalVariable;
    this.interpolateTemplateCallback = config.interpolateTemplate;
    this.executeNodeCallback = config.executeNode;
    this.updateEdgeColorsCallback = config.updateEdgeColors;
    this.isExecutingValue = config.isExecuting;
    this.setExecutingCallback = config.setExecuting;
    
    // Log context creation without accessing large data
    logger.dev('ExecutionContext initialized with lazy access pattern');
  }
  
  // Node operations - using lazy access
  getNode(nodeId: string): Node | undefined {
    return this.getNodesCallback().find(n => n.id === nodeId);
  }
  
  getNodes(): Node[] {
    return this.getNodesCallback();
  }
  
  updateNodeData(nodeId: string, data: Partial<UnifiedNodeData>): void {
    this.updateNodeDataCallback(nodeId, data);
  }
  
  // Edge operations - using lazy access
  getEdges(): Edge[] {
    return this.getEdgesCallback();
  }
  
  getConnectedNodes(nodeId: string, direction: 'source' | 'target'): Node[] {
    const edges = this.getEdgesCallback();
    const nodes = this.getNodesCallback();
    const connectedNodeIds = edges
      .filter(edge => direction === 'source' ? edge.source === nodeId : edge.target === nodeId)
      .map(edge => direction === 'source' ? edge.target : edge.source);
    
    return nodes.filter(node => connectedNodeIds.includes(node.id));
  }
  
  // Execution results - using lazy access
  getExecutionResult(nodeId: string): ExecutionResult | undefined {
    return this.getExecutionResultsCallback()[nodeId];
  }
  
  getExecutionResults(): Record<string, ExecutionResult> {
    return this.getExecutionResultsCallback();
  }
  
  setExecutionResult(nodeId: string, result: ExecutionResult): void {
    // Call callback to update store directly - no local copy needed
    this.setExecutionResultsCallback({
      [nodeId]: result
    });
  }
  
  setExecutionResults(results: Record<string, ExecutionResult>): void {
    logger.dev(`[ExecutionContext] setExecutionResults called: ${Object.keys(results).length} new results`);
    // Log details separately
    Object.entries(results).forEach(([nodeId, result]) => {
      logger.dev(`  - ${nodeId}: success=${result.success}`);
    });
    // Call callback to update store directly - no local copy needed
    this.setExecutionResultsCallback(results);
  }
  
  // Variables - using lazy access
  getGlobalVariables(): Record<string, { name: string; value: string; description?: string; folder?: string }> {
    return this.getGlobalVariablesCallback();
  }
  
  addGlobalVariable(name: string, value: string, description?: string, folder?: string): void {
    // Call callback to update store directly - no local copy needed
    this.addGlobalVariableCallback(name, value, description, folder);
  }
  
  updateGlobalVariable(name: string, value: string, description?: string, folder?: string): void {
    // Call callback to update store directly - no local copy needed
    this.updateGlobalVariableCallback(name, value, description, folder);
  }
  
  // Template interpolation - uses optimized version through callback
  interpolateTemplate(template: string): string {
    return this.interpolateTemplateCallback(template);
  }
  
  // Workflow execution
  async executeNode(nodeId: string): Promise<void> {
    return this.executeNodeCallback(nodeId);
  }
  
  // UI updates
  updateEdgeColors(): void {
    this.updateEdgeColorsCallback();
  }
  
  // Variable context building - using lazy access
  buildVariableContext(): Record<string, string> {
    const context: Record<string, string> = {};
    
    // Add global variables using lazy access
    const globalVariables = this.getGlobalVariablesCallback();
    Object.entries(globalVariables).forEach(([key, variable]) => {
      context[key] = variable.value;
    });
    
    // Add execution results using lazy access
    const executionResults = this.getExecutionResultsCallback();
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      if (result.success && result.output) {
        const node = this.getNode(nodeId);
        const nodeLabel = node?.data?.label || nodeId;
        
        // Handle different output types
        if (typeof result.output === 'string') {
          context[String(nodeLabel)] = result.output;
        } else if (typeof result.output === 'object' && result.output !== null) {
          // For complex outputs, try to extract meaningful values
          const output = result.output as Record<string, unknown>;
          if ('text' in output && typeof output.text === 'string') {
            context[String(nodeLabel)] = output.text;
          } else if ('value' in output && typeof output.value === 'string') {
            context[String(nodeLabel)] = output.value;
          } else if ('response' in output && typeof output.response === 'string') {
            context[String(nodeLabel)] = output.response;
          }
        }
      }
    });
    
    return context;
  }
  
  // Execution state
  isExecuting(): boolean {
    return this.isExecutingValue;
  }
  
  setExecuting(value: boolean): void {
    this.setExecutingCallback(value);
  }
  
  /**
   * Update the context with new data (for reactive updates)
   */
  update(config: Partial<ExecutionContextConfig>): void {
    if (config.getNodes) this.getNodesCallback = config.getNodes;
    if (config.getEdges) this.getEdgesCallback = config.getEdges;
    if (config.getExecutionResults) this.getExecutionResultsCallback = config.getExecutionResults;
    if (config.getGlobalVariables) this.getGlobalVariablesCallback = config.getGlobalVariables;
    if (config.isExecuting !== undefined) this.isExecutingValue = config.isExecuting;
    
    logger.dev('ExecutionContext updated with new lazy access callbacks');
  }
  
  /**
   * Create a snapshot of the current context (useful for debugging)
   */
  snapshot(): {
    nodeCount: number;
    edgeCount: number;
    variableCount: number;
    resultCount: number;
    isExecuting: boolean;
  } {
    const nodes = this.getNodesCallback();
    const edges = this.getEdgesCallback();
    const executionResults = this.getExecutionResultsCallback();
    const globalVariables = this.getGlobalVariablesCallback();
    
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      variableCount: Object.keys(globalVariables).length,
      resultCount: Object.keys(executionResults).length,
      isExecuting: this.isExecutingValue
    };
  }
}
