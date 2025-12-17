/**
 * Comprehensive validation utilities for user inputs, API responses, and file uploads
 */

import { z } from 'zod';

// ============================================
// Base Validators
// ============================================

/**
 * Validates that a value is a non-empty string
 */
export const nonEmptyString = z.string().min(1, 'Value cannot be empty');

/**
 * Validates that a value is a valid email
 */
export const emailValidator = z.string().email('Invalid email format');

/**
 * Validates that a value is a valid URL
 */
export const urlValidator = z.string().url('Invalid URL format').or(z.string().length(0));

/**
 * Validates that a value is a valid UUID
 */
export const uuidValidator = z.string().uuid('Invalid UUID format');

/**
 * Validates that a value is a safe integer
 */
export const safeIntegerValidator = z.number().int().safe();

/**
 * Validates that a value is a positive number
 */
export const positiveNumberValidator = z.number().positive();

// ============================================
// Project Validators
// ============================================

/**
 * Project name validator
 */
export const projectNameValidator = z.string()
  .min(1, 'Project name is required')
  .max(100, 'Project name must be less than 100 characters')
  .regex(/^[\p{L}\p{N}\s\-_]+$/u, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores');

/**
 * Project description validator
 */
export const projectDescriptionValidator = z.string()
  .max(500, 'Description must be less than 500 characters')
  .optional();

/**
 * Node data validator
 */
export const nodeValidator = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.record(z.string(), z.unknown()).optional(),
  selected: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

/**
 * Edge data validator
 */
export const edgeValidator = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.string(), z.unknown()).optional()
});

/**
 * Viewport validator
 */
export const viewportValidator = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.02).max(4)
}).nullable().optional();

/**
 * Canvas data validator
 */
export const canvasDataValidator = z.object({
  nodes: z.array(nodeValidator),
  edges: z.array(edgeValidator),
  executionResults: z.record(z.string(), z.unknown()).optional(),
  viewport: viewportValidator
});

/**
 * Global variable validator - handles both string values and structured objects
 */
export const globalVariableValidator = z.union([
  // Simple string value (legacy format)
  z.string(),
  // Structured object (new format)
  z.object({
    name: z.string().min(1).optional(), // name might be the key
    value: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
    folder: z.string().optional()
  })
]);

/**
 * Create project request validator
 */
export const createProjectValidator = z.object({
  name: projectNameValidator,
  description: projectDescriptionValidator,
  nodes: z.array(nodeValidator).optional().default([]),
  edges: z.array(edgeValidator).optional().default([]),
  executionResults: z.record(z.string(), z.unknown()).optional().default({}),
  globalVariables: z.record(z.string(), globalVariableValidator).optional().default({}),
  viewport: viewportValidator
});

/**
 * Update project request validator
 */
export const updateProjectValidator = z.object({
  name: projectNameValidator.optional(),
  description: projectDescriptionValidator,
  nodes: z.array(nodeValidator).optional(),
  edges: z.array(edgeValidator).optional(),
  executionResults: z.record(z.string(), z.unknown()).optional(),
  globalVariables: z.record(z.string(), globalVariableValidator).optional(),
  viewport: viewportValidator
});

// ============================================
// LLM/Model Validators
// ============================================

/**
 * LLM message validator
 */
export const llmMessageValidator = z.object({
  id: z.string().optional(),
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

/**
 * Model provider validator
 */
export const modelProviderValidator = z.enum(['ollama', 'openai', 'anthropic', 'lmstudio', 'yandex']);

/**
 * Model configuration validator
 */
export const modelConfigValidator = z.object({
  provider: modelProviderValidator,
  model: z.string().min(1, 'Model name is required'),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
  stopSequences: z.array(z.string()).optional()
});

/**
 * LLM request validator
 */
export const llmRequestValidator = z.object({
  messages: z.array(llmMessageValidator).min(1, 'At least one message is required'),
  modelConfig: modelConfigValidator,
  stream: z.boolean().optional()
});

// ============================================
// File Upload Validators
// ============================================

/**
 * Allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'text/markdown', 'application/json'],
  code: ['text/javascript', 'text/typescript', 'text/html', 'text/css', 'application/x-python-code']
} as const;

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * File upload validator
 */
export const fileUploadValidator = z.object({
  name: z.string().min(1),
  type: z.string(),
  size: z.number().max(MAX_FILE_SIZE, `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`),
  content: z.instanceof(Buffer).or(z.instanceof(ArrayBuffer)).or(z.string())
});

/**
 * Validates file type against allowed types
 */
export function validateFileType(fileType: string, category?: keyof typeof ALLOWED_FILE_TYPES): boolean {
  if (category) {
    return ALLOWED_FILE_TYPES[category].includes(fileType as never);
  }

  // Check all categories
  return Object.values(ALLOWED_FILE_TYPES).flat().includes(fileType as never);
}

// ============================================
// Sanitization Functions
// ============================================

/**
 * Sanitizes a string by removing potential XSS vectors
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitizes HTML content
 */
export function sanitizeHtml(input: string): string {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Sanitizes JSON string
 */
export function sanitizeJson(input: string): string {
  try {
    // Parse and re-stringify to remove any non-JSON content
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('Invalid JSON format');
  }
}

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validates and sanitizes project data
 */
export function validateProjectData(data: unknown): z.infer<typeof createProjectValidator> {
  const result = createProjectValidator.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Invalid project data', result.error.issues);
  }

  // Additional sanitization
  return {
    ...result.data,
    name: sanitizeString(result.data.name),
    description: result.data.description ? sanitizeString(result.data.description) : undefined
  };
}

/**
 * Validates and sanitizes update project data
 */
export function validateUpdateProjectData(data: unknown): z.infer<typeof updateProjectValidator> {
  const result = updateProjectValidator.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Invalid project update data', result.error.issues);
  }

  // Additional sanitization
  const sanitized: z.infer<typeof updateProjectValidator> = { ...result.data };
  if (sanitized.name) {
    sanitized.name = sanitizeString(sanitized.name);
  }
  if (sanitized.description !== undefined) {
    sanitized.description = sanitized.description ? sanitizeString(sanitized.description) : undefined;
  }

  return sanitized;
}

/**
 * Validates LLM request data
 */
export function validateLLMRequest(data: unknown): z.infer<typeof llmRequestValidator> {
  const result = llmRequestValidator.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Invalid LLM request', result.error.issues);
  }

  // Sanitize message content
  return {
    ...result.data,
    messages: result.data.messages.map(msg => ({
      ...msg,
      content: sanitizeString(msg.content)
    }))
  };
}

/**
 * Validates file upload
 */
export function validateFileUpload(file: unknown, category?: keyof typeof ALLOWED_FILE_TYPES): z.infer<typeof fileUploadValidator> {
  const result = fileUploadValidator.safeParse(file);

  if (!result.success) {
    throw new ValidationError('Invalid file upload', result.error.issues);
  }

  // Validate file type
  if (!validateFileType(result.data.type, category)) {
    throw new ValidationError(`File type ${result.data.type} is not allowed`);
  }

  return result.data;
}

// ============================================
// Custom Error Class
// ============================================

export class ValidationError extends Error {
  public errors?: z.ZodIssue[];

  constructor(message: string, errors?: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors?.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    };
  }
}

// ============================================
// Rate Limiting Validators
// ============================================

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  api: {
    requests: 100, // requests per window
    window: 60 * 1000 // 1 minute
  },
  llm: {
    requests: 10,
    window: 60 * 1000 // 1 minute
  },
  fileUpload: {
    requests: 5,
    window: 60 * 1000 // 1 minute
  }
} as const;

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isAllowed(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < window);

    if (validRequests.length >= limit) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  reset(key: string) {
    this.requests.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Check rate limit for a given key and type
 */
export function checkRateLimit(key: string, type: keyof typeof RATE_LIMITS = 'api'): boolean {
  const config = RATE_LIMITS[type];
  return rateLimiter.isAllowed(key, config.requests, config.window);
}

// ============================================
// Export all validators
// ============================================

export const validators = {
  // Base
  nonEmptyString,
  emailValidator,
  urlValidator,
  uuidValidator,
  safeIntegerValidator,
  positiveNumberValidator,

  // Project
  projectNameValidator,
  projectDescriptionValidator,
  nodeValidator,
  edgeValidator,
  canvasDataValidator,
  globalVariableValidator,
  createProjectValidator,
  updateProjectValidator,

  // LLM
  llmMessageValidator,
  modelProviderValidator,
  modelConfigValidator,
  llmRequestValidator,

  // File
  fileUploadValidator
};
