// Provider Selector Component

import React from 'react';
import { ModelProvider } from './types';
import { PROVIDERS } from './providers';

interface ProviderSelectorProps {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
  disabled?: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-2">
        Provider
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModelProvider)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800 disabled:cursor-not-allowed"
      >
        {PROVIDERS.map((provider) => (
          <option 
            key={provider.value} 
            value={provider.value}
            disabled={!provider.available}
            className="bg-gray-700 text-white"
          >
            {provider.label} {!provider.available && '(Coming Soon)'}
            {provider.apiKeyRequired && ' 🔑'}
          </option>
        ))}
      </select>
      <div className="text-xs text-gray-400 mt-1">
        {PROVIDERS.find(p => p.value === value)?.apiKeyRequired && (
          <span className="text-amber-400">⚠️ Requires API key configuration</span>
        )}
      </div>
    </div>
  );
};
