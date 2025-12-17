/**
 * Strict types for logger system
 */

// Serializable types that can be logged
export type LoggableValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | Date
  | Error
  | LoggableObject
  | LoggableArray;

export interface LoggableObject {
  [key: string]: LoggableValue;
}

export type LoggableArray = LoggableValue[];

// Error types
export type LoggableError = Error | string | {
  message: string;
  stack?: string;
  code?: string | number;
  [key: string]: LoggableValue;
};

// Table data for console.table
export type TableData = Record<string, LoggableValue>[] | LoggableObject;

// Type guards
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isLoggableError(value: unknown): value is LoggableError {
  if (isError(value)) return true;
  if (typeof value === 'string') return true;
  if (value && typeof value === 'object' && 'message' in value) {
    const obj = value as { message: unknown };
    return typeof obj.message === 'string';
  }
  return false;
}

export function toLoggableValue(value: unknown): LoggableValue {
  // Handle basic types
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  
  // Handle Date
  if (value instanceof Date) {
    return value;
  }
  
  // Handle Error
  if (value instanceof Error) {
    return value;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => toLoggableValue(item));
  }
  
  // Handle plain objects
  if (value && typeof value === 'object' && value.constructor === Object) {
    const result: LoggableObject = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toLoggableValue(val);
    }
    return result;
  }
  
  // Fallback to string representation
  return String(value);
}
