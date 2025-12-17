'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon, 
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export type AppMode = 'chat' | 'psychodiagnostics' | 'careerGuidance';

interface ModeSelectorProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ModeSelector({ currentMode, onModeChange, isOpen, onClose }: ModeSelectorProps) {
  const modes = [
    {
      id: 'chat' as AppMode,
      title: 'AI Chat',
      description: 'Have a conversation with AI assistant',
      icon: ChatBubbleLeftRightIcon,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'psychodiagnostics' as AppMode,
      title: 'Psychological Diagnostics',
      description: 'Understand your emotional state and personality',
      icon: AcademicCapIcon,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'careerGuidance' as AppMode,
      title: 'Career Guidance',
      description: 'Discover your professional path and opportunities',
      icon: BriefcaseIcon,
      color: 'from-green-500 to-emerald-500',
    },
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Mode</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            
            return (
              <motion.button
                key={mode.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onModeChange(mode.id);
                  onClose();
                }}
                className={`
                  relative p-6 rounded-xl border-2 transition-all
                  ${isActive 
                    ? 'border-blue-500 bg-blue-50 dark:border-white dark:bg-gray-800' 
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full" />
                )}
                
                <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${mode.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {mode.title}
                </h3>
                
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mode.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-400">
            <span className="text-yellow-600 dark:text-yellow-500">💡 Tip:</span> You can switch between modes at any time.
            Your progress in each mode is saved automatically.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}