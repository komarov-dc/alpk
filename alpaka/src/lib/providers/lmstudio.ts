// LM Studio Provider Integration

import { ModelInfo } from "@/components/nodes/ModelProvider/types";
import { API_URLS } from "@/config/api";
import { logger } from "@/utils/logger";

// ============================================================================
// Таймауты для LM Studio API
// ============================================================================
const LMSTUDIO_TIMEOUT_MS = 2 * 60 * 1000; // 2 минуты для запросов
const LMSTUDIO_MODELS_TIMEOUT_MS = 10 * 1000; // 10 секунд для списка моделей
const LMSTUDIO_CONNECTION_TIMEOUT_MS = 5 * 1000; // 5 секунд для проверки соединения

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

export interface LMStudioConfig {
  baseURL: string;
}

export interface LMStudioRequestParams {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  seed?: number;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  typical_p?: number;
}

export class LMStudioProvider {
  private config: LMStudioConfig;

  constructor(
    config: LMStudioConfig = { baseURL: API_URLS.LMSTUDIO_BASE_URL },
  ) {
    this.config = config;
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.config.baseURL}/models`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
        LMSTUDIO_MODELS_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status}`);
      }

      const data = await response.json();

      return data.data.map((model: { id: string }) => ({
        id: model.id,
        name: model.id,
        provider: "lmstudio" as const,
        description: `Local model: ${model.id}`,
        contextLength: 4096, // Default, LM Studio doesn't provide this info
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: false,
        },
      }));
    } catch (error) {
      logger.error("Failed to fetch LM Studio models:", error as Error);
      // Return default if server is not available
      return [
        {
          id: "local-model",
          name: "Local Model",
          provider: "lmstudio",
          description: "Currently loaded model in LM Studio",
          contextLength: 4096,
          capabilities: {
            chat: true,
            completion: true,
            vision: false,
            functionCalling: false,
            reasoning: false,
          },
        },
      ];
    }
  }

  async sendRequest(params: LMStudioRequestParams): Promise<{
    choices: Array<{ message: { content: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    const baseURL = this.config.baseURL || `${API_URLS.LMSTUDIO_BASE_URL}/v1`;
    const response = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...params,
          stream: false, // For now, disable streaming
        }),
      },
      LMSTUDIO_TIMEOUT_MS,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.config.baseURL}/v1/models`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
        LMSTUDIO_CONNECTION_TIMEOUT_MS,
      );
      return response.ok;
    } catch {
      // Connection check failed - expected when LM Studio is not running
      return false;
    }
  }

  getEndpoint(): string {
    return this.config.baseURL;
  }
}
