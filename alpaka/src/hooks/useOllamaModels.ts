import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  displayName: string;
}

interface UseOllamaModelsResult {
  models: OllamaModel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useOllamaModels = (): UseOllamaModelsResult => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/models');
      const data = await response.json();
      
      if (!response.ok && !data.fallback) {
        throw new Error(data.error || 'Failed to fetch models');
      }
      
      setModels(data.models || []);
      
      // Если это fallback данные, устанавливаем предупреждение
      if (data.fallback) {
        setError('Using fallback models. Ollama may not be available.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      logger.error('Error fetching Ollama models:', err as Error);
      
      // Fallback к базовым моделям при ошибке
      setModels([
        { name: 'llama3.2', displayName: 'Llama 3.2', size: 0, digest: '' },
        { name: 'llama3.1', displayName: 'Llama 3.1', size: 0, digest: '' },
        { name: 'mistral', displayName: 'Mistral', size: 0, digest: '' },
        { name: 'codellama', displayName: 'Code Llama', size: 0, digest: '' },
        { name: 'phi3', displayName: 'Phi-3', size: 0, digest: '' },
        { name: 'gemma2', displayName: 'Gemma 2', size: 0, digest: '' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    loading,
    error,
    refetch: fetchModels,
  };
};
