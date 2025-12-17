import React, { useState, useRef, useEffect } from 'react';
import { OllamaModel } from '@/hooks/useOllamaModels';

interface ModelTag {
  label: string;
  color: string;
  bgColor: string;
}

interface CustomModelDropdownProps {
  models: OllamaModel[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Определяем теги для разных типов моделей
const getModelTags = (modelName: string): ModelTag[] => {
  const name = modelName.toLowerCase();
  const tags: ModelTag[] = [];

  // GPT-OSS models
  if (name.includes('gpt-oss')) {
    tags.push({
      label: '🎭 Harmony',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100 border-purple-200'
    });
    tags.push({
      label: '🧠 Reasoning',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100 border-purple-200'
    });
  }

  // Qwen3 models (thinking support)
  if (name.includes('qwen3') || name.includes('qwen-3')) {
    tags.push({
      label: '💭 Thinking',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100 border-blue-200'
    });
    tags.push({
      label: '🛠️ Tools',
      color: 'text-green-700',
      bgColor: 'bg-green-100 border-green-200'
    });
  }

  // DeepSeek R1 models
  if (name.includes('deepseek-r1')) {
    tags.push({
      label: '💭 Thinking',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100 border-blue-200'
    });
    tags.push({
      label: '🔬 Research',
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-100 border-indigo-200'
    });
  }

  // Tool calling capable models
  if (name.includes('qwen') || name.includes('llama3') || name.includes('mistral') || name.includes('gemma')) {
    if (!tags.some(tag => tag.label.includes('Tools'))) {
      tags.push({
        label: '🛠️ Tools',
        color: 'text-green-700',
        bgColor: 'bg-green-100 border-green-200'
      });
    }
  }

  // Large context models
  if (name.includes('120b') || name.includes('128k') || name.includes('32k')) {
    tags.push({
      label: '📚 Large Context',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100 border-orange-200'
    });
  }

  // High performance models
  if (name.includes('fp16') || name.includes('q8_0')) {
    tags.push({
      label: '⚡ High Perf',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100 border-yellow-200'
    });
  }

  return tags;
};

export const CustomModelDropdown: React.FC<CustomModelDropdownProps> = ({
  models,
  value,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find(model => model.name === value);
  const filteredModels = models.filter(model =>
    model.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (modelName: string) => {
    onChange(modelName);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedModel ? (
              <div className="space-y-1">
                <div className="font-medium text-gray-900 truncate">
                  {selectedModel.displayName}
                </div>
                <div className="flex flex-wrap gap-1">
                  {getModelTags(selectedModel.name).map((tag, index) => (
                    <span
                      key={index}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tag.bgColor} ${tag.color}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-gray-500">Select a model...</span>
            )}
          </div>
          <div className="ml-2 flex-shrink-0">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Model List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredModels.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No models found
              </div>
            ) : (
              filteredModels.map((model) => {
                const tags = getModelTags(model.name);
                const isSelected = model.name === value;
                
                return (
                  <button
                    key={model.name}
                    type="button"
                    onClick={() => handleSelect(model.name)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className={`font-medium truncate ${
                        isSelected ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {model.displayName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {model.name}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((tag, index) => (
                            <span
                              key={index}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${tag.bgColor} ${tag.color}`}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
