// Parameter Sets for Different Providers

import { ModelProvider } from './types';
import {
  DEFAULT_OLLAMA_PARAMETERS,
  DEFAULT_OPENAI_PARAMETERS,
  DEFAULT_LMSTUDIO_PARAMETERS,
  DEFAULT_ANTHROPIC_PARAMETERS,
  DEFAULT_YANDEX_PARAMETERS,
  getDefaultNodeParameters
} from '@/config/defaultNodeParameters';

// Re-export the default parameters from the centralized config
export {
  DEFAULT_OLLAMA_PARAMETERS,
  DEFAULT_OPENAI_PARAMETERS,
  DEFAULT_LMSTUDIO_PARAMETERS,
  DEFAULT_ANTHROPIC_PARAMETERS,
  DEFAULT_YANDEX_PARAMETERS
};

// Get default parameters for provider
export function getDefaultParameters(provider: ModelProvider): Record<string, unknown> {
  return getDefaultNodeParameters(provider);
}

// Get parameters that are relevant for specific provider
export function getRelevantParameters(provider: ModelProvider): string[] {
  switch (provider) {
    case 'ollama':
      return [
        'temperature', 'topP', 'topK', 'repeatPenalty', 'numPredict',
        'mirostatSampling', 'mirostatEta', 'mirostatTau', 'contextWindow',
        'gpuLayers', 'numThread', 'repeatLastN', 'tfsZ', 'seed',
        'keepAlive', 'format', 'jsonSchema', 'stopSequences',
        'harmonyMode', 'presencePenalty', 'frequencyPenalty', 
        'reasoningEffort', 'think'
      ];
    case 'openai':
      return [
        'temperature', 'topP', 'maxTokens', 'seed', 'stopSequences',
        'presencePenalty', 'frequencyPenalty', 'logitBias', 'user',
        'responseFormat', 'reasoningEffort'
      ];
    case 'lmstudio':
      return [
        'baseURL', 'temperature', 'topP', 'topK', 'maxTokens', 'seed', 'stopSequences',
        'presencePenalty', 'frequencyPenalty', 'repetitionPenalty',
        'minP', 'typicalP'
      ];
    case 'anthropic':
      return [
        'temperature', 'topP', 'maxTokens', 'seed', 'stopSequences',
        'systemPrompt', 'toolChoice'
      ];
    case 'yandex':
      return [
        'apiKey', 'folderId', 'temperature', 'topP', 'maxTokens', 'seed', 'stopSequences',
        'presencePenalty', 'frequencyPenalty', 'reasoningEffort'
      ];
    default:
      return [];
  }
}
