import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { ZodError } from 'zod';

/**
 * Custom API error class for standardized error responses
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a 400 Bad Request error
   */
  static badRequest(message: string = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  /**
   * Creates a 401 Unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  /**
   * Creates a 403 Forbidden error
   */
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  /**
   * Creates a 404 Not Found error
   */
  static notFound(message: string = 'Not found'): ApiError {
    return new ApiError(404, message);
  }

  /**
   * Creates a 409 Conflict error
   */
  static conflict(message: string = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, message, details);
  }

  /**
   * Creates a 422 Unprocessable Entity error (validation error)
   */
  static validationError(message: string = 'Validation error', details?: unknown): ApiError {
    return new ApiError(422, message, details);
  }

  /**
   * Creates a 500 Internal Server Error
   */
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }

  /**
   * Converts error to JSON response
   */
  toJSON() {
    return {
      error: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  /**
   * Converts error to NextResponse
   */
  toResponse(): NextResponse {
    return NextResponse.json(this.toJSON(), { status: this.statusCode });
  }
}

/**
 * Handles API errors and returns appropriate NextResponse
 *
 * @param error - The error to handle
 * @param context - Optional context for logging
 * @returns NextResponse with error details
 *
 * @example
 * ```typescript
 * try {
 *   // ... API logic
 * } catch (error) {
 *   return handleApiError(error, 'UserAPI');
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // Handle ApiError
  if (error instanceof ApiError) {
    logger.warn('API error', {
      context,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details ? JSON.stringify(error.details) : undefined,
    });
    return error.toResponse();
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn('Validation error', { context, details: JSON.stringify(details) });

    return NextResponse.json(
      {
        error: 'Validation error',
        details,
      },
      { status: 400 }
    );
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(
    `Unhandled API error${context ? ` in ${context}` : ''}: ${errorMessage}`,
    normalizeError(error)
  );

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  return NextResponse.json(
    {
      error: isProduction ? 'Internal server error' : errorMessage,
      ...(!isProduction && errorStack ? { stack: errorStack } : {}),
    },
    { status: 500 }
  );
}

/**
 * Async error handler wrapper for API routes
 *
 * @param handler - Async function to wrap
 * @param context - Optional context for error logging
 * @returns Wrapped function that handles errors automatically
 *
 * @example
 * ```typescript
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * }, 'GetUserAPI');
 * ```
 */
export function withErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}
