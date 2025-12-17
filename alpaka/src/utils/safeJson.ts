/**
 * Safe JSON parsing utilities with proper error handling
 */

import { logger } from '@/utils/logger';

/**
 * Safely parse JSON string with error handling
 * @param jsonString - The JSON string to parse
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T>(jsonString: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('JSON parse error:', error instanceof Error ? error.message : 'Unknown error');
    return fallback;
  }
}

/**
 * Safely parse JSON string with detailed error information
 * @param jsonString - The JSON string to parse
 * @returns Object with parsed result or error
 */
export function safeJsonParseWithError<T>(jsonString: string): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON format'
    };
  }
}

/**
 * Safely stringify JSON with error handling
 * @param value - The value to stringify
 * @param replacer - Optional replacer function or array
 * @param space - Optional space for formatting
 * @returns JSON string or undefined if error
 */
export function safeJsonStringify(
  value: unknown,
  replacer?: ((key: string, value: unknown) => unknown) | (string | number)[] | null,
  space?: string | number
): string | undefined {
  try {
    return JSON.stringify(value, replacer as never, space);
  } catch (error) {
    logger.warn('JSON stringify error:', error instanceof Error ? error.message : 'Unknown error');
    return undefined;
  }
}

/**
 * Deep clone an object using JSON serialization
 * @param obj - Object to clone
 * @returns Cloned object or undefined if error
 */
export function jsonClone<T>(obj: T): T | undefined {
  const stringified = safeJsonStringify(obj);
  if (!stringified) return undefined;
  return safeJsonParse<T>(stringified);
}
