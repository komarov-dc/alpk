// Model Provider Types and Interfaces

export type ModelProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'yandex';

// Base interface for all model providers
export interface BaseModelProviderData {
  label: string;
  provider: ModelProvider;
  model: string;
  groupId: number;
  isCollapsed?: boolean;
}

// Common parameters across providers
export interface CommonModelParameters {
  temperature: number;
  temperatureEnabled: boolean;
  topP: number;
  topPEnabled: boolean;
  maxTokens: number;
  maxTokensEnabled: boolean;
  seed: number;
  seedEnabled: boolean;
  stopSequences: string[];
  stopSequencesEnabled: boolean;
}

// Ollama-specific parameters
export interface OllamaModelParameters extends CommonModelParameters {
  topK: number;
  topKEnabled: boolean;
  repeatPenalty: number;
  repeatPenaltyEnabled: boolean;
  numPredict: number;
  numPredictEnabled: boolean;
  mirostatSampling: number;
  mirostatSamplingEnabled: boolean;
  mirostatEta: number;
  mirostatEtaEnabled: boolean;
  mirostatTau: number;
  mirostatTauEnabled: boolean;
  contextWindow: number;
  contextWindowEnabled: boolean;
  gpuLayers: number;
  gpuLayersEnabled: boolean;
  numThread: number;
  numThreadEnabled: boolean;
  repeatLastN: number;
  repeatLastNEnabled: boolean;
  tfsZ: number;
  tfsZEnabled: boolean;
  keepAlive: boolean;
  keepAliveEnabled: boolean;
  format: string;
  formatEnabled: boolean;
  jsonSchema: string;
  jsonSchemaEnabled: boolean;
  // GPT-OSS specific parameters
  harmonyMode: boolean;
  harmonyModeEnabled: boolean;
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  reasoningEffortEnabled: boolean;
  // Qwen3 thinking mode
  think: boolean;
  thinkEnabled: boolean;
}

// OpenAI-specific parameters
export interface OpenAIModelParameters extends CommonModelParameters {
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  logitBias: Record<string, number>;
  logitBiasEnabled: boolean;
  user: string;
  userEnabled: boolean;
  responseFormat: 'text' | 'json_object';
  responseFormatEnabled: boolean;
  // o1 models specific
  reasoningEffort: 'low' | 'medium' | 'high';
  reasoningEffortEnabled: boolean;
}

// LM Studio-specific parameters (OpenAI-compatible)
export interface LMStudioModelParameters extends CommonModelParameters {
  baseURL: string;
  baseURLEnabled: boolean;
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  repetitionPenalty: number;
  repetitionPenaltyEnabled: boolean;
  topK: number;
  topKEnabled: boolean;
  minP: number;
  minPEnabled: boolean;
  typicalP: number;
  typicalPEnabled: boolean;
}

// Anthropic-specific parameters
export interface AnthropicModelParameters extends CommonModelParameters {
  systemPrompt: string;
  systemPromptEnabled: boolean;
  toolChoice: 'auto' | 'any_tool' | 'tool';
  toolChoiceEnabled: boolean;
}

// Yandex Cloud-specific parameters (OpenAI-compatible)
export interface YandexCloudModelParameters extends CommonModelParameters {
  apiKey: string;
  apiKeyEnabled: boolean;
  folderId: string;
  folderIdEnabled: boolean;
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  // GPT-OSS reasoning parameters
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  reasoningEffortEnabled: boolean;
}

// Union type for all provider data
export type ModelProviderData = BaseModelProviderData & (
  | OllamaModelParameters 
  | OpenAIModelParameters 
  | LMStudioModelParameters 
  | AnthropicModelParameters
  | YandexCloudModelParameters
);

// Provider configuration
export interface ProviderConfig {
  value: ModelProvider;
  label: string;
  available: boolean;
  apiKeyRequired: boolean;
  defaultEndpoint?: string;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  description?: string;
  contextLength?: number;
  pricing?: {
    input: number;
    output: number;
    currency: string;
  };
  capabilities: {
    chat: boolean;
    completion: boolean;
    vision: boolean;
    functionCalling: boolean;
    reasoning: boolean;
  };
}
