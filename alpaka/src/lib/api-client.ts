/**
 * Typed API Client
 * Provides type-safe methods for all API endpoints
 */

import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  ProjectsListResponse,
  ProjectDetailResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  DeleteProjectResponse,
  DuplicateProjectResponse,
  ModelsListResponse,
  TemplatesListResponse,
  CreateFromTemplateRequest,
  CreateFromTemplateResponse,
  LLMStreamRequest,
  OpenAIModelsResponse,
  ApiError,
  validateApiResponse,
  ProjectsListResponseSchema,
  ProjectDetailResponseSchema,
  CreateProjectResponseSchema,
  UpdateProjectResponseSchema,
  DeleteProjectResponseSchema,
  DuplicateProjectResponseSchema,
  ModelsListResponseSchema,
  TemplatesListResponseSchema,
  CreateFromTemplateResponseSchema,
  OpenAIModelsResponseSchema
} from '@/types/api';

class ApiClient {
  private baseUrl: string = '';

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '';
  }

  private async handleResponse<T>(
    response: Response,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`
      }));
      throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    
    // Validate response with schema
    try {
      return validateApiResponse(schema, data);
    } catch (validationError) {
      logger.error('API response validation failed:', validationError as Error);
      // Return data as-is if validation fails in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Returning unvalidated response:', data);
        return data as T;
      }
      throw validationError;
    }
  }

  // ============= Projects API =============

  async getProjects(): Promise<ProjectsListResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects`);
    return this.handleResponse<ProjectsListResponse>(
      response,
      ProjectsListResponseSchema
    );
  }

  async getProject(id: string): Promise<ProjectDetailResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`);
    return this.handleResponse<ProjectDetailResponse>(
      response,
      ProjectDetailResponseSchema
    );
  }

  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return this.handleResponse<CreateProjectResponse>(
      response,
      CreateProjectResponseSchema
    );
  }

  async updateProject(
    id: string,
    data: UpdateProjectRequest
  ): Promise<UpdateProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return this.handleResponse<UpdateProjectResponse>(
      response,
      UpdateProjectResponseSchema
    );
  }

  async deleteProject(id: string): Promise<DeleteProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`, {
      method: 'DELETE'
    });
    return this.handleResponse<DeleteProjectResponse>(
      response,
      DeleteProjectResponseSchema
    );
  }

  async duplicateProject(id: string): Promise<DuplicateProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}/duplicate`, {
      method: 'POST'
    });
    return this.handleResponse<DuplicateProjectResponse>(
      response,
      DuplicateProjectResponseSchema
    );
  }

  // ============= Models API =============

  async getModels(): Promise<ModelsListResponse> {
    const response = await fetch(`${this.baseUrl}/api/models`);
    return this.handleResponse<ModelsListResponse>(
      response,
      ModelsListResponseSchema
    );
  }

  async getOpenAIModels(): Promise<OpenAIModelsResponse> {
    const response = await fetch(`${this.baseUrl}/api/providers/openai/models`);
    return this.handleResponse<OpenAIModelsResponse>(
      response,
      OpenAIModelsResponseSchema
    );
  }

  // ============= Templates API =============

  async getTemplates(): Promise<TemplatesListResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/templates`);
    return this.handleResponse<TemplatesListResponse>(
      response,
      TemplatesListResponseSchema
    );
  }

  async createFromTemplate(
    data: CreateFromTemplateRequest
  ): Promise<CreateFromTemplateResponse> {
    const response = await fetch(`${this.baseUrl}/api/projects/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return this.handleResponse<CreateFromTemplateResponse>(
      response,
      CreateFromTemplateResponseSchema
    );
  }

  // ============= LLM Stream API =============

  async* streamLLM(data: LLMStreamRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/llm/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                yield parsed.content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============= Error Handling =============

  isApiError(error: unknown): error is ApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as Record<string, unknown>).error === 'string'
    );
  }

  getErrorMessage(error: unknown): string {
    if (this.isApiError(error)) {
      return error.error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred';
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };
