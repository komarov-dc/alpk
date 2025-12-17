/**
 * API Types and Response Schemas
 * Strict typing and validation for all API endpoints
 */

import { z } from 'zod';

// ============= Base Response Types =============

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
  code: z.string().optional(),
  status: z.number().optional()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiSuccessSchema = z.object({
  success: z.literal(true)
});

// ============= Projects API =============

// GET /api/projects
export const ProjectListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProjectsListResponseSchema = z.object({
  success: z.literal(true),
  projects: z.array(ProjectListItemSchema)
});

export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;
export type ProjectsListResponse = z.infer<typeof ProjectsListResponseSchema>;

// GET /api/projects/[id]
export const ProjectCanvasDataSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.unknown()),
    selected: z.boolean().optional(),
    dragging: z.boolean().optional()
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.string().optional(),
    animated: z.boolean().optional()
  })),
  executionResults: z.record(z.string(), z.object({
    nodeId: z.string(),
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
    duration: z.number().optional()
  })).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number()
  }).nullable().optional()
});

export const ProjectDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canvasData: ProjectCanvasDataSchema,
  globalVariables: z.record(z.string(), z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    folder: z.string().optional()
  })),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProjectDetailResponseSchema = z.object({
  success: z.literal(true),
  project: ProjectDetailSchema
});

export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;

// POST /api/projects
export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.unknown()),
    selected: z.boolean().optional(),
    dragging: z.boolean().optional()
  })).optional().default([]),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.string().optional(),
    animated: z.boolean().optional()
  })).optional().default([]),
  executionResults: z.record(z.string(), z.object({
    nodeId: z.string(),
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
    duration: z.number().optional()
  })).optional(),
  globalVariables: z.record(z.string(), z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    folder: z.string().optional()
  })).optional()
});

export const CreateProjectResponseSchema = z.object({
  success: z.literal(true),
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.string(), z.unknown()),
      selected: z.boolean().optional(),
      dragging: z.boolean().optional()
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
      type: z.string().optional(),
      animated: z.boolean().optional()
    })),
    createdAt: z.string(),
    updatedAt: z.string()
  })
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

// PUT /api/projects/[id]
export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.unknown()),
    selected: z.boolean().optional(),
    dragging: z.boolean().optional()
  })).optional(),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.string().optional(),
    animated: z.boolean().optional()
  })).optional(),
  executionResults: z.record(z.string(), z.object({
    nodeId: z.string(),
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
    duration: z.number().optional()
  })).optional(),
  globalVariables: z.record(z.string(), z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    folder: z.string().optional()
  })).optional()
});

export const UpdateProjectResponseSchema = z.object({
  success: z.literal(true),
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    canvasData: z.object({
      nodes: z.array(z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.string(), z.unknown()),
        selected: z.boolean().optional(),
        dragging: z.boolean().optional()
      })),
      edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
        type: z.string().optional(),
        animated: z.boolean().optional()
      })),
      executionResults: z.record(z.string(), z.object({
        nodeId: z.string(),
        success: z.boolean(),
        output: z.unknown().optional(),
        error: z.string().optional(),
        duration: z.number().optional()
      })).optional(),
      viewport: z.object({
        x: z.number(),
        y: z.number(),
        zoom: z.number()
      }).nullable().optional()
    }),
    createdAt: z.string(),
    updatedAt: z.string()
  })
});

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export type UpdateProjectResponse = z.infer<typeof UpdateProjectResponseSchema>;

// DELETE /api/projects/[id]
export const DeleteProjectResponseSchema = z.object({
  success: z.literal(true),
  message: z.string()
});

export type DeleteProjectResponse = z.infer<typeof DeleteProjectResponseSchema>;

// POST /api/projects/[id]/duplicate
export const DuplicateProjectResponseSchema = z.object({
  success: z.literal(true),
  project: ProjectDetailSchema
});

export type DuplicateProjectResponse = z.infer<typeof DuplicateProjectResponseSchema>;

// ============= Models API =============

// GET /api/models
export const ModelItemSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  size: z.number(),
  digest: z.string()
});

export const ModelsListResponseSchema = z.object({
  success: z.literal(true),
  models: z.array(ModelItemSchema),
  total: z.number(),
  fallback: z.boolean().optional()
});

export type ModelItem = z.infer<typeof ModelItemSchema>;
export type ModelsListResponse = z.infer<typeof ModelsListResponseSchema>;

// ============= Templates API =============

// GET /api/projects/templates
export const TemplateItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  nodeCount: z.number(),
  tags: z.array(z.string()),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced'])
});

export const TemplatesListResponseSchema = z.object({
  success: z.literal(true),
  templates: z.array(TemplateItemSchema)
});

export type TemplateItem = z.infer<typeof TemplateItemSchema>;
export type TemplatesListResponse = z.infer<typeof TemplatesListResponseSchema>;

// POST /api/projects/templates
export const CreateFromTemplateRequestSchema = z.object({
  templateId: z.string()
});

export const CreateFromTemplateResponseSchema = CreateProjectResponseSchema;

export type CreateFromTemplateRequest = z.infer<typeof CreateFromTemplateRequestSchema>;
export type CreateFromTemplateResponse = z.infer<typeof CreateFromTemplateResponseSchema>;

// ============= LLM Stream API =============

// POST /api/llm/stream
export const LLMStreamRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
  })),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  stream: z.boolean().optional().default(true),
  provider: z.enum(['openai', 'ollama', 'lmstudio']).optional()
});

export type LLMStreamRequest = z.infer<typeof LLMStreamRequestSchema>;

// Stream response is handled differently (SSE)
export interface LLMStreamChunk {
  type: 'token' | 'thinking' | 'done' | 'error';
  content?: string;
  error?: string;
  stats?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ============= OpenAI Models API =============

// GET /api/providers/openai/models
export const OpenAIModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  created: z.number().optional(),
  owned_by: z.string().optional()
});

export const OpenAIModelsResponseSchema = z.object({
  success: z.literal(true),
  models: z.array(OpenAIModelSchema)
});

export type OpenAIModel = z.infer<typeof OpenAIModelSchema>;
export type OpenAIModelsResponse = z.infer<typeof OpenAIModelsResponseSchema>;

// ============= Validation Helpers =============

/**
 * Validate API response with schema
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns error instead of throwing
 */
export function safeValidateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============= Type Guards =============

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as Record<string, unknown>).error === 'string'
  );
}

export function isApiSuccess(response: unknown): response is { success: true } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as Record<string, unknown>).success === true
  );
}
