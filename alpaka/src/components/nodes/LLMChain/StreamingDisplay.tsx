/**
 * Streaming Display Component
 * Handles real-time streaming output display for LLM responses
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface StreamingDisplayProps {
  isStreaming: boolean;
  streamingResponse: string;
  streamingThinking?: string;
  streamingStats?: {
    tokensPerSecond: number;
    duration: number;
  } | null;
  onStopStreaming: () => void;
}

export const StreamingDisplay = memo(({
  isStreaming,
  streamingResponse,
  streamingThinking,
  streamingStats,
  onStopStreaming
}: StreamingDisplayProps) => {
  if (!isStreaming) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-2"
    >
      {/* Streaming Header */}
      <div className="p-2 bg-yellow-900/50 border border-yellow-600 rounded">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-yellow-400 flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ⚡
            </motion.span>
            Streaming...
          </div>
          <button
            onClick={onStopStreaming}
            className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded flex items-center gap-1 transition-colors"
          >
            ⏹ Stop
            {streamingStats && streamingStats.tokensPerSecond > 0 && (
              <span className="font-mono bg-red-700/50 px-1 rounded">
                {streamingStats.tokensPerSecond.toFixed(0)} t/s
              </span>
            )}
          </button>
        </div>
        
        {/* Response Content */}
        <div className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-auto max-h-48">
          {streamingResponse}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="inline-block ml-0.5"
          >
            ▊
          </motion.span>
        </div>
        
        {/* Stats */}
        {streamingStats && (
          <div className="text-xs text-gray-400 mt-2 flex items-center gap-3">
            <span>{streamingResponse.length} chars</span>
            <span>{(streamingStats.duration / 1000).toFixed(1)}s</span>
            <span>{streamingStats.tokensPerSecond.toFixed(1)} tokens/sec</span>
          </div>
        )}
      </div>
      
      {/* Thinking/Reasoning Display */}
      {streamingThinking && (
        <div className="p-2 bg-blue-900/50 border border-blue-600 rounded">
          <div className="text-xs font-semibold text-blue-400 mb-1">
            🧠 Thinking Process
          </div>
          <div className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-auto max-h-32">
            {streamingThinking}
          </div>
        </div>
      )}
    </motion.div>
  );
});

StreamingDisplay.displayName = 'StreamingDisplay';
