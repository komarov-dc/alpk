'use client';

import React, { useMemo, memo } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { 
  categorizeVariable, 
  VARIABLE_COLORS,
  VariableSource,
  getTypeIndicator
} from '@/utils/variableCategories';

interface VariableHighlightedTextProps {
  text: string;
  className?: string;
  showValues?: boolean; // Whether to show variable values instead of names
  nodeId?: string; // Current node ID to check for pending variables
}

interface ParsedSegment {
  type: 'text' | 'variable';
  content: string;
  variableName?: string;
  variableValue?: string;
  variableType?: string;
  variableSource?: VariableSource;
  exists: boolean;
}

export const VariableHighlightedText = memo(({ 
  text, 
  className = '',
  showValues = false,
  nodeId 
}: VariableHighlightedTextProps) => {
  const { globalVariables, executionResults, nodes, edges } = useFlowStore();
  
  // Parse text and identify variables
  const parsedSegments = useMemo((): ParsedSegment[] => {
    const segments: ParsedSegment[] = [];
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let lastIndex = 0;
    let match;
    
    while ((match = variablePattern.exec(text)) !== null) {
      // Add text before variable
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
          exists: true
        });
      }
      
      const variableName = match[1]?.trim() || '';
      
      // Use unified categorization
      const categorization = categorizeVariable(variableName, {
        globalVariables,
        executionResults,
        nodes,
        edges,
        currentNodeId: nodeId
      });
      
      // Detect type from value if available
      let variableType = 'string';
      if (categorization.value) {
        try {
          const parsed = JSON.parse(categorization.value);
          if (Array.isArray(parsed)) variableType = 'array';
          else if (typeof parsed === 'object' && parsed !== null) variableType = 'json';
          else if (typeof parsed === 'number') variableType = 'number';
          else if (typeof parsed === 'boolean') variableType = 'boolean';
        } catch {
          // It's a string
        }
      }
      
      segments.push({
        type: 'variable',
        content: match[0],
        variableName,
        variableValue: categorization.value,
        variableType,
        variableSource: categorization.source,
        exists: categorization.exists
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex),
        exists: true
      });
    }
    
    return segments;
  }, [text, globalVariables, executionResults, nodes, edges, nodeId]);
  
  return (
    <span className={className}>
      {parsedSegments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        }
        
        const typeInfo = getTypeIndicator(segment.variableType);
        const colorInfo = VARIABLE_COLORS[segment.variableSource || VariableSource.MISSING];
        const hasValue = segment.variableValue !== undefined;
        
        if (showValues && hasValue) {
          // Show the actual value with subtle variable indication
          return (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colorInfo.bg} transition-colors`}
              title={`Variable: {{${segment.variableName}}}`}
            >
              <span
                className="text-[10px] font-mono opacity-60"
                style={{ color: typeInfo.color }}
              >
                {typeInfo.icon}
              </span>
              <span className="text-current">
                {segment.variableValue}
              </span>
            </span>
          );
        }
        
        // Show the variable name with styling
        const tooltipText = 
          segment.variableSource === VariableSource.PENDING ? 'Will be available after execution' :
          segment.variableSource === VariableSource.TRANSITIVE ? 'Reachable through chain of connections' :
          segment.variableSource === VariableSource.MISSING ? 'Variable not found' :
          hasValue ? `Value: ${segment.variableValue}` : 'Variable not found';
        
        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-sm ${colorInfo.bg} transition-colors group hover:bg-opacity-30`}
            title={tooltipText}
          >
            <span className="text-[10px]">
              {colorInfo.icon}
            </span>
            <span className={colorInfo.text}>
              {'{{'}<span className={`${colorInfo.text} opacity-90`}>
                {segment.variableName}
              </span>{'}}'}
            </span>
            {segment.variableSource === VariableSource.MISSING && (
              <span className="text-red-400 text-[10px]" title="Variable not found">
                !
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
});

VariableHighlightedText.displayName = 'VariableHighlightedText';