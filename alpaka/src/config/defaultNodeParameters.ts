// Default parameter sets for different providers
// This file is separate from parameterSets.ts to avoid circular dependencies

import { 
  OllamaModelParameters, 
  OpenAIModelParameters, 
  LMStudioModelParameters, 
  AnthropicModelParameters,
  YandexCloudModelParameters,
  ModelProvider,
  BaseModelProviderData
} from '@/components/nodes/ModelProvider/types';
import { API_URLS } from '@/config/api';

// Default parameter sets for each provider
export const DEFAULT_OLLAMA_PARAMETERS: Omit<OllamaModelParameters, keyof BaseModelProviderData> = {
  temperature: 0.7,
  temperatureEnabled: true,
  topP: 0.9,
  topPEnabled: false,
  topK: 40,
  topKEnabled: false,
  maxTokens: 512,
  maxTokensEnabled: false,
  repeatPenalty: 1.1,
  repeatPenaltyEnabled: false,
  numPredict: 512,
  numPredictEnabled: false,
  mirostatSampling: 0,
  mirostatSamplingEnabled: false,
  mirostatEta: 0.1,
  mirostatEtaEnabled: false,
  mirostatTau: 5.0,
  mirostatTauEnabled: false,
  contextWindow: 2048,
  contextWindowEnabled: false,
  gpuLayers: 1,
  gpuLayersEnabled: false,
  numThread: 1,
  numThreadEnabled: false,
  repeatLastN: 64,
  repeatLastNEnabled: false,
  tfsZ: 1.0,
  tfsZEnabled: false,
  seed: 0,
  seedEnabled: false,
  keepAlive: false,
  keepAliveEnabled: false,
  format: '',
  formatEnabled: false,
  jsonSchema: '',
  jsonSchemaEnabled: false,
  stopSequences: [],
  stopSequencesEnabled: false,
  // GPT-OSS specific
  harmonyMode: false,
  harmonyModeEnabled: false,
  presencePenalty: 0.0,
  presencePenaltyEnabled: false,
  frequencyPenalty: 0.0,
  frequencyPenaltyEnabled: false,
  reasoningEffort: 'medium',
  reasoningEffortEnabled: false,
  // Qwen3 thinking mode
  think: false,
  thinkEnabled: false
};

export const DEFAULT_OPENAI_PARAMETERS: Omit<OpenAIModelParameters, keyof BaseModelProviderData> = {
  temperature: 0.7,
  temperatureEnabled: true,
  topP: 1.0,
  topPEnabled: false,
  maxTokens: 1000,
  maxTokensEnabled: true,
  seed: 0,
  seedEnabled: false,
  stopSequences: [],
  stopSequencesEnabled: false,
  presencePenalty: 0.0,
  presencePenaltyEnabled: false,
  frequencyPenalty: 0.0,
  frequencyPenaltyEnabled: false,
  logitBias: {},
  logitBiasEnabled: false,
  user: '',
  userEnabled: false,
  responseFormat: 'text',
  responseFormatEnabled: false,
  // o1 models specific
  reasoningEffort: 'medium',
  reasoningEffortEnabled: false
};

export const DEFAULT_LMSTUDIO_PARAMETERS: Omit<LMStudioModelParameters, keyof BaseModelProviderData> = {
  baseURL: `${API_URLS.LMSTUDIO_BASE_URL}/v1`,
  baseURLEnabled: true,
  temperature: 0.7,
  temperatureEnabled: true,
  topP: 0.9,
  topPEnabled: false,
  topK: 40,
  topKEnabled: false,
  maxTokens: 1000,
  maxTokensEnabled: true,
  seed: 0,
  seedEnabled: false,
  stopSequences: [],
  stopSequencesEnabled: false,
  presencePenalty: 0.0,
  presencePenaltyEnabled: false,
  frequencyPenalty: 0.0,
  frequencyPenaltyEnabled: false,
  repetitionPenalty: 1.1,
  repetitionPenaltyEnabled: false,
  minP: 0.05,
  minPEnabled: false,
  typicalP: 1.0,
  typicalPEnabled: false
};

export const DEFAULT_ANTHROPIC_PARAMETERS: Omit<AnthropicModelParameters, keyof BaseModelProviderData> = {
  temperature: 0.7,
  temperatureEnabled: true,
  topP: 1.0,
  topPEnabled: false,
  maxTokens: 1000,
  maxTokensEnabled: true,
  seed: 0,
  seedEnabled: false,
  stopSequences: [],
  stopSequencesEnabled: false,
  systemPrompt: '',
  systemPromptEnabled: false,
  toolChoice: 'auto',
  toolChoiceEnabled: false
};

export const DEFAULT_YANDEX_PARAMETERS: Omit<YandexCloudModelParameters, keyof BaseModelProviderData> = {
  temperature: 0.5,
  temperatureEnabled: true,
  topP: 1.0,
  topPEnabled: false,
  maxTokens: 500,
  maxTokensEnabled: true,
  seed: 0,
  seedEnabled: false,
  stopSequences: [],
  stopSequencesEnabled: false,
  apiKey: '',
  apiKeyEnabled: false,
  folderId: 'b1gv7s2cc3lh59k24svl',
  folderIdEnabled: false,
  presencePenalty: 0.0,
  presencePenaltyEnabled: false,
  frequencyPenalty: 0.0,
  frequencyPenaltyEnabled: false,
  // GPT-OSS reasoning parameters
  reasoningEffort: 'medium',
  reasoningEffortEnabled: false
};

import { ProviderParameters } from '@/types/common';

// Get default parameters for provider
export function getDefaultNodeParameters(provider: ModelProvider): ProviderParameters {
  switch (provider) {
    case 'ollama':
      return DEFAULT_OLLAMA_PARAMETERS as ProviderParameters;
    case 'openai':
      return DEFAULT_OPENAI_PARAMETERS as ProviderParameters;
    case 'lmstudio':
      return DEFAULT_LMSTUDIO_PARAMETERS as ProviderParameters;
    case 'anthropic':
      return DEFAULT_ANTHROPIC_PARAMETERS as ProviderParameters;
    case 'yandex':
      return DEFAULT_YANDEX_PARAMETERS as ProviderParameters;
    default:
      return DEFAULT_OLLAMA_PARAMETERS as ProviderParameters;
  }
}
