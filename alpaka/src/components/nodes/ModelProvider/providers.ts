// Model Provider Configurations

import { ProviderConfig, ModelInfo, ModelProvider } from './types';
import { API_URLS } from '@/config/api';

// Provider configurations
export const PROVIDERS: ProviderConfig[] = [
  {
    value: 'ollama',
    label: 'Ollama',
    available: true,
    apiKeyRequired: false,
    defaultEndpoint: API_URLS.OLLAMA_BASE_URL,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsVision: true
  },
  {
    value: 'openai',
    label: 'OpenAI',
    available: true,
    apiKeyRequired: true,
    defaultEndpoint: API_URLS.OPENAI_BASE_URL,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true
  },
  {
    value: 'lmstudio',
    label: 'LM Studio',
    available: true,
    apiKeyRequired: false,
    defaultEndpoint: `${API_URLS.LMSTUDIO_BASE_URL}/v1`,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsVision: false
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    available: false, // Coming soon
    apiKeyRequired: true,
    defaultEndpoint: API_URLS.ANTHROPIC_BASE_URL,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsVision: true
  },
  {
    value: 'yandex',
    label: 'Yandex Cloud',
    available: true,
    apiKeyRequired: false, // Uses OAuth token from .env
    defaultEndpoint: 'https://llm.api.cloud.yandex.net/v1',
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsVision: false
  }
];

// Default models for each provider
export const DEFAULT_MODELS: Record<ModelProvider, ModelInfo[]> = {
  ollama: [
    {
      id: 'llama3.2:latest',
      name: 'Llama 3.2',
      provider: 'ollama',
      description: 'Meta\'s latest language model',
      contextLength: 128000,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: false
      }
    },
    {
      id: 'qwen2.5:latest',
      name: 'Qwen 2.5',
      provider: 'ollama',
      description: 'Alibaba\'s multilingual model',
      contextLength: 32768,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    },
    {
      id: 'gpt-oss:20b',
      name: 'GPT-OSS 20B',
      provider: 'ollama',
      description: 'Open source GPT with reasoning',
      contextLength: 8192,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    }
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      description: 'Most capable multimodal model',
      contextLength: 128000,
      pricing: { input: 2.50, output: 10.00, currency: 'USD per 1M tokens' },
      capabilities: {
        chat: true,
        completion: true,
        vision: true,
        functionCalling: true,
        reasoning: false
      }
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      description: 'Affordable multimodal model',
      contextLength: 128000,
      pricing: { input: 0.15, output: 0.60, currency: 'USD per 1M tokens' },
      capabilities: {
        chat: true,
        completion: true,
        vision: true,
        functionCalling: true,
        reasoning: false
      }
    },
    {
      id: 'o1-preview',
      name: 'o1-preview',
      provider: 'openai',
      description: 'Advanced reasoning model',
      contextLength: 128000,
      pricing: { input: 15.00, output: 60.00, currency: 'USD per 1M tokens' },
      capabilities: {
        chat: true,
        completion: false,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    },
    {
      id: 'o1-mini',
      name: 'o1-mini',
      provider: 'openai',
      description: 'Faster reasoning model',
      contextLength: 128000,
      pricing: { input: 3.00, output: 12.00, currency: 'USD per 1M tokens' },
      capabilities: {
        chat: true,
        completion: false,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    }
  ],
  lmstudio: [
    {
      id: 'local-model',
      name: 'Local Model',
      provider: 'lmstudio',
      description: 'Currently loaded model in LM Studio',
      contextLength: 4096,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: false
      }
    }
  ],
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      description: 'Most capable Claude model',
      contextLength: 200000,
      pricing: { input: 3.00, output: 15.00, currency: 'USD per 1M tokens' },
      capabilities: {
        chat: true,
        completion: false,
        vision: true,
        functionCalling: true,
        reasoning: true
      }
    }
  ],
  yandex: [
    {
      id: 'gpt://{{folder}}/yandexgpt/latest',
      name: 'YandexGPT',
      provider: 'yandex',
      description: 'Yandex Foundation Models - YandexGPT',
      contextLength: 8192,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: false
      }
    },
    {
      id: 'gpt://{{folder}}/yandexgpt-lite/latest',
      name: 'YandexGPT Lite',
      provider: 'yandex',
      description: 'Yandex Foundation Models - YandexGPT Lite',
      contextLength: 8192,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: false
      }
    },
    {
      id: 'gpt://{{folder}}/qwen3-235b-a22b-fp8/latest',
      name: 'Qwen3 235B (FP8)',
      provider: 'yandex',
      description: 'Yandex Foundation Models - Qwen3 235B',
      contextLength: 32768,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: false
      }
    },
    {
      id: 'gpt://{{folder}}/gpt-oss-20b/latest',
      name: 'GPT-OSS 20B',
      provider: 'yandex',
      description: 'OpenAI GPT-OSS with Chain-of-Thought reasoning',
      contextLength: 8192,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    },
    {
      id: 'gpt://{{folder}}/gpt-oss-120b/latest',
      name: 'GPT-OSS 120B',
      provider: 'yandex',
      description: 'OpenAI GPT-OSS 120B with Chain-of-Thought reasoning',
      contextLength: 8192,
      capabilities: {
        chat: true,
        completion: true,
        vision: false,
        functionCalling: false,
        reasoning: true
      }
    }
  ]
};

// Get available models for provider
export function getModelsForProvider(provider: ModelProvider): ModelInfo[] {
  return DEFAULT_MODELS[provider] || [];
}

// Check if provider requires API key
export function requiresApiKey(provider: ModelProvider): boolean {
  const config = PROVIDERS.find(p => p.value === provider);
  return config?.apiKeyRequired ?? false;
}

// Get provider configuration
export function getProviderConfig(provider: ModelProvider): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.value === provider);
}
