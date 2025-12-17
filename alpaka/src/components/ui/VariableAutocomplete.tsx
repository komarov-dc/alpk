'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store/useFlowStore';

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  availableVariables?: string[];
}

export const VariableAutocomplete = ({
  value,
  onChange,
  placeholder = 'Enter text... Use @ for variables',
  rows = 3,
  className = '',
  availableVariables = []
}: VariableAutocompleteProps) => {
  const { getGlobalVariableNames, executionResults, nodes, edges, getVariableColor } = useFlowStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [triggerChar, setTriggerChar] = useState<'@' | '/' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get all available variables
  const getAllVariables = useCallback(() => {
    const global = getGlobalVariableNames();
    
    // Get variables from executed nodes
    const nodeVariables: string[] = [];
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      if (result?.success && result.output) {
        const node = nodes.find(n => n.id === nodeId);
        const nodeLabel = (node?.data?.label as string) || (node?.type as string) || `Node_${nodeId.slice(-4)}`;
        const output = result.output as Record<string, unknown>;
        
        if (output.type !== 'trigger' && output.type !== 'modelProvider') {
          nodeVariables.push(nodeLabel);
        }
      }
    });
    
    const allVariables = [...availableVariables, ...global, ...nodeVariables];
    return [...new Set(allVariables)].sort(); // Remove duplicates and sort
  }, [availableVariables, getGlobalVariableNames, executionResults, nodes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check for trigger characters @ or /
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastChar = textBeforeCursor[textBeforeCursor.length - 1];

    if (lastChar === '@' || lastChar === '/') {
      // Check if it's not inside a variable already
      const openBraces = (textBeforeCursor.match(/\{\{/g) || []).length;
      const closeBraces = (textBeforeCursor.match(/\}\}/g) || []).length;
      
      if (openBraces === closeBraces) { // Not inside a variable
        setTriggerChar(lastChar as '@' | '/');
        setShowSuggestions(true);
        const allVars = getAllVariables();
        setSuggestions(allVars);
        setSelectedSuggestion(0);
        // Variable autocomplete triggered
      }
    } else if (triggerChar && (lastChar === ' ' || lastChar === '\n' || lastChar === '\t')) {
      // Close suggestions on whitespace
      setShowSuggestions(false);
      setTriggerChar(null);
    } else if (triggerChar) {
      // Filter suggestions based on typed text
      const triggerIndex = textBeforeCursor.lastIndexOf(triggerChar);
      const searchText = textBeforeCursor.slice(triggerIndex + 1).toLowerCase();
      
      if (searchText.length > 0) {
        const filtered = getAllVariables().filter(variable =>
          variable.toLowerCase().includes(searchText)
        );
        setSuggestions(filtered);
        setSelectedSuggestion(0);
      } else {
        setSuggestions(getAllVariables());
        setSelectedSuggestion(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[selectedSuggestion]) {
        applyVariable(suggestions[selectedSuggestion]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setTriggerChar(null);
    }
  };

  const applyVariable = useCallback((variable: string) => {
    if (textareaRef.current && triggerChar) {
      const textarea = textareaRef.current;
      // Find the position of the trigger character
      const textBeforeCursor = value.slice(0, cursorPosition);
      const triggerIndex = textBeforeCursor.lastIndexOf(triggerChar);
      
      // Remove trigger char and any search text after it
      const beforeTrigger = value.slice(0, triggerIndex);
      const afterCursor = value.slice(cursorPosition);
      const newValue = `${beforeTrigger}{{${variable}}}${afterCursor}`;
      
      onChange(newValue);
      setShowSuggestions(false);
      setTriggerChar(null);
      
      // Set cursor after the variable ({{variable}} = variable.length + 4 chars)
      const newCursorPos = beforeTrigger.length + variable.length + 4;
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      });
    }
  }, [value, onChange, triggerChar, cursorPosition]);

  const handleSuggestionClick = useCallback((variable: string) => {
    applyVariable(variable);
  }, [applyVariable]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setTriggerChar(null);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    // Return undefined for the else case
    return;
  }, [showSuggestions]);

  // Function to get variable color
  const getVariableDisplayColor = useCallback((variable: string) => {
    // Search for variable source
    for (const [nodeId, result] of Object.entries(executionResults)) {
      if (result?.success && result.output) {
        const node = nodes.find(n => n.id === nodeId);
        const nodeLabel = (node?.data?.label as string) || (node?.type as string) || `Node_${nodeId.slice(-4)}`;
        
        if (variable === nodeLabel) {
          const edge = edges.find(e => e.source === nodeId);
          if (edge) {
            return getVariableColor(edge.source, edge.target);
          }
        }
      }
    }
    
    // For global variables use neutral color
    return '#6B7280'; // gray-500
  }, [executionResults, nodes, edges, getVariableColor]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full text-sm bg-gray-800 text-white placeholder-gray-400 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none font-mono ${className}`}
        style={{ minHeight: `${rows * 1.2}em` }}
      />

      {/* Variable Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
            💡 Use {triggerChar} to insert variables
          </div>
          {suggestions.map((variable, index) => (
            <button
              key={variable}
              type="button"
              onClick={() => handleSuggestionClick(variable)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-gray-700 last:border-b-0 transition-colors flex items-center space-x-2 ${
                index === selectedSuggestion 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-200 hover:bg-gray-700'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500"
                style={{ backgroundColor: getVariableDisplayColor(variable) }}
              />
              <span className="font-mono text-blue-400">
                {`{{${variable}}}`}
              </span>
              <span className="text-gray-400">{variable}</span>
              {index === selectedSuggestion && (
                <span className="text-xs text-blue-300 ml-auto">↵</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};