// Parameter Editor Component for Model Providers

import React from 'react';
import { ModelProvider } from './types';
import { getRelevantParameters } from './parameterSets';

interface ParameterEditorProps {
  provider: ModelProvider;
  parameters: Record<string, unknown>;
  onParameterChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export const ParameterEditor: React.FC<ParameterEditorProps> = ({
  provider,
  parameters,
  onParameterChange,
  disabled = false
}) => {
  const relevantParams = getRelevantParameters(provider);

  const renderParameter = (paramName: string) => {
    const value = parameters[paramName];
    const enabledKey = `${paramName}Enabled`;
    const isEnabled = parameters[enabledKey] as boolean;

    // Skip if parameter is not relevant for this provider
    if (!relevantParams.includes(paramName)) {
      return null;
    }

    const updateValue = (newValue: unknown) => {
      onParameterChange(paramName, newValue);
    };

    const toggleEnabled = () => {
      onParameterChange(enabledKey, !isEnabled);
    };

    // Render different input types based on parameter
    const renderInput = () => {
      switch (paramName) {
        case 'temperature':
        case 'topP':
        case 'repeatPenalty':
        case 'mirostatEta':
        case 'mirostatTau':
        case 'tfsZ':
        case 'presencePenalty':
        case 'frequencyPenalty':
        case 'repetitionPenalty':
        case 'minP':
        case 'typicalP':
          return (
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={value as number}
              onChange={(e) => updateValue(parseFloat(e.target.value) || 0)}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
            />
          );

        case 'topK':
        case 'numPredict':
        case 'maxTokens':
        case 'contextWindow':
        case 'gpuLayers':
        case 'numThread':
        case 'repeatLastN':
        case 'seed':
          return (
            <input
              type="number"
              min="0"
              value={value as number}
              onChange={(e) => updateValue(parseInt(e.target.value) || 0)}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
            />
          );

        case 'mirostatSampling':
          return (
            <select
              value={value as number}
              onChange={(e) => updateValue(parseInt(e.target.value))}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
            >
              <option value={0}>Disabled</option>
              <option value={1}>Mirostat 1.0</option>
              <option value={2}>Mirostat 2.0</option>
            </select>
          );

        case 'reasoningEffort':
          if (provider === 'ollama') {
            return (
              <select
                value={value as string}
                onChange={(e) => updateValue(e.target.value)}
                disabled={disabled || !isEnabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            );
          } else if (provider === 'openai') {
            return (
              <select
                value={value as string}
                onChange={(e) => updateValue(e.target.value)}
                disabled={disabled || !isEnabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            );
          }
          return null;

        case 'responseFormat':
          return (
            <select
              value={value as string}
              onChange={(e) => updateValue(e.target.value)}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
            >
              <option value="text">Text</option>
              <option value="json_object">JSON Object</option>
            </select>
          );

        case 'toolChoice':
          return (
            <select
              value={value as string}
              onChange={(e) => updateValue(e.target.value)}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
            >
              <option value="auto">Auto</option>
              <option value="any">Any</option>
              <option value="tool">Specific Tool</option>
            </select>
          );

        case 'stopSequences':
          return (
            <textarea
              value={(value as string[]).join('\n')}
              onChange={(e) => updateValue(e.target.value.split('\n').filter(s => s.trim()))}
              disabled={disabled || !isEnabled}
              placeholder="Enter stop sequences (one per line)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
              rows={3}
            />
          );

        case 'format':
        case 'jsonSchema':
        case 'systemPrompt':
        case 'user':
          return (
            <textarea
              value={value as string}
              onChange={(e) => updateValue(e.target.value)}
              disabled={disabled || !isEnabled}
              placeholder={`Enter ${paramName}...`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
              rows={3}
            />
          );

        case 'harmonyMode':
        case 'think':
        case 'keepAlive':
          return (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={(e) => updateValue(e.target.checked)}
                disabled={disabled || !isEnabled}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded disabled:cursor-not-allowed"
              />
              <span className="ml-2 text-sm text-white">
                {paramName === 'harmonyMode' && 'Enable Harmony Mode (GPT-OSS)'}
                {paramName === 'think' && 'Enable Thinking Mode (Qwen/DeepSeek)'}
                {paramName === 'keepAlive' && 'Keep model loaded in memory'}
              </span>
            </div>
          );

        default:
          return (
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => updateValue(e.target.value)}
              disabled={disabled || !isEnabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
            />
          );
      }
    };

    const getParameterLabel = (paramName: string): string => {
      const labels: Record<string, string> = {
        temperature: 'Temperature',
        topP: 'Top P',
        topK: 'Top K',
        maxTokens: 'Max Tokens',
        repeatPenalty: 'Repeat Penalty',
        numPredict: 'Max Tokens (Ollama)',
        mirostatSampling: 'Mirostat Sampling',
        mirostatEta: 'Mirostat Eta',
        mirostatTau: 'Mirostat Tau',
        contextWindow: 'Context Window',
        gpuLayers: 'GPU Layers',
        numThread: 'CPU Threads',
        repeatLastN: 'Repeat Last N',
        tfsZ: 'TFS Z',
        seed: 'Seed',
        keepAlive: 'Keep Alive',
        format: 'Response Format',
        jsonSchema: 'JSON Schema',
        stopSequences: 'Stop Sequences',
        harmonyMode: 'Harmony Mode',
        presencePenalty: 'Presence Penalty',
        frequencyPenalty: 'Frequency Penalty',
        reasoningEffort: 'Reasoning Effort',
        think: 'Thinking Mode',
        logitBias: 'Logit Bias',
        user: 'User ID',
        responseFormat: 'Response Format',
        repetitionPenalty: 'Repetition Penalty',
        minP: 'Min P',
        typicalP: 'Typical P',
        baseURL: 'Base URL',
        systemPrompt: 'System Prompt',
        toolChoice: 'Tool Choice'
      };
      return labels[paramName] || paramName;
    };

    const getParameterDescription = (paramName: string): string => {
      const descriptions: Record<string, string> = {
        temperature: 'Controls randomness (0.0 = deterministic, 1.0 = creative)',
        topP: 'Nucleus sampling threshold',
        topK: 'Limits vocabulary to top K tokens',
        maxTokens: 'Maximum tokens to generate',
        repeatPenalty: 'Penalty for repeating tokens',
        mirostatSampling: 'Advanced sampling algorithm',
        contextWindow: 'Maximum context length',
        gpuLayers: 'Number of layers to run on GPU',
        reasoningEffort: 'Reasoning depth for o1/GPT-OSS models',
        presencePenalty: 'Penalty for token presence',
        frequencyPenalty: 'Penalty for token frequency',
        stopSequences: 'Sequences that stop generation',
        harmonyMode: 'Special reasoning mode for GPT-OSS',
        think: 'Enable thinking process for Qwen/DeepSeek',
        baseURL: 'LM Studio server URL (default: uses environment variable)'
      };
      return descriptions[paramName] || '';
    };

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">
            {getParameterLabel(paramName)}
          </label>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={toggleEnabled}
            disabled={disabled}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 bg-gray-700 border-gray-600 rounded"
          />
        </div>
        
        {renderInput()}
        
        {getParameterDescription(paramName) && (
          <p className="text-xs text-gray-400">
            {getParameterDescription(paramName)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {relevantParams.map(paramName => (
        <div key={paramName}>
          {renderParameter(paramName)}
        </div>
      ))}
    </div>
  );
};
