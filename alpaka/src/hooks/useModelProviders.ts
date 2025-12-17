// Hook for managing multiple model providers

import { useState, useCallback } from 'react';
import { ModelProvider, ModelInfo } from '@/components/nodes/ModelProvider/types';

interface UseModelProvidersReturn {
  getModels: (provider: ModelProvider, config?: Record<string, unknown>) => Promise<ModelInfo[]>;
  loading: Record<ModelProvider, boolean>;
  errors: Record<ModelProvider, string | null>;
  clearError: (provider: ModelProvider) => void;
}

export const useModelProviders = (): UseModelProvidersReturn => {
  const [loading, setLoading] = useState<Record<ModelProvider, boolean>>({
    ollama: false,
    openai: false,
    lmstudio: false,
    anthropic: false,
    yandex: false
  });

  const [errors, setErrors] = useState<Record<ModelProvider, string | null>>({
    ollama: null,
    openai: null,
    lmstudio: null,
    anthropic: null,
    yandex: null
  });

  const clearError = useCallback((provider: ModelProvider) => {
    setErrors(prev => ({ ...prev, [provider]: null }));
  }, []);

  const getModels = useCallback(async (provider: ModelProvider, config?: Record<string, unknown>): Promise<ModelInfo[]> => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    setErrors(prev => ({ ...prev, [provider]: null }));

    try {
      switch (provider) {
        case 'ollama':
          return await getOllamaModels();
        
        case 'openai':
          return await getOpenAIModels(config as { apiKey: string; baseURL?: string; organization?: string });
        
        case 'lmstudio':
          return await getLMStudioModels(config as { baseURL?: string });
        
        case 'anthropic':
          return await getAnthropicModels(config as { apiKey: string });
        
        case 'yandex':
          return await getYandexCloudModels(config as { apiKey: string; folderId?: string });
        
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors(prev => ({ ...prev, [provider]: errorMessage }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }));
    }
  }, []);

  return {
    getModels,
    loading,
    errors,
    clearError
  };
};

// Provider-specific functions
async function getOllamaModels(): Promise<ModelInfo[]> {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('Failed to fetch Ollama models');
  }
  const data = await response.json();
  return data.models || [];
}

async function getOpenAIModels(config: { apiKey: string; baseURL?: string; organization?: string }): Promise<ModelInfo[]> {
  // Allow empty API key - will use env variable on server side
  const params = new URLSearchParams();
  
  // Only add params if they have values
  if (config?.apiKey) {
    params.append('apiKey', config.apiKey);
  }
  if (config?.baseURL) {
    params.append('baseURL', config.baseURL);
  }
  if (config?.organization) {
    params.append('organization', config.organization);
  }

  const response = await fetch(`/api/providers/openai/models?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch OpenAI models');
  }
  
  const data = await response.json();
  return data.models || [];
}

async function getLMStudioModels(config?: { baseURL?: string }): Promise<ModelInfo[]> {
  const params = new URLSearchParams({
    ...(config?.baseURL && { baseURL: config.baseURL })
  });

  const response = await fetch(`/api/providers/lmstudio/models?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch LM Studio models');
  }
  
  const data = await response.json();
  return data.models || [];
}

async function getAnthropicModels(_config: { apiKey: string }): Promise<ModelInfo[]> {
  // Anthropic doesn't have a models endpoint, return static list
  void _config; // Mark as intentionally unused
  return [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      description: 'Most capable Claude model',
      contextLength: 200000,
      capabilities: {
        chat: true,
        completion: false,
        vision: true,
        functionCalling: true,
        reasoning: true
      }
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      description: 'Fast and efficient Claude model',
      contextLength: 200000,
      capabilities: {
        chat: true,
        completion: false,
        vision: false,
        functionCalling: true,
        reasoning: false
      }
    }
  ];
}

async function getYandexCloudModels(config?: { apiKey: string; folderId?: string }): Promise<ModelInfo[]> {
  const params = new URLSearchParams();
  
  // Only add params if they have values
  if (config?.apiKey) {
    params.append('apiKey', config.apiKey);
  }
  if (config?.folderId) {
    params.append('folderId', config.folderId);
  }

  const response = await fetch(`/api/providers/yandex/models?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch Yandex Cloud models');
  }
  
  const data = await response.json();
  return data.models || [];
}
