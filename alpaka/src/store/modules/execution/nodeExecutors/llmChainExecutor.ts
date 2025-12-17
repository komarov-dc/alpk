/**
 * Executor for Basic LLM Chain nodes
 */

import { Node } from "@xyflow/react";
import { NodeExecutor } from "../types";
import { IExecutionContext } from "../executionContext";
import { logger } from "@/utils/logger";
import {
  sendOllamaRequest,
  ModelProviderConfig,
  buildOllamaParams,
} from "@/utils/gptOssUtils";
import { OpenAIProvider, OpenAIRequestParams } from "@/lib/providers/openai";
import {
  LMStudioProvider,
  LMStudioRequestParams,
} from "@/lib/providers/lmstudio";
import {
  YandexCloudProvider,
  YandexCloudRequestParams,
} from "@/lib/providers/yandex";
import { API_URLS } from "@/config/api";
import { LLMNodeData, ModelProviderData } from "@/types/nodeTypes";

// Type definitions for LLM nodes
interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  response: string;
  thinking?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// Type guards
function isLLMNodeData(data: unknown): data is LLMNodeData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as Record<string, unknown>).type === "basicLLMChain" &&
    "messages" in data
  );
}

function isModelProviderData(data: unknown): data is ModelProviderData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as Record<string, unknown>).type === "modelProvider" &&
    "provider" in data &&
    "model" in data
  );
}

function isProviderResponse(response: unknown): response is {
  choices: Array<{
    message: {
      content: string;
      reasoning?: string;
      reasoning_content?: string;
    };
  }>;
} {
  return (
    typeof response === "object" &&
    response !== null &&
    "choices" in response &&
    Array.isArray((response as Record<string, unknown>).choices)
  );
}

// Helper functions
function getStringValue(value: unknown, defaultValue: string = ""): string {
  return typeof value === "string" ? value : defaultValue;
}

function getNumberValue(value: unknown, defaultValue: number = 0): number {
  return typeof value === "number" ? value : defaultValue;
}

function getArrayValue<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}

// Retry configuration interface
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  maxTotalTime: number; // Максимальное общее время на все retry
  jitterPercent: number;
  transientPatterns: string[];
  permanentPatterns: string[];
}

// Default retry configuration for LLM requests
const DEFAULT_LLM_RETRY_CONFIG: RetryConfig = {
  maxRetries: 20, // Разумное количество retry
  baseDelay: 1000, // 1 секунда (быстрее начинаем)
  maxDelay: 30000, // 30 секунд макс между retry
  maxTotalTime: 5 * 60 * 1000, // 5 минут максимум на все retry
  jitterPercent: 25, // ±25% jitter
  transientPatterns: [
    // Network errors
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ENETUNREACH",
    "timeout",
    "timed out",
    "connection reset",
    "connection refused",
    "network error",
    "socket hang up",
    "connect ETIMEDOUT",
    "fetch failed",
    "typeerror: fetch failed",

    // HTTP gateway errors
    "502",
    "503",
    "504",
    "bad gateway",
    "service unavailable",
    "gateway timeout",

    // Rate limiting
    "429",
    "rate limit",
    "rate_limit_exceeded",
    "too many requests",
    "rate limit exceeded",
    "quota exceeded",

    // Temporary unavailability
    "temporarily unavailable",
    "try again",
    "retry",
    "service temporarily unavailable",
    "server overloaded",

    // Provider-specific transient errors
    "yandex cloud api error",
    "openai rate limit",
    "model is currently overloaded",
    "that model is currently overloaded",

    // Yandex Cloud IAM token errors (network-related)
    "failed to get iam token",
    "failed to process yandex cloud request",
    "iam token",
  ],
  permanentPatterns: [
    // Authentication errors
    "401",
    "403",
    "unauthorized",
    "forbidden",
    "invalid api key",
    "invalid_api_key",
    "api key",
    "authentication failed",
    "insufficient_quota",

    // Not found errors
    "404",
    "not found",
    "model not found",
    "model_not_found",

    // Bad request errors
    "400",
    "bad request",
    "invalid request",
    "invalid_request",
    "validation error",
    "invalid parameter",
    "missing required",

    // Method not allowed
    "405",
    "method not allowed",
  ],
};

export class LLMChainExecutor implements NodeExecutor {
  private retryConfig: RetryConfig = DEFAULT_LLM_RETRY_CONFIG;

  canExecute(node: Node): boolean {
    return node.type === "basicLLMChain";
  }

  /**
   * Main execute method with retry logic
   */
  async execute(node: Node, context: IExecutionContext): Promise<void> {
    const retryStartTime = Date.now();
    return this.executeWithRetry(node, context, 0, retryStartTime);
  }

  /**
   * Execute with retry logic for transient errors
   */
  private async executeWithRetry(
    node: Node,
    context: IExecutionContext,
    attempt: number,
    retryStartTime: number,
  ): Promise<void> {
    try {
      // Execute the core LLM logic
      await this.executeCore(node, context);
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      const errorType = this.classifyError(errorObj);
      const elapsedTime = Date.now() - retryStartTime;

      // Check if we should retry (учитываем и количество попыток, и общее время)
      const withinRetryLimit = attempt < this.retryConfig.maxRetries;
      const withinTimeLimit = elapsedTime < this.retryConfig.maxTotalTime;
      const shouldRetry =
        errorType === "transient" && withinRetryLimit && withinTimeLimit;

      if (shouldRetry) {
        const delay = this.calculateBackoff(attempt);
        const nodeLabel = node.data?.label || node.id;
        const remainingTime = Math.round(
          (this.retryConfig.maxTotalTime - elapsedTime) / 1000,
        );

        logger.warn(
          `🔄 LLM node "${nodeLabel}": Transient error detected, retry ${attempt + 1}/${this.retryConfig.maxRetries} ` +
            `after ${delay}ms (${remainingTime}s remaining). Error: ${errorObj.message}`,
        );

        // Wait with exponential backoff + jitter
        await this.sleep(delay);

        // Recursive retry
        return this.executeWithRetry(
          node,
          context,
          attempt + 1,
          retryStartTime,
        );
      }

      // Max retries exceeded OR permanent error OR time limit exceeded
      const nodeLabel = node.data?.label || node.id;

      if (!withinTimeLimit) {
        const finalError = new Error(
          `❌ LLM node "${nodeLabel}" failed: max retry time (${Math.round(this.retryConfig.maxTotalTime / 1000)}s) exceeded after ${attempt} attempts. Last error: ${errorObj.message}`,
        );
        logger.error(finalError.message);
        throw finalError;
      } else if (attempt >= this.retryConfig.maxRetries) {
        const finalError = new Error(
          `❌ LLM node "${nodeLabel}" failed after ${this.retryConfig.maxRetries} retries. Last error: ${errorObj.message}`,
        );
        logger.error(finalError.message);
        throw finalError;
      } else {
        logger.error(
          `❌ LLM node "${nodeLabel}" failed permanently: ${errorObj.message}`,
        );
        throw errorObj;
      }
    }
  }

  /**
   * Core execution logic (without retry)
   */
  private async executeCore(
    node: Node,
    context: IExecutionContext,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate node data
      if (!isLLMNodeData(node.data)) {
        throw new Error("Invalid LLM node data");
      }

      const nodeData = node.data as LLMNodeData;

      // Find the model provider for this group
      const modelGroup = nodeData.modelGroup || 1;

      logger.dev("LLMChainExecutor: Searching for model provider:", {
        llmNodeId: node.id,
        modelGroup: modelGroup,
      });

      const modelProvider = context
        .getNodes()
        .find(
          (n) => n.type === "modelProvider" && n.data?.groupId === modelGroup,
        );

      if (!modelProvider || !isModelProviderData(modelProvider.data)) {
        throw new Error(
          `No model provider found for group ${modelGroup} or invalid provider data`,
        );
      }

      const providerData = modelProvider.data as ModelProviderData;

      if (!providerData.model) {
        throw new Error(
          `Model not selected in provider for group ${modelGroup}`,
        );
      }

      // Variable context is now built on-demand during interpolation (memory optimization)

      // Prepare messages for the request
      const messages = nodeData.messages || [];

      // Ensure messages is a valid array
      const validMessages: LLMMessage[] = Array.isArray(messages)
        ? messages.map((msg) => ({
            role: getStringValue(msg.role, "user") as
              | "system"
              | "user"
              | "assistant",
            content: getStringValue(msg.content, ""),
          }))
        : [];

      // Interpolate variables in message content
      const interpolatedMessages: LLMMessage[] = validMessages.map((msg) => ({
        ...msg,
        content: context.interpolateTemplate(msg.content),
      }));

      // Merge consecutive user messages into a single message
      // This prevents models from losing context when multiple user messages are sent
      const mergedMessages: LLMMessage[] = [];
      for (const msg of interpolatedMessages) {
        const lastMsg = mergedMessages[mergedMessages.length - 1];

        // If both current and last message are 'user' role, merge them
        if (lastMsg && lastMsg.role === "user" && msg.role === "user") {
          // Merge into the last message with 10 newlines separator for better visual separation
          lastMsg.content =
            lastMsg.content + "\n\n\n\n\n\n\n\n\n\n" + msg.content;
        } else {
          // Otherwise, add as a new message
          mergedMessages.push({ ...msg });
        }
      }

      logger.dev(
        `LLMChainExecutor: Merged ${interpolatedMessages.length} messages into ${mergedMessages.length} messages`,
      );

      // Use merged messages for all subsequent operations
      const finalMessages = mergedMessages;

      // Prepare minimal context for debug info (without variables to save memory)
      const debugContext = {
        nodeId: node.id,
        modelGroup: modelGroup,
        messageCount: validMessages.length,
        modelProvider: {
          id: modelProvider.id,
          model: providerData.model,
          provider: providerData.provider,
        },
        timestamp: new Date().toISOString(),
      };

      // Get model configuration
      const modelConfig: ModelProviderConfig = {
        provider: providerData.provider || "ollama",
        model: providerData.model,
        groupId: providerData.groupId,
        ...buildOllamaParams(providerData),
      };

      // Send request based on provider
      let response: LLMResponse;
      const providerRequest: Record<string, unknown> = {};

      if (modelConfig.provider === "openai") {
        response = await this.executeOpenAI(
          providerData,
          finalMessages,
          providerRequest,
        );
      } else if (modelConfig.provider === "lmstudio") {
        response = await this.executeLMStudio(providerData, finalMessages);
      } else if (modelConfig.provider === "yandex") {
        response = await this.executeYandexCloud(
          providerData,
          finalMessages,
          providerRequest,
        );
      } else {
        // Default to Ollama
        response = await this.executeOllama(
          modelConfig,
          finalMessages,
          providerRequest,
        );
      }

      const duration = Date.now() - startTime;

      // Update node data with minimal essential info only
      context.updateNodeData(node.id, {
        lastResponse: response.response,
        lastThinking: response.thinking,
        lastError: undefined,
        executionStats: {
          duration,
          timestamp: new Date().toISOString(),
          tokens: response.totalTokens || response.response?.length || 0,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        },
      });

      // Auto-save as global variable
      this.autoSaveToGlobalVariable(node, response.response, context);

      // Save execution result with debug info (but not in node.data)
      const result = {
        nodeId: node.id,
        success: true,
        output: {
          type: "basicLLMChain",
          response: response.response,
          thinking: response.thinking,
          text: response.response,
        },
        duration,
        executionStats: {
          duration,
          timestamp: new Date().toISOString(),
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        },
        // Store debug info in execution result, not in node data
        debugInfo: {
          context: debugContext,
          request: providerRequest,
          response: {
            promptTokens: response.promptTokens,
            completionTokens: response.completionTokens,
            totalTokens: response.totalTokens,
          },
        },
      };

      // Pass only this node's result for atomic merging
      context.setExecutionResults({
        [node.id]: result,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logger.error("LLMChainExecutor failed:", errorObj);

      context.updateNodeData(node.id, {
        lastError: error instanceof Error ? error.message : "Unknown error",
        executionStats: {
          duration,
          timestamp: new Date().toISOString(),
          tokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      });

      throw error;
    }
  }

  private async executeOpenAI(
    providerData: ModelProviderData,
    messages: LLMMessage[],
    providerRequest: Record<string, unknown>,
  ): Promise<LLMResponse> {
    // Try to get API key from node data
    const apiKey = getStringValue(providerData.apiKey);

    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required. Provide it in the Model Provider node.",
      );
    }

    const openaiProvider = new OpenAIProvider({
      apiKey,
      baseURL: getStringValue(providerData.baseURL),
    });

    const modelName = providerData.model;
    const isO1Model = modelName?.includes("o1");

    // Build request object for debug info
    Object.assign(providerRequest, {
      model: providerData.model,
      messages: messages,
      seed: getNumberValue(providerData.seed, 0),
      stop: getArrayValue<string>(providerData.stopSequences),
      response_format: undefined,
    });

    // O1 models don't support these parameters
    if (!isO1Model) {
      if (providerData.temperatureEnabled) {
        Object.assign(providerRequest, {
          temperature: getNumberValue(providerData.temperature, 0.7),
        });
      }
      if (providerData.topPEnabled) {
        Object.assign(providerRequest, {
          top_p: getNumberValue(providerData.topP, 1.0),
        });
      }
      if (providerData.frequencyPenaltyEnabled) {
        Object.assign(providerRequest, {
          frequency_penalty: getNumberValue(providerData.frequencyPenalty, 0),
        });
      }
      if (providerData.presencePenaltyEnabled) {
        Object.assign(providerRequest, {
          presence_penalty: getNumberValue(providerData.presencePenalty, 0),
        });
      }
    }

    // Add reasoning_effort for o1 models
    if (isO1Model && providerData.reasoningEffort) {
      Object.assign(providerRequest, {
        reasoning_effort: providerData.reasoningEffort,
      });
    }

    // O1 models don't support temperature, top_p, presence_penalty, frequency_penalty
    const requestParams: OpenAIRequestParams = {
      model: providerData.model,
      messages: messages,
      seed: getNumberValue(providerData.seed),
      stop: getArrayValue<string>(providerData.stopSequences),
      response_format: undefined,
    };

    // Only add these parameters if NOT an o1 model
    if (!isO1Model) {
      if (providerData.temperatureEnabled) {
        requestParams.temperature = getNumberValue(
          providerData.temperature,
          0.7,
        );
      }
      if (providerData.topPEnabled) {
        requestParams.top_p = getNumberValue(providerData.topP, 1.0);
      }
      if (providerData.presencePenaltyEnabled) {
        requestParams.presence_penalty = getNumberValue(
          providerData.presencePenalty,
          0,
        );
      }
      if (providerData.frequencyPenaltyEnabled) {
        requestParams.frequency_penalty = getNumberValue(
          providerData.frequencyPenalty,
          0,
        );
      }
    }

    if (
      isO1Model &&
      providerData.reasoningEffort &&
      providerData.reasoningEffort !== "none"
    ) {
      requestParams.reasoning_effort = providerData.reasoningEffort as
        | "low"
        | "medium"
        | "high";
    }

    const result = await openaiProvider.sendRequest(requestParams);

    const content = result.choices[0]?.message?.content || "";

    // For o1 models, extract thinking/reasoning from the response
    // o1 models include reasoning in a structured format within the content
    let thinking: string | undefined;
    let response: string = content;

    if (isO1Model) {
      // Check for common reasoning patterns in o1 responses
      // Pattern 1: <reasoning>...</reasoning>
      const reasoningMatch = content.match(
        /<reasoning>([\s\S]*?)<\/reasoning>/i,
      );
      if (reasoningMatch && reasoningMatch[1]) {
        thinking = reasoningMatch[1].trim();
        response = content.replace(reasoningMatch[0], "").trim();
      }

      // Pattern 2: Separated by specific markers like "---" or "==="
      const separatorMatch = content.match(
        /^([\s\S]*?)(---|===)\s*\n([\s\S]*)$/,
      );
      if (
        !thinking &&
        separatorMatch &&
        separatorMatch[1] &&
        separatorMatch[3]
      ) {
        thinking = separatorMatch[1].trim();
        response = separatorMatch[3].trim();
      }

      // Pattern 3: Check if there's a "thinking:" or "reasoning:" prefix
      const prefixMatch = content.match(
        /^(thinking|reasoning):\s*([\s\S]*?)\n\n([\s\S]*)$/i,
      );
      if (!thinking && prefixMatch && prefixMatch[2] && prefixMatch[3]) {
        thinking = prefixMatch[2].trim();
        response = prefixMatch[3].trim();
      }
    }

    // Extract token usage from OpenAI response if available
    const usage = isProviderResponse(result) ? result.usage : undefined;

    return {
      response,
      thinking,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    };
  }

  private async executeLMStudio(
    providerData: ModelProviderData,
    messages: LLMMessage[],
  ): Promise<LLMResponse> {
    const lmstudioProvider = new LMStudioProvider({
      baseURL:
        getStringValue(providerData.baseURL) ||
        `${API_URLS.LMSTUDIO_BASE_URL}/v1`,
    });

    const requestParams: LMStudioRequestParams = {
      model: providerData.model,
      messages: messages,
      temperature: getNumberValue(providerData.temperature, 0.7),
      top_p: getNumberValue(providerData.topP, 0.9),
      seed: getNumberValue(providerData.seed),
      stop: getArrayValue<string>(providerData.stopSequences),
    };

    const result = await lmstudioProvider.sendRequest(requestParams);

    // LMStudio doesn't provide reasoning in the standard response
    const reasoning = "";

    // Extract token usage from LMStudio response if available
    const usage = isProviderResponse(result) ? result.usage : undefined;

    return {
      response: result.choices[0]?.message?.content || "",
      thinking: reasoning,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    };
  }

  private async executeYandexCloud(
    providerData: ModelProviderData,
    messages: LLMMessage[],
    providerRequest: Record<string, unknown>,
  ): Promise<LLMResponse> {
    // Get OAuth token and API key from provider data OR environment variables (fallback)
    // Note: process.env is only available server-side, so we pass undefined if not present
    // The API route will handle fallback to process.env on the server
    const oauthToken =
      getStringValue(providerData.oauthToken) ||
      (typeof process !== "undefined"
        ? process.env?.YANDEX_CLOUD_OAUTH_TOKEN
        : undefined);
    const apiKey =
      getStringValue(providerData.apiKey) ||
      (typeof process !== "undefined"
        ? process.env?.YANDEX_CLOUD_API_KEY
        : undefined);
    const folderId =
      (typeof process !== "undefined"
        ? process.env?.YANDEX_CLOUD_FOLDER
        : undefined) ||
      getStringValue(providerData.folderId, "b1gv7s2cc3lh59k24svl");

    // Don't check for tokens here - let the API route handle it
    // The API route has access to server-side environment variables
    const yandexProvider = new YandexCloudProvider({
      oauthToken,
      apiKey,
      folderId,
    });

    // Check if this is a GPT-OSS model and add reasoning effort to system message
    const isGptOssModel = providerData.model.toLowerCase().includes("gpt-oss");
    let finalYandexMessages = [...messages];

    if (
      isGptOssModel &&
      providerData.reasoningEffortEnabled &&
      providerData.reasoningEffort &&
      providerData.reasoningEffort !== "none"
    ) {
      // Find or create system message
      const systemMessageIndex = finalYandexMessages.findIndex(
        (m) => m.role === "system",
      );
      const reasoningInstruction = `\n\nReasoning: ${providerData.reasoningEffort}`;

      if (systemMessageIndex >= 0) {
        // Append to existing system message
        const existingMessage = finalYandexMessages[systemMessageIndex];
        if (existingMessage) {
          finalYandexMessages[systemMessageIndex] = {
            role: existingMessage.role,
            content: existingMessage.content + reasoningInstruction,
          };
        }
      } else {
        // Create new system message at the beginning
        finalYandexMessages = [
          {
            role: "system",
            content: `You are a helpful assistant.${reasoningInstruction}`,
          },
          ...finalYandexMessages,
        ];
      }
    }

    // Build request params respecting all enabled parameters from ModelProviderNode
    const requestParams: YandexCloudRequestParams = {
      model: providerData.model,
      messages: finalYandexMessages,
      temperature: providerData.temperatureEnabled
        ? getNumberValue(providerData.temperature)
        : undefined,
      top_p: providerData.topPEnabled
        ? getNumberValue(providerData.topP)
        : undefined,
      max_tokens: providerData.maxTokensEnabled
        ? getNumberValue(providerData.maxTokens)
        : undefined,
      seed: providerData.seedEnabled
        ? getNumberValue(providerData.seed)
        : undefined,
      stop: providerData.stopSequencesEnabled
        ? getArrayValue<string>(providerData.stopSequences)
        : undefined,
      presence_penalty: providerData.presencePenaltyEnabled
        ? getNumberValue(providerData.presencePenalty)
        : undefined,
      frequency_penalty: providerData.frequencyPenaltyEnabled
        ? getNumberValue(providerData.frequencyPenalty)
        : undefined,
    };

    // Build request object for debug info (same as requestParams but for display)
    Object.assign(providerRequest, requestParams);

    const result = await yandexProvider.sendRequest(requestParams);

    const content = result.choices[0]?.message?.content || "";

    // Try to extract thinking/reasoning
    let thinking: string | undefined;
    let response: string = content;

    // FIRST: Check for reasoning_content field (GPT-OSS models via Yandex Cloud)
    const reasoningContent = result.choices[0]?.message?.reasoning_content;
    if (reasoningContent) {
      thinking = reasoningContent;
    }

    // SECOND: If no reasoning_content found, try to extract from content for Qwen models
    const isQwenModel = providerData.model.toLowerCase().includes("qwen");

    if (isQwenModel && !thinking) {
      // Pattern 1: Check for <reasoning>...</reasoning> or <thinking>...</thinking> tags
      const reasoningMatch = content.match(
        /<(reasoning|thinking)>([\s\S]*?)<\/(reasoning|thinking)>/i,
      );
      if (reasoningMatch && reasoningMatch[2]) {
        thinking = reasoningMatch[2].trim();
        response = content.replace(reasoningMatch[0], "").trim();
      }

      // Pattern 2: Separated by markers like "---" or "==="
      if (!thinking) {
        const separatorMatch = content.match(
          /^([\s\S]*?)(---|===)\s*\n([\s\S]*)$/,
        );
        if (separatorMatch && separatorMatch[1] && separatorMatch[3]) {
          // Check if first part looks like reasoning (contains phrases like "let's", "step by step", etc.)
          const firstPart = separatorMatch[1].trim();
          if (
            firstPart.length > 100 &&
            /let'?s|step by step|first|second|therefore/i.test(firstPart)
          ) {
            thinking = firstPart;
            response = separatorMatch[3].trim();
          }
        }
      }

      // Pattern 3: Check for explicit "thinking:" or "reasoning:" prefix
      if (!thinking) {
        const prefixMatch = content.match(
          /^(thinking|reasoning):\s*([\s\S]*?)\n\n([\s\S]*)$/i,
        );
        if (prefixMatch && prefixMatch[2] && prefixMatch[3]) {
          thinking = prefixMatch[2].trim();
          response = prefixMatch[3].trim();
        }
      }
    }

    // Extract token usage
    const usage = isProviderResponse(result) ? result.usage : undefined;

    return {
      response,
      thinking,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    };
  }

  private async executeOllama(
    modelConfig: ModelProviderConfig,
    messages: LLMMessage[],
    providerRequest: Record<string, unknown>,
  ): Promise<LLMResponse> {
    const prompt = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const systemMessage =
      messages.find((msg) => msg.role === "system")?.content || "";

    Object.assign(providerRequest, {
      model: modelConfig.model,
      prompt: prompt,
      system: systemMessage || undefined,
      stream: false,
      options: modelConfig,
    });

    const ollamaResponse = await sendOllamaRequest(
      modelConfig.model,
      prompt,
      modelConfig,
    );

    return {
      response: ollamaResponse.response,
      thinking: ollamaResponse.thinking,
      promptTokens: ollamaResponse.prompt_eval_count,
      completionTokens: ollamaResponse.eval_count,
      totalTokens:
        (ollamaResponse.prompt_eval_count || 0) +
        (ollamaResponse.eval_count || 0),
    };
  }

  private autoSaveToGlobalVariable(
    node: Node,
    response: string,
    context: IExecutionContext,
  ): void {
    if (response) {
      try {
        // PRIORITY: Use node label as variable name (preserves exact casing and format)
        // This ensures variables are saved exactly as they appear in node references
        let nodeLabel = String(node.data?.label || "");

        // For generic labels or when label contains "LLM Chain", use a more specific name
        if (
          !nodeLabel ||
          nodeLabel === "Basic LLM Chain" ||
          nodeLabel.toLowerCase() === "localhost" ||
          nodeLabel.startsWith("LLM Chain")
        ) {
          // Use the node label if it exists, otherwise use a generic name
          // Always append part of node ID to ensure uniqueness
          const baseName = nodeLabel || "llm_output";
          nodeLabel = `${baseName.replace(/ /g, "_")}_${node.id.slice(-6)}`;
        } else {
          // For custom labels, preserve them exactly as-is (including spaces and casing)
          // This is important for labels like "de_01a_bfi_2_traits_agr_com (llm)"
          // where the exact format must be preserved for variable interpolation
          nodeLabel = nodeLabel; // Keep original label without modifications
        }

        const variableName = nodeLabel;
        logger.dev(`Using node label as variable name: ${variableName}`);

        const globalVariables = context.getGlobalVariables();

        // Check if variable already exists, if so, update it instead of creating new
        if (globalVariables[variableName]) {
          logger.dev(`Variable ${variableName} already exists, updating value`);
          context.updateGlobalVariable(
            variableName,
            response,
            `From LLM Chain: ${node.data?.label || node.id} (updated)`,
            globalVariables[variableName]?.folder, // Preserve existing folder
          );
        } else {
          context.addGlobalVariable(
            variableName,
            response,
            `From LLM Chain: ${node.data?.label || node.id}`,
          );
          logger.dev(
            `Auto-saved LLM Chain output as global variable: ${variableName}`,
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(
          "Failed to auto-save BasicLLMChain as global variable:",
          errorMsg,
        );
      }
    }
  }

  /**
   * Classify error as transient (retryable) or permanent (not retryable)
   */
  private classifyError(error: Error): "transient" | "permanent" {
    const errorMessage = error.message.toLowerCase();

    // Check if error matches transient patterns
    const isTransient = this.retryConfig.transientPatterns.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase()),
    );

    if (isTransient) {
      return "transient";
    }

    // Check if error matches permanent patterns
    const isPermanent = this.retryConfig.permanentPatterns.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase()),
    );

    if (isPermanent) {
      return "permanent";
    }

    // Default to permanent if we can't classify
    // Better to stop than to waste retries on unknown errors
    return "permanent";
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    // Exponential: 2^attempt * baseDelay
    const exponentialDelay = Math.pow(2, attempt) * this.retryConfig.baseDelay;

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);

    // Add jitter (±jitterPercent%)
    const jitterRange = cappedDelay * (this.retryConfig.jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
