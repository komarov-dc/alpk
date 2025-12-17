/**
 * Strict types for data structures throughout the application
 */

import type { ExecutionVariable } from './execution';

// Generic data object that can hold execution variables
export type DataObject = Record<string, ExecutionVariable>;

// Node data specific types
export interface NodeData extends DataObject {
  nodeId?: string;
  nodeType?: string;
  label?: string;
  inputs?: DataObject;
  outputs?: DataObject;
  config?: NodeConfig;
}

// Node configuration
export interface NodeConfig extends DataObject {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  userPrompt?: string;
  [key: string]: ExecutionVariable;
}

// Model parameters
export interface ModelParameters extends DataObject {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  [key: string]: ExecutionVariable;
}

// API response types
export interface ApiResponse<T = DataObject> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Project data types - not extending DataObject to avoid index signature conflicts  
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  nodes?: NodeData[];
  edges?: EdgeData[];
  variables?: DataObject;
}

// Edge data types - not extending DataObject to avoid index signature conflicts
export interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  [key: string]: ExecutionVariable;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Type guards
export function isDataObject(value: unknown): value is DataObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

export function isNodeData(value: unknown): value is NodeData {
  if (!isDataObject(value)) return false;
  return true; // Can add more specific checks if needed
}

// Safe conversion
export function toDataObject(value: unknown): DataObject {
  if (isDataObject(value)) {
    const result: DataObject = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof key === 'string') {
        result[key] = val as ExecutionVariable;
      }
    }
    return result;
  }
  return {};
}
