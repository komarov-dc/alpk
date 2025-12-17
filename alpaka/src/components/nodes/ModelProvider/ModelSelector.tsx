// Model Selector Component

import React from 'react';
import { ModelProvider, ModelInfo } from './types';
import { getModelsForProvider } from './providers';
import { CustomModelDropdown } from '@/components/ui/CustomModelDropdown';

interface ModelSelectorProps {
  provider: ModelProvider;
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  availableModels?: string[] | import('@/hooks/useOllamaModels').OllamaModel[]; // For dynamic models (Ollama)
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  value,
  onChange,
  disabled = false,
  loading = false,
  error,
  onRetry,
  availableModels
}) => {
  const getAvailableModels = (): string[] => {
    if (provider === 'ollama' && availableModels) {
      // Handle both string[] and OllamaModel[] types
      return availableModels.map(model => 
        typeof model === 'string' ? model : model.name
      );
    }
    
    const defaultModels = getModelsForProvider(provider);
    return defaultModels.map(model => model.id);
  };

  const getModelInfo = (modelId: string): ModelInfo | undefined => {
    const defaultModels = getModelsForProvider(provider);
    return defaultModels.find(model => model.id === modelId);
  };

  const selectedModelInfo = getModelInfo(value);
  const models = getAvailableModels();

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-2">
        Model
        {loading && <span className="text-xs text-gray-400 ml-2">(Loading...)</span>}
        {error && onRetry && (
          <button 
            onClick={onRetry}
            className="text-xs text-red-400 ml-2 hover:text-red-300"
          >
            (Retry)
          </button>
        )}
      </label>
      
      {provider === 'ollama' ? (
        <CustomModelDropdown
          models={availableModels as import('@/hooks/useOllamaModels').OllamaModel[] || []}
          value={value}
          onChange={onChange}
          disabled={disabled || loading}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800 disabled:cursor-not-allowed"
        >
          <option value="" className="bg-gray-700 text-white">Select a model...</option>
          {models.map((modelId) => {
            const modelInfo = getModelInfo(modelId);
            return (
              <option key={modelId} value={modelId} className="bg-gray-700 text-white">
                {modelInfo?.name || modelId}
                {modelInfo?.pricing && ` ($${modelInfo.pricing.input}/$${modelInfo.pricing.output})`}
              </option>
            );
          })}
        </select>
      )}

      {/* Model Info */}
      {selectedModelInfo && (
        <div className="mt-2 p-2 bg-gray-800 rounded-md border border-gray-600">
          <div className="text-xs text-gray-300">
            <div className="font-medium text-white">{selectedModelInfo.name}</div>
            {selectedModelInfo.description && (
              <div className="text-gray-400">{selectedModelInfo.description}</div>
            )}
            <div className="flex gap-2 mt-1">
              {selectedModelInfo.contextLength && (
                <span className="bg-blue-600 text-blue-100 px-1 rounded">
                  {selectedModelInfo.contextLength.toLocaleString()} ctx
                </span>
              )}
              {selectedModelInfo.capabilities.reasoning && (
                <span className="bg-purple-600 text-purple-100 px-1 rounded">🧠 Reasoning</span>
              )}
              {selectedModelInfo.capabilities.vision && (
                <span className="bg-green-600 text-green-100 px-1 rounded">👁️ Vision</span>
              )}
              {selectedModelInfo.capabilities.functionCalling && (
                <span className="bg-orange-600 text-orange-100 px-1 rounded">🔧 Functions</span>
              )}
            </div>
            {selectedModelInfo.pricing && (
              <div className="text-xs text-gray-400 mt-1">
                ${selectedModelInfo.pricing.input}/${selectedModelInfo.pricing.output} {selectedModelInfo.pricing.currency}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
