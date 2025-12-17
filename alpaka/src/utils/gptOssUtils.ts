/**
 * Утилиты для работы с GPT-OSS моделями и Harmony framework
 */

import { API_ENDPOINTS } from '@/config/api';

export interface GptOssResponse {
  thinking?: string;
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ModelProviderConfig {
  provider: string;
  model: string;
  groupId: number;
  // Параметры
  temperature?: number;
  temperatureEnabled?: boolean;
  topP?: number;
  topPEnabled?: boolean;
  topK?: number;
  topKEnabled?: boolean;
  repeatPenalty?: number;
  repeatPenaltyEnabled?: boolean;
  numPredict?: number;
  numPredictEnabled?: boolean;
  // GPT-OSS специфичные
  harmonyMode?: boolean;
  harmonyModeEnabled?: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  reasoningEffortEnabled?: boolean;
  presencePenalty?: number;
  presencePenaltyEnabled?: boolean;
  frequencyPenalty?: number;
  frequencyPenaltyEnabled?: boolean;
  
  // Qwen3 thinking mode
  think?: boolean;
  thinkEnabled?: boolean;
}

/**
 * Проверяет, является ли модель GPT-OSS
 * Поддерживает форматы:
 * - gpt-oss:20b (Ollama)
 * - gpt://folder/gpt-oss-20b/latest (Yandex Cloud)
 */
export const isGptOssModel = (modelName: string): boolean => {
  const normalized = modelName.toLowerCase();
  return normalized.includes('gpt-oss') || normalized.includes('gptoss');
};

/**
 * Проверяет, поддерживает ли модель thinking mode (Qwen3, DeepSeek R1)
 */
export const supportsThinking = (modelName: string): boolean => {
  const name = modelName.toLowerCase();
  return name.includes('qwen3') || name.includes('qwen-3') || name.includes('deepseek-r1');
};

/**
 * Формирует системное сообщение с reasoning effort для GPT-OSS
 */
export const buildGptOssSystemMessage = (
  baseSystemMessage: string,
  reasoningEffort: 'low' | 'medium' | 'high',
  harmonyMode: boolean = true
): string => {
  let systemMessage = baseSystemMessage;

  if (harmonyMode) {
    systemMessage += '\n\nYou are operating in Harmony mode with enhanced reasoning capabilities.';
  }

  // Добавляем reasoning effort согласно документации
  systemMessage += `\n\nReasoning: ${reasoningEffort}`;

  return systemMessage;
};

/**
 * Формирует параметры для Ollama API на основе конфигурации Model Provider
 */
export const buildOllamaParams = (config: ModelProviderConfig): Record<string, unknown> => {
  const params: Record<string, unknown> = {};

  // Добавляем только включенные параметры
  if (config.temperatureEnabled && config.temperature !== undefined) {
    params.temperature = config.temperature;
  }

  if (config.topPEnabled && config.topP !== undefined) {
    params.top_p = config.topP;
  }

  if (config.topKEnabled && config.topK !== undefined) {
    params.top_k = config.topK;
  }

  if (config.repeatPenaltyEnabled && config.repeatPenalty !== undefined) {
    params.repeat_penalty = config.repeatPenalty;
  }

  if (config.numPredictEnabled && config.numPredict !== undefined) {
    params.num_predict = config.numPredict;
  }

  // GPT-OSS специфичные параметры
  if (config.presencePenaltyEnabled && config.presencePenalty !== undefined) {
    params.presence_penalty = config.presencePenalty;
  }

  if (config.frequencyPenaltyEnabled && config.frequencyPenalty !== undefined) {
    params.frequency_penalty = config.frequencyPenalty;
  }

  // Qwen3 thinking mode
  if (config.thinkEnabled && config.think !== undefined) {
    params.think = config.think;
  }

  return params;
};

/**
 * Парсит ответ от GPT-OSS модели, извлекая reasoning и content
 * Поддерживает два формата:
 * - Ollama/local: `thinking` поле
 * - Yandex Cloud: `reasoning_content` поле в message
 */
export const parseGptOssResponse = (response: Record<string, unknown>): GptOssResponse => {
  // Извлекаем thinking из разных форматов
  let thinking: string | undefined;

  // Формат Ollama/local
  if (typeof response.thinking === 'string') {
    thinking = response.thinking;
  }

  // Формат Yandex Cloud (OpenAI-compatible)
  const message = response.message as Record<string, unknown> | undefined;
  if (message && typeof message.reasoning_content === 'string') {
    thinking = message.reasoning_content;
  }

  // Для OpenAI-compatible API (Yandex Cloud)
  const content = message?.content || response.response || response.content || '';

  return {
    thinking,
    response: String(content),
    model: String(response.model || ''),
    created_at: String(response.created_at || new Date().toISOString()),
    done: Boolean(response.done) || true,
    done_reason: String(response.done_reason || response.finish_reason || ''),
    total_duration: Number(response.total_duration) || 0,
    load_duration: Number(response.load_duration) || 0,
    prompt_eval_count: Number(response.prompt_eval_count) || 0,
    prompt_eval_duration: Number(response.prompt_eval_duration) || 0,
    eval_count: Number(response.eval_count) || 0,
    eval_duration: Number(response.eval_duration) || 0
  };
};

/**
 * Парсит ответ от Qwen3 модели, извлекая thinking из <think></think> тегов
 */
export const parseQwen3Response = (response: Record<string, unknown>): GptOssResponse => {
  const fullResponse = String(response.response || response.content || '');
  
  // Ищем <think>...</think> теги в ответе
  const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
  const match = fullResponse.match(thinkRegex);
  
  let thinking: string | undefined;
  let cleanResponse: string = fullResponse;
  
  if (match && match[1]) {
    thinking = match[1].trim();
    // Удаляем <think>...</think> теги из основного ответа
    cleanResponse = fullResponse.replace(thinkRegex, '').trim();
  }
  
  return {
    thinking: thinking,
    response: cleanResponse,
    model: String(response.model || ''),
    created_at: String(response.created_at || new Date().toISOString()),
    done: Boolean(response.done) || true,
    done_reason: String(response.done_reason || ''),
    total_duration: Number(response.total_duration) || 0,
    load_duration: Number(response.load_duration) || 0,
    prompt_eval_count: Number(response.prompt_eval_count) || 0,
    prompt_eval_duration: Number(response.prompt_eval_duration) || 0,
    eval_count: Number(response.eval_count) || 0,
    eval_duration: Number(response.eval_duration) || 0
  };
};

/**
 * Получает рекомендуемые параметры для GPT-OSS модели
 */
export const getGptOssRecommendedParams = (): Partial<ModelProviderConfig> => {
  return {
    temperature: 1.0,
    temperatureEnabled: true,
    topP: 1.0,
    topPEnabled: true,
    harmonyMode: true,
    harmonyModeEnabled: true,
    reasoningEffort: 'medium',
    reasoningEffortEnabled: true
  };
};

/**
 * Отправляет запрос к Ollama API с поддержкой GPT-OSS reasoning effort
 */
export const sendOllamaRequest = async (
  model: string,
  prompt: string,
  config: ModelProviderConfig,
  systemMessage?: string
): Promise<GptOssResponse> => {
  const baseUrl = API_ENDPOINTS.OLLAMA_GENERATE;
  
  // Формируем системное сообщение с reasoning effort для GPT-OSS
  let finalSystemMessage = systemMessage || '';
  
  if (isGptOssModel(model) && config.reasoningEffortEnabled && config.reasoningEffort) {
    if (config.harmonyModeEnabled && config.harmonyMode) {
      finalSystemMessage += '\n\nYou are operating in Harmony mode with enhanced reasoning capabilities.';
    }
    // Добавляем reasoning effort только если не "none"
    if (config.reasoningEffort !== 'none') {
      finalSystemMessage += `\n\nReasoning: ${config.reasoningEffort}`;
    }
  }
  
  // Формируем параметры для API
  const ollamaParams = buildOllamaParams(config);
  
  const requestBody = {
    model,
    prompt,
    system: finalSystemMessage.trim() || undefined,
    stream: false, // Will enable streaming for specific nodes later
    options: ollamaParams
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Используем соответствующий парсер в зависимости от типа модели
    if (isGptOssModel(model)) {
      return parseGptOssResponse(data);
    } else if (supportsThinking(model)) {
      return parseQwen3Response(data);
    } else {
      // Для обычных моделей возвращаем как есть
      return {
        thinking: undefined,
        response: data.response || data.content || '',
        model: data.model || model,
        created_at: data.created_at || new Date().toISOString(),
        done: data.done || true,
        done_reason: data.done_reason,
        total_duration: data.total_duration,
        load_duration: data.load_duration,
        prompt_eval_count: data.prompt_eval_count,
        prompt_eval_duration: data.prompt_eval_duration,
        eval_count: data.eval_count,
        eval_duration: data.eval_duration
      };
    }
  } catch (error) {
    throw new Error(`Failed to send request to Ollama: ${error}`);
  }
};
