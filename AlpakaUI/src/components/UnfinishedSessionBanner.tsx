'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface UnfinishedSessionBannerProps {
  sessionId: string;
  sessionMode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  progress: number;
  respondentName?: string;
  onContinue: () => void;
  onDismiss: () => void;
}

export function UnfinishedSessionBanner({
  sessionId,
  sessionMode,
  progress,
  respondentName,
  onContinue,
  onDismiss,
}: UnfinishedSessionBannerProps) {
  const modeLabel = sessionMode === 'PSYCHODIAGNOSTICS' 
    ? 'Психодиагностика' 
    : 'Профориентация';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white px-4 py-3 shadow-lg"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Icon */}
              <div className="flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  У вас есть незавершенная анкета: {modeLabel}
                </p>
                <p className="text-xs opacity-90 mt-0.5">
                  {respondentName && `${respondentName} • `}
                  Прогресс: {progress}% • {sessionId.slice(0, 8)}...
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <div className="w-24 bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{progress}%</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onContinue}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg font-medium text-sm transition-colors"
              >
                <span>Продолжить</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={onDismiss}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Закрыть"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
