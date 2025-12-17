// OpenAI Provider Integration

import { ModelInfo } from "@/components/nodes/ModelProvider/types";
import { API_URLS } from "@/config/api";
import { logger } from "@/utils/logger";

// ============================================================================
// Таймауты для OpenAI API
// ============================================================================
const OPENAI_TIMEOUT_MS = 2 * 60 * 1000; // 2 минуты для обычных запросов
const OPENAI_MODELS_TIMEOUT_MS = 30 * 1000; // 30 секунд для списка моделей

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}

export interface OpenAIRequestParams {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  seed?: number;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  response_format?: { type: "text" | "json_object" };
  // o1 models
  reasoning_effort?: "low" | "medium" | "high";
}

export class OpenAIProvider {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.config.baseURL || API_URLS.OPENAI_BASE_URL}/models`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            ...(this.config.organization && {
              "OpenAI-Organization": this.config.organization,
            }),
          },
        },
        OPENAI_MODELS_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      return data.data.map(
        (model: { id: string; created: number; owned_by: string }) => ({
          id: model.id,
          name: model.id,
          provider: "openai" as const,
          description: `OpenAI model: ${model.id}`,
          contextLength: this.getContextLength(model.id),
          capabilities: this.getModelCapabilities(model.id),
        }),
      );
    } catch (error) {
      logger.error("Failed to fetch OpenAI models:", error as Error);
      return [];
    }
  }

  async sendRequest(params: OpenAIRequestParams): Promise<{
    choices: Array<{ message: { content: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    const response = await fetchWithTimeout(
      `${this.config.baseURL || API_URLS.OPENAI_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          ...(this.config.organization && {
            "OpenAI-Organization": this.config.organization,
          }),
        },
        body: JSON.stringify({
          ...params,
          stream: false, // For now, disable streaming
        }),
      },
      OPENAI_TIMEOUT_MS,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `OpenAI API error: ${error.error?.message || response.statusText}`,
      );
    }

    return response.json();
  }

  private getContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 16385,
      "o1-preview": 128000,
      "o1-mini": 128000,
    };

    // Find matching model or default
    const exactMatch = contextLengths[modelId];
    if (exactMatch) return exactMatch;

    // Check for partial matches
    for (const [key, length] of Object.entries(contextLengths)) {
      if (modelId.includes(key)) {
        return length;
      }
    }

    return 4096; // Default
  }

  private getModelCapabilities(modelId: string) {
    const isO1Model = modelId.includes("o1");
    const isGPT4 = modelId.includes("gpt-4");
    const isVisionModel =
      modelId.includes("gpt-4") && !modelId.includes("gpt-4-32k");

    return {
      chat: true,
      completion: !isO1Model, // o1 models don't support completion
      vision: isVisionModel,
      functionCalling: isGPT4 && !isO1Model,
      reasoning: isO1Model,
    };
  }
}
