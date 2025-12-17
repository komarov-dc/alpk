/**
 * Type definitions and guards for Prisma JSON fields
 */

import { Prisma } from '@prisma/client';

// Canvas data structure stored in database
export interface CanvasData {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
  }>;
  executionResults?: Record<string, unknown>;
  viewport?: { x: number; y: number; zoom: number } | null;
}

// Global variable data structure
export interface GlobalVariableData {
  value: string;
  type?: string;
  description?: string;
  folder?: string;
}

// Type guard for CanvasData
export function isCanvasData(data: unknown): data is CanvasData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  // Check if nodes array exists and is valid
  if (!Array.isArray(obj.nodes)) {
    return false;
  }
  
  // Check if edges array exists and is valid
  if (!Array.isArray(obj.edges)) {
    return false;
  }
  
  return true;
}

// Type guard for GlobalVariableData
export function isGlobalVariableData(data: unknown): data is GlobalVariableData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  // value must be a string
  if (typeof obj.value !== 'string') {
    return false;
  }
  
  // type is optional but must be string if present
  if (obj.type !== undefined && typeof obj.type !== 'string') {
    return false;
  }
  
  // description is optional but must be string if present
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }
  
  // folder is optional but must be string if present
  if (obj.folder !== undefined && typeof obj.folder !== 'string') {
    return false;
  }
  
  return true;
}

// Safe accessor for Prisma JSON fields
export function getPrismaCanvasData(jsonValue: Prisma.JsonValue | null): CanvasData | null {
  if (!jsonValue) {
    return null;
  }
  
  if (isCanvasData(jsonValue)) {
    return jsonValue;
  }
  
  // Return default structure if invalid
  return {
    nodes: [],
    edges: [],
    executionResults: {},
    viewport: null
  };
}

// Safe accessor for global variable data
export function getPrismaGlobalVariable(jsonValue: unknown): GlobalVariableData {
  if (isGlobalVariableData(jsonValue)) {
    return jsonValue;
  }
  
  // If it's a string, treat it as the value
  if (typeof jsonValue === 'string') {
    return { value: jsonValue };
  }
  
  // Default fallback
  return { value: '' };
}
