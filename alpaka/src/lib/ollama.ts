import { OllamaGenerateRequest, OllamaGenerateResponse } from "@/types";

import { API_CONFIG } from "@/config/constants";

const OLLAMA_BASE_URL = API_CONFIG.OLLAMA_BASE_URL;

// ============================================================================
// Таймауты для Ollama API
// ============================================================================
const OLLAMA_GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут для генерации (локальные модели могут быть медленными)
const OLLAMA_MODELS_TIMEOUT_MS = 10 * 1000; // 10 секунд для списка моделей
const OLLAMA_HEALTH_TIMEOUT_MS = 5 * 1000; // 5 секунд для проверки здоровья

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

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async generate(
    request: OllamaGenerateRequest,
  ): Promise<OllamaGenerateResponse> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
        OLLAMA_GENERATE_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      if (request.stream) {
        // Handle streaming response
        return this.handleStreamingResponse(response);
      } else {
        // Handle non-streaming response
        return await response.json();
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleStreamingResponse(
    response: Response,
  ): Promise<OllamaGenerateResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body available for streaming");
    }

    const decoder = new TextDecoder();
    let fullResponse = "";
    let lastChunk: OllamaGenerateResponse | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed: OllamaGenerateResponse = JSON.parse(line);
            fullResponse += parsed.response;
            lastChunk = parsed;
          } catch {
            // Skip invalid JSON lines - this is expected for partial chunks
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!lastChunk) {
      throw new Error("No valid response received from stream");
    }

    return {
      ...lastChunk,
      response: fullResponse,
    };
  }

  async listModels(): Promise<{
    models: Array<{ name: string; size: number; digest: string }>;
  }> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        {},
        OLLAMA_MODELS_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to pull model: ${response.status} ${response.statusText}`,
        );
      }

      // Handle streaming response for model pulling progress
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          decoder.decode(value); // Process streaming chunk
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        {},
        OLLAMA_HEALTH_TIMEOUT_MS,
      );
      return response.ok;
    } catch {
      // Health check failed - expected when Ollama is not running
      return false;
    }
  }
}

// Singleton instance
export const ollamaClient = new OllamaClient();
