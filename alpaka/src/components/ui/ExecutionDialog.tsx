'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ExecutionStats {
  totalNodes: number;
  completedNodes: number;
  remainingNodes: number;
  hasResults: boolean;
}

interface ExecutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (mode: 'continue' | 'restart') => void;
  stats: ExecutionStats;
}

export const ExecutionDialog: React.FC<ExecutionDialogProps> = ({
  isOpen,
  onClose,
  onExecute,
  stats
}) => {
  if (!isOpen) return null;

  const handleModeSelect = (mode: 'continue' | 'restart') => {
    onExecute(mode);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-900 rounded-lg shadow-2xl w-96 border border-gray-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h2 className="text-lg font-semibold text-white">Execute Workflow</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Current Status */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span>📊</span>
                Current Status
              </h3>
              
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total nodes:</span>
                  <span className="text-sm font-mono text-white">{stats.totalNodes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Completed:</span>
                  <span className="text-sm font-mono text-green-400">{stats.completedNodes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Remaining:</span>
                  <span className="text-sm font-mono text-blue-400">{stats.remainingNodes}</span>
                </div>
                
                {/* Progress bar */}
                {stats.totalNodes > 0 && (
                  <div className="pt-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.round((stats.completedNodes / stats.totalNodes) * 100)}%` 
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {Math.round((stats.completedNodes / stats.totalNodes) * 100)}% completed
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Execution Mode Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span>⚡</span>
                Choose execution mode
              </h3>
              
              <div className="space-y-3">
                {/* Continue Mode */}
                <button
                  onClick={() => handleModeSelect('continue')}
                  className={`w-full p-4 text-left rounded-lg border transition-all hover:scale-[1.02] ${
                    stats.hasResults 
                      ? 'bg-blue-900/20 border-blue-600/50 hover:bg-blue-900/30 hover:border-blue-500' 
                      : 'bg-gray-800 border-gray-600 opacity-50 cursor-not-allowed'
                  }`}
                  disabled={!stats.hasResults}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-1">🔄</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-400 mb-1">
                        Continue from saved results
                      </div>
                      <div className="text-xs text-gray-400">
                        Execute only {stats.remainingNodes} remaining nodes
                        {!stats.hasResults && ' (no saved results found)'}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Restart Mode */}
                <button
                  onClick={() => handleModeSelect('restart')}
                  className="w-full p-4 text-left rounded-lg border bg-red-900/20 border-red-600/50 hover:bg-red-900/30 hover:border-red-500 transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-1">🔥</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-400 mb-1">
                        Start fresh (clear all results)
                      </div>
                      <div className="text-xs text-gray-400">
                        Re-execute all {stats.totalNodes} nodes from scratch
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
