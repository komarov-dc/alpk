// Yandex Cloud Provider Integration
// Uses OpenAI-compatible API

import { ModelInfo } from "@/components/nodes/ModelProvider/types";
import { logger } from "@/utils/logger";

/**
 * Get base URL for API calls
 * In standalone/server mode, we need full URL
 */
function getBaseUrl(): string {
  // Check if we're in browser
  if (typeof window !== "undefined") {
    return ""; // Browser can use relative URLs
  }

  // Server-side: use environment variable or default
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 3000}`
  );
}

export interface YandexCloudConfig {
  oauthToken?: string;
  apiKey?: string;
  folderId: string;
  baseURL?: string;
}

export interface YandexCloudRequestParams {
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
  stream?: boolean;
  // GPT-OSS reasoning parameters
  reasoning?: {
    exclude?: boolean; // Exclude reasoning from response
  };
}

export class YandexCloudProvider {
  private config: YandexCloudConfig;
  private baseURL: string;

  constructor(config: YandexCloudConfig) {
    this.config = config;
    this.baseURL = config.baseURL || "https://llm.api.cloud.yandex.net/v1";
  }

  async getModels(): Promise<ModelInfo[]> {
    // Yandex Cloud doesn't provide a models list endpoint
    // Return predefined list of available models
    return [
      {
        id: `gpt://${this.config.folderId}/gpt-oss-120b/latest`,
        name: "GPT-OSS 120B",
        provider: "yandex" as const,
        description: "OpenAI GPT-OSS 120B with Chain-of-Thought reasoning",
        contextLength: 8192,
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: true,
        },
      },
      {
        id: `gpt://${this.config.folderId}/gpt-oss-20b/latest`,
        name: "GPT-OSS 20B",
        provider: "yandex" as const,
        description: "OpenAI GPT-OSS 20B with Chain-of-Thought reasoning",
        contextLength: 8192,
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: true,
        },
      },
      {
        id: `gpt://${this.config.folderId}/qwen3-235b-a22b-fp8/latest`,
        name: "Qwen3 235B (FP8)",
        provider: "yandex" as const,
        description: "Yandex Cloud Foundation Models - Qwen3 235B",
        contextLength: 32768,
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: false,
        },
      },
      {
        id: `gpt://${this.config.folderId}/qwen2.5-coder-32b-instruct/latest`,
        name: "Qwen2.5 Coder 32B",
        provider: "yandex" as const,
        description: "Yandex Cloud Foundation Models - Qwen2.5 Coder 32B",
        contextLength: 32768,
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: false,
        },
      },
      {
        id: `gpt://${this.config.folderId}/yandexgpt/latest`,
        name: "YandexGPT",
        provider: "yandex" as const,
        description: "Yandex Cloud Foundation Models - YandexGPT",
        contextLength: 8192,
        capabilities: {
          chat: true,
          completion: true,
          vision: false,
          functionCalling: false,
          reasoning: false,
        },
      },
      {
        id: `gpt://${this.config.folderId}/yandexgpt-lite/latest`,
        name: "YandexGPT Lite",
        provider: "yandex" as const,
        description: "Yandex Cloud Foundation Models - YandexGPT Lite",
        contextLength: 8192,
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

  async sendRequest(params: YandexCloudRequestParams): Promise<{
    choices: Array<{
      message: {
        role: string;
        content: string;
        reasoning_content?: string; // GPT-OSS Chain-of-Thought reasoning
      };
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    try {
      // Convert params to OpenAI-compatible format
      const openaiParams = {
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        top_p: params.top_p,
        max_tokens: params.max_tokens,
        stream: params.stream || false,
        stop: params.stop,
      };

      // Use our API proxy to avoid CORS issues and handle OAuth->IAM conversion
      const baseUrl = getBaseUrl();

      // Only include tokens if they are defined (not undefined/null)
      // This allows API route to fall back to process.env
      const requestBody: Record<string, unknown> = {
        ...openaiParams,
        folderId: this.config.folderId,
      };

      if (this.config.oauthToken) {
        requestBody.oauthToken = this.config.oauthToken;
      }
      if (this.config.apiKey) {
        requestBody.apiKey = this.config.apiKey;
      }

      const response = await fetch(
        `${baseUrl}/api/providers/yandex/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Yandex Cloud API error: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error("Yandex Cloud API request failed:", error as Error);
      throw error;
    }
  }

  /**
   * Stream request support for Yandex Cloud
   */
  async *streamRequest(
    params: YandexCloudRequestParams,
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Yandex Cloud API error: ${response.status} - ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
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
}
