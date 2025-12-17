/**
 * Common type definitions to replace generic Record<string, unknown>
 * These provide better type safety and documentation
 */

// Variable value can be various types, but we know what they are
export type VariableValue = string | number | boolean | null | undefined | object | Array<unknown>;

// Execution variables with known value types
export interface ExecutionVariables {
  [key: string]: VariableValue;
}

// Node execution results with specific structure
export interface NodeResults {
  [nodeId: string]: {
    success: boolean;
    output?: unknown;
    error?: string;
    duration?: number;
    timestamp?: string;
  };
}

// Global variables structure
export interface GlobalVariableData {
  value: string;
  description?: string;
  folder?: string;
}

export interface GlobalVariables {
  [name: string]: GlobalVariableData | string; // Can be string for backward compatibility
}

// Metrics data
export interface MetricsData {
  [key: string]: number | string | boolean;
}

// Node custom configuration
export interface NodeCustomConfig {
  [key: string]: string | number | boolean | string[] | number[];
}

// Canvas data for projects
export interface CanvasNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>; // Node-specific data varies by type
}

export interface CanvasEdgeData {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
}

// API update data
export interface ProjectUpdateData {
  name?: string;
  description?: string;
  canvasData?: {
    nodes: CanvasNodeData[];
    edges: CanvasEdgeData[];
  };
  globalVariables?: GlobalVariables;
  updatedAt?: Date;
}

// Import ExecutionStats from nodeTypes to avoid duplication
// Re-export for backward compatibility
export type { ExecutionStats } from './nodeTypes';

// LLM message structure
export interface LLMMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Provider configuration parameters
export interface ProviderParameters {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  seed?: number;
  logitBias?: Record<string, number>; // OpenAI specific
  [key: string]: number | string | boolean | string[] | Record<string, number> | undefined;
}
