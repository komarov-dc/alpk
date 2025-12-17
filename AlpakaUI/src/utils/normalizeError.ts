/**
 * Utility for normalizing unknown error types to Error instances
 * Helps with consistent error handling throughout the application
 */

/**
 * Converts unknown error types to proper Error instances
 * @param error - Unknown error value from catch blocks
 * @returns Properly typed Error instance
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   logger.error('Operation failed', normalizeError(error));
 * }
 * ```
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    // Try to extract message from error-like objects
    if ('message' in error && typeof error.message === 'string') {
      return new Error(error.message);
    }

    // Try to stringify object for debugging
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error('Unknown error object');
    }
  }

  // Fallback for primitive values
  return new Error(String(error));
}

/**
 * Extracts error message from unknown error types
 * @param error - Unknown error value
 * @returns String error message
 */
export function getErrorMessage(error: unknown): string {
  return normalizeError(error).message;
}
