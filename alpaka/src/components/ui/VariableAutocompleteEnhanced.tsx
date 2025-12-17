'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFlowStore } from '@/store/useFlowStore';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_CONFIG } from '@/config/constants';

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  availableVariables?: string[];
  nodeId?: string; // Current node ID to find incoming connections
}

interface VariableInfo {
  name: string;
  value: string;
  type?: string;
  description?: string;
  folder?: string;
  source?: 'global' | 'input' | 'node' | 'workflow';
  nodeId?: string;
  isPending?: boolean; // Indicates if this variable is from a connected but not executed node
}

// Get type-based color and icon
const getTypeIndicator = (type?: string) => {
  switch(type) {
    case 'number': return { color: '#60A5FA', icon: '#', bgClass: 'bg-blue-500/20' };
    case 'boolean': return { color: '#4ADE80', icon: '✓', bgClass: 'bg-green-500/20' };
    case 'json': return { color: '#C084FC', icon: '{}', bgClass: 'bg-purple-500/20' };
    case 'array': return { color: '#FB923C', icon: '[]', bgClass: 'bg-orange-500/20' };
    case 'object': return { color: '#C084FC', icon: '{}', bgClass: 'bg-purple-500/20' };
    default: return { color: '#9CA3AF', icon: 'Aa', bgClass: 'bg-gray-500/20' };
  }
};

// Get source-based color
const getSourceColor = (source?: string, isPending?: boolean) => {
  if (isPending) {
    return '#EAB308'; // yellow for pending
  }
  switch(source) {
    case 'global': return '#8B5CF6'; // purple
    case 'input': return '#EAB308'; // yellow
    case 'node': return '#10B981'; // green
    case 'workflow': return '#3B82F6'; // blue
    default: return '#6B7280'; // gray
  }
};

export const VariableAutocompleteEnhanced = ({
  value,
  onChange,
  placeholder = 'Enter text... Use @ for variables',
  rows = 3,
  className = '',
  availableVariables = [],
  nodeId
}: VariableAutocompleteProps) => {
  const { 
    globalVariables,
    executionResults, 
    nodes,
    edges
  } = useFlowStore();
  
  // Use local state for value to prevent cursor jumping
  const [localValue, setLocalValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<VariableInfo[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [triggerChar, setTriggerChar] = useState<'@' | '/' | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalTargetRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value with prop value when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Debounced onChange to parent
  useEffect(() => {
    if (localValue !== value) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange(localValue);
      }, UI_CONFIG.THROTTLE_DELAY); // Small debounce to batch updates
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localValue, onChange, value]);
  
  // Create portal target on mount
  useEffect(() => {
    const portalDiv = document.createElement('div');
    portalDiv.id = 'variable-autocomplete-portal';
    document.body.appendChild(portalDiv);
    portalTargetRef.current = portalDiv;
    
    return () => {
      document.body.removeChild(portalDiv);
    };
  }, []);

  // Get all available variables with metadata
  const getAllVariablesWithInfo = useCallback((): VariableInfo[] => {
    const variablesMap = new Map<string, VariableInfo>();
    
    // 1. Global variables from Variable Manager
    Object.entries(globalVariables).forEach(([key, variable]) => {
      if (!key.startsWith('workflow:')) {
        // Detect type from value
        let type = 'string';
        try {
          const parsed = JSON.parse(variable.value);
          if (Array.isArray(parsed)) type = 'array';
          else if (typeof parsed === 'object' && parsed !== null) type = 'json';
          else if (typeof parsed === 'number') type = 'number';
          else if (typeof parsed === 'boolean') type = 'boolean';
        } catch {
          // It's a string
        }
        
        variablesMap.set(key, {
          name: key,
          value: variable.value,
          type,
          description: variable.description,
          folder: variable.folder,
          source: 'global'
        });
      }
    });
    
    // 2. Workflow variables
    Object.entries(globalVariables).forEach(([key, variable]) => {
      if (key.startsWith('workflow:')) {
        const name = key.replace('workflow:', '');
        variablesMap.set(name, {
          name,
          value: variable.value,
          type: 'string',
          description: variable.description,
          source: 'workflow'
        });
      }
    });
    
    // 3. Node execution results
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      if (result?.success && result.output) {
        const node = nodes.find(n => n.id === nodeId);
        const nodeLabel = (node?.data?.label as string) || (node?.type as string) || `Node_${nodeId.slice(-4)}`;
        const output = result.output as Record<string, unknown>;
        
        if (output.type !== 'trigger' && output.type !== 'modelProvider') {
          let type = 'string';
          if (typeof output.value === 'number') type = 'number';
          else if (typeof output.value === 'boolean') type = 'boolean';
          else if (typeof output.value === 'object') type = output.value && Array.isArray(output.value) ? 'array' : 'json';
          
          variablesMap.set(nodeLabel, {
            name: nodeLabel,
            value: JSON.stringify(output.value || output),
            type,
            description: `Output from ${node?.type || 'node'}`,
            source: 'node',
            nodeId
          });
        }
      }
    });
    
    // 4. Input node variables
    nodes.filter(n => n.type === 'input').forEach(node => {
      if (node.data?.value) {
        const varName = (node.data.label as string) || `input_${node.id.slice(-6)}`;
        if (!variablesMap.has(varName)) {
          variablesMap.set(varName, {
            name: varName,
            value: String(node.data.value),
            type: 'string',
            description: 'Input node variable',
            source: 'input',
            nodeId: node.id
          });
        }
      }
    });
    
    // 5. Additional available variables passed as props
    availableVariables.forEach(varName => {
      if (!variablesMap.has(varName)) {
        variablesMap.set(varName, {
          name: varName,
          value: '',
          type: 'string',
          source: 'global'
        });
      }
    });
    
    // 6. Pending variables from connected but not executed nodes
    if (nodeId) {
      // Find all edges where current node is the target (incoming connections)
      const incomingEdges = edges.filter(e => e.target === nodeId);
      
      incomingEdges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) {
          const nodeName = (sourceNode.data?.label as string) || 
                          (sourceNode.type as string) || 
                          `Node_${sourceNode.id.slice(-4)}`;
          
          // Check if we already have this variable from executionResults
          if (!variablesMap.has(nodeName)) {
            // Determine expected type based on node type
            let expectedType = 'unknown';
            let description = `Output from ${sourceNode.type || 'node'} (pending execution)`;
            
            // Special handling for known node types
            if (sourceNode.type === 'llmChain' || sourceNode.type === 'basicLLMChain') {
              expectedType = 'string';
              description = 'LLM response (pending execution)';
            } else if (sourceNode.type === 'input') {
              // Input nodes should already be handled above, but just in case
              expectedType = 'string';
              description = 'Input value (pending)';
            } else if (sourceNode.type === 'code') {
              expectedType = 'any';
              description = 'Code execution result (pending)';
            } else if (sourceNode.type === 'output') {
              // Output nodes don't produce variables
              return;
            }
            
            variablesMap.set(nodeName, {
              name: nodeName,
              value: '<pending>',
              type: expectedType,
              description,
              source: 'node',
              nodeId: sourceNode.id,
              isPending: true
            });
          }
        }
      });
    }
    
    return Array.from(variablesMap.values()).sort((a, b) => {
      // Sort by source priority: input > node > global > workflow
      const sourcePriority = { input: 0, node: 1, global: 2, workflow: 3 };
      const aPriority = sourcePriority[a.source || 'global'];
      const bPriority = sourcePriority[b.source || 'global'];
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [globalVariables, executionResults, nodes, edges, availableVariables, nodeId]);

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!textareaRef.current || !showSuggestions) return;
    
    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 300; // Approximate max height
    
    // Determine if dropdown should appear above or below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      // Show above
      setDropdownDirection('up');
      setDropdownPosition({
        top: rect.top - dropdownHeight - 4,
        left: rect.left,
        width: rect.width
      });
    } else {
      // Show below
      setDropdownDirection('down');
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showSuggestions]);

  // Update dropdown position on scroll or resize
  useEffect(() => {
    if (showSuggestions) {
      updateDropdownPosition();
      
      const handleScrollOrResize = () => updateDropdownPosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
    return undefined;
  }, [showSuggestions, updateDropdownPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    // Update local state immediately (prevents cursor jump)
    setLocalValue(newValue);

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
        const allVars = getAllVariablesWithInfo();
        setSuggestions(allVars);
        setSelectedSuggestion(0);
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
        const filtered = getAllVariablesWithInfo().filter(variable =>
          variable.name.toLowerCase().includes(searchText) ||
          (variable.description?.toLowerCase().includes(searchText) ?? false)
        );
        setSuggestions(filtered);
        setSelectedSuggestion(0);
      } else {
        setSuggestions(getAllVariablesWithInfo());
        setSelectedSuggestion(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        suggestions.length > 0 ? (prev + 1) % suggestions.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        suggestions.length > 0 ? (prev - 1 + suggestions.length) % suggestions.length : 0
      );
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

  const applyVariable = useCallback((variable: VariableInfo) => {
    if (textareaRef.current && triggerChar) {
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart || 0;
      
      // Find the position of the trigger character
      const textBeforeCursor = localValue.slice(0, cursorPos);
      const triggerIndex = textBeforeCursor.lastIndexOf(triggerChar);
      
      // Remove trigger char and any search text after it
      const beforeTrigger = localValue.slice(0, triggerIndex);
      const afterCursor = localValue.slice(cursorPos);
      const newValue = `${beforeTrigger}{{${variable.name}}}${afterCursor}`;
      
      setLocalValue(newValue);
      setShowSuggestions(false);
      setTriggerChar(null);
      
      // Calculate new cursor position (after the closing }})
      const newCursorPos = beforeTrigger.length + variable.name.length + 4;
      
      // Set cursor position after React renders the new value
      // Use setTimeout to ensure the value is updated in the DOM
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  }, [localValue, triggerChar]);

  const handleSuggestionClick = useCallback((variable: VariableInfo) => {
    applyVariable(variable);
  }, [applyVariable]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        textareaRef.current && 
        !textareaRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setShowSuggestions(false);
        setTriggerChar(null);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showSuggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (showSuggestions && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedSuggestion}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedSuggestion, showSuggestions]);

  // Render dropdown in portal
  const renderDropdown = () => {
    if (!showSuggestions || suggestions.length === 0 || !dropdownPosition || !portalTargetRef.current) {
      return null;
    }

    return createPortal(
      <AnimatePresence>
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: dropdownDirection === 'down' ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dropdownDirection === 'down' ? -10 : 10 }}
          transition={{ duration: UI_CONFIG.ANIMATION_DURATION_SHORT / 1000 }}
          className="fixed z-[9999] bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '300px'
          }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              💡 Use {triggerChar} to insert variables
            </span>
            <span className="text-xs text-gray-500">
              {suggestions.length} variable{suggestions.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Suggestions list */}
          <div className="overflow-y-auto max-h-[250px]">
            {suggestions.map((variable, index) => {
              const typeInfo = getTypeIndicator(variable.type);
              const sourceColor = getSourceColor(variable.source, variable.isPending);
              
              return (
                <button
                  key={`${variable.name}-${index}`}
                  type="button"
                  data-index={index}
                  onClick={() => handleSuggestionClick(variable)}
                  onMouseEnter={() => setSelectedSuggestion(index)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-700 last:border-b-0 transition-all duration-150 ${
                    index === selectedSuggestion 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-200 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Color indicator */}
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 border border-gray-600"
                      style={{ backgroundColor: sourceColor }}
                      title={`Source: ${variable.source}`}
                    />
                    
                    {/* Variable info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-blue-400">
                          <span>{'{{'}</span>
                          <span className="text-blue-300">{variable.name}</span>
                          <span>{'}}'}</span>
                        </span>
                        
                        {/* Type badge */}
                        <span 
                          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            index === selectedSuggestion ? 'bg-blue-700' : typeInfo.bgClass
                          }`}
                          style={{ color: index === selectedSuggestion ? '#FFF' : typeInfo.color }}
                        >
                          {typeInfo.icon}
                        </span>
                        
                        {/* Source badge */}
                        {variable.source && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            index === selectedSuggestion 
                              ? 'bg-blue-700 text-white' 
                              : variable.isPending
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-gray-700 text-gray-400'
                          }`}>
                            {variable.isPending && '⏳'}
                            {!variable.isPending && variable.source === 'input' && '📥'}
                            {!variable.isPending && variable.source === 'node' && '🔧'}
                            {variable.source === 'global' && '🌍'}
                            {variable.source === 'workflow' && '⚡'}
                            {' '}{variable.isPending ? 'pending' : variable.source}
                          </span>
                        )}
                        
                        {/* Folder badge */}
                        {variable.folder && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            index === selectedSuggestion 
                              ? 'bg-blue-700 text-white' 
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            📁 {variable.folder.split('/').pop()}
                          </span>
                        )}
                      </div>
                      
                      {/* Description */}
                      {variable.description && (
                        <div className={`text-xs mt-1 ${
                          index === selectedSuggestion ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {variable.description}
                        </div>
                      )}
                      
                      {/* Value preview */}
                      {variable.value && (
                        <div className={`text-xs mt-1 font-mono truncate ${
                          index === selectedSuggestion ? 'text-blue-200' : 
                          variable.isPending ? 'text-yellow-500 italic' : 'text-gray-500'
                        }`}>
                          {variable.isPending ? (
                            <span>⏳ Will be available after execution</span>
                          ) : (
                            variable.value.length > 50 
                              ? variable.value.substring(0, 50) + '...' 
                              : variable.value
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Selection indicator */}
                    {index === selectedSuggestion && (
                      <span className="text-xs text-blue-200 ml-auto">↵</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>,
      portalTargetRef.current
    );
  };

  return (
    <>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={`w-full text-sm bg-gray-800 text-white placeholder-gray-400 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none font-mono ${className}`}
          style={{ minHeight: `${rows * 1.5}em` }}
        />
        
        {/* Show indicator when dropdown is active */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-1 right-1 text-xs text-blue-400 pointer-events-none">
            ↑↓ Navigate • ↵ Select • Esc Close
          </div>
        )}
      </div>
      
      {/* Render dropdown in portal */}
      {renderDropdown()}
    </>
  );
};