/**
 * Common types for execution system
 * Replaces all 'any' types with proper TypeScript types
 */

// Variable types that can be stored in execution context
export type ExecutionVariable = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | ExecutionObject
  | ExecutionArray;

export interface ExecutionObject {
  [key: string]: ExecutionVariable;
}

export type ExecutionArray = ExecutionVariable[];

// Node execution context
export type NodeContext = Record<string, ExecutionVariable>;

// Event system types
export type EventPayload<T = ExecutionVariable> = T;

export interface TypedEventMap {
  'node:started': { nodeId: string; timestamp: number };
  'node:completed': { nodeId: string; result: ExecutionVariable; timestamp: number };
  'node:failed': { nodeId: string; error: Error; timestamp: number };
  'execution:started': { flowId: string; timestamp: number };
  'execution:completed': { flowId: string; timestamp: number };
  'phase:completed': { phase: string; duration: number };
  'queue:added': { nodeId: string; priority: number };
  'queue:processed': { nodeId: string };
  'metrics:updated': { metrics: Record<string, number | string> };
}

// Execution metadata
export interface ExecutionMetadata {
  executionId: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: Error;
  metrics?: Record<string, number>;
}

// Node configuration
export interface NodeConfig {
  [key: string]: ExecutionVariable;
}

// Execution options
export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  maxWorkers?: number;
  debug?: boolean;
  [key: string]: ExecutionVariable;
}

// Type guards
export function isExecutionVariable(value: unknown): value is ExecutionVariable {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined ||
    (typeof value === 'object' && (Array.isArray(value) || isPlainObject(value)))
  );
}

export function isPlainObject(value: unknown): value is ExecutionObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.constructor === Object &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

// Safe type conversion
export function toExecutionVariable(value: unknown): ExecutionVariable {
  if (isExecutionVariable(value)) {
    return value;
  }
  // Convert to string as fallback
  return String(value);
}

// Import the correct ExecutionResult from nodeTypes
// NodeExecutionResult and FlowExecutionResult extend the ExecutionResult from nodeTypes
import type { ExecutionResult } from './nodeTypes';

export interface NodeExecutionResult extends Omit<ExecutionResult, 'nodeId'> {
  nodeId: string;
  nodeType: string;
  timestamp: number;
}

export interface FlowExecutionResult {
  flowId: string;
  nodeResults: NodeExecutionResult[];
  startTime: number;
  endTime: number;
  success: boolean;
  error?: string;
}
