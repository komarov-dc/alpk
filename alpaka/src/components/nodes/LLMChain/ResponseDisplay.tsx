/**
 * Response Display Component
 * Shows LLM responses with proper formatting and thinking/reasoning support
 */

import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { VariableHighlightedText } from '@/components/ui/VariableHighlightedText';

interface ResponseDisplayProps {
  response?: {
    response?: string;
    thinking?: string;
    text?: string;
  };
  streamingResponse?: string;
  streamingThinking?: string;
  isStreaming: boolean;
  error?: string;
}

export const ResponseDisplay = memo(({
  response,
  streamingResponse,
  streamingThinking,
  isStreaming,
  error
}: ResponseDisplayProps) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedThinking, setCopiedThinking] = useState(false);
  
  // Determine what to show
  const hasResponse = response?.response || streamingResponse;
  const hasThinking = response?.thinking || streamingThinking;
  
  // Copy to clipboard handler
  const copyToClipboard = useCallback(async (text: string, type: 'response' | 'thinking') => {
    try {
      // Clean up the text:
      // 1. Replace escaped newlines (\n) with spaces for better readability
      // 2. Collapse multiple spaces
      // 3. Replace multiple consecutive newlines with double newline (paragraph break)
      // 4. Trim whitespace
      const cleanedText = text
        .replace(/\\n/g, ' ')  // Replace \n (escaped) with space
        .replace(/  +/g, ' ')  // Collapse multiple spaces into one
        .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with just 2
        .trim();
      
      await navigator.clipboard.writeText(cleanedText);
      if (type === 'response') {
        setCopiedResponse(true);
        setTimeout(() => setCopiedResponse(false), 2000);
      } else {
        setCopiedThinking(true);
        setTimeout(() => setCopiedThinking(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);
  
  if (error) {
    return (
      <div className="p-3 bg-red-900/50 border border-red-600 rounded">
        <div className="text-sm font-semibold text-red-400 mb-1">❌ Error</div>
        <div className="text-sm text-red-200">{error}</div>
      </div>
    );
  }
  
  if (!hasResponse && !hasThinking && !isStreaming) {
    return (
      <div className="text-gray-500 text-sm italic text-center py-8">
        No response yet. Execute the node to get a response.
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3"
    >
      {/* Main Response */}
      {hasResponse && (
        <div className="p-3 bg-green-900/50 border border-green-600 rounded">
          <div className="text-xs font-semibold text-green-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>💬</span>
              Response
            </div>
            <button
              onClick={() => copyToClipboard(response?.response || streamingResponse || '', 'response')}
              className="px-2 py-1 text-xs bg-green-700/50 hover:bg-green-600/50 border border-green-500/50 rounded transition-colors flex items-center gap-1"
              title="Copy response to clipboard"
            >
              {copiedResponse ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-auto max-h-64 leading-relaxed">
            {response?.response ? (
              <VariableHighlightedText 
                text={response.response}
                showValues={true}
              />
            ) : (
              streamingResponse
            )}
          </div>
        </div>
      )}
      
      {/* Thinking/Reasoning */}
      {hasThinking && (
        <div className="p-3 bg-blue-900/50 border border-blue-600 rounded">
          <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              Thinking Process
            </div>
            <button
              onClick={() => copyToClipboard(response?.thinking || streamingThinking || '', 'thinking')}
              className="px-2 py-1 text-xs bg-blue-700/50 hover:bg-blue-600/50 border border-blue-500/50 rounded transition-colors flex items-center gap-1"
              title="Copy thinking process to clipboard"
            >
              {copiedThinking ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap break-words overflow-auto max-h-48 opacity-90 leading-relaxed">
            {response?.thinking || streamingThinking}
          </div>
        </div>
      )}
    </motion.div>
  );
});

ResponseDisplay.displayName = 'ResponseDisplay';
