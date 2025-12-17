'use client';

import React from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Настройки</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">

                {/* Размер шрифта */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Размер шрифта
                  </label>
                  <div className="space-y-2">
                    {/* Small */}
                    <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                      <input
                        type="radio"
                        name="fontSize"
                        value="small"
                        checked={settings.fontSize === 'small'}
                        onChange={(e) => updateSettings({ fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Маленький</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Пример текста для чтения</div>
                      </div>
                    </label>

                    {/* Medium */}
                    <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                      <input
                        type="radio"
                        name="fontSize"
                        value="medium"
                        checked={settings.fontSize === 'medium'}
                        onChange={(e) => updateSettings({ fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-base font-medium text-gray-700 dark:text-gray-300">Средний</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Пример текста для чтения</div>
                      </div>
                    </label>

                    {/* Large */}
                    <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                      <input
                        type="radio"
                        name="fontSize"
                        value="large"
                        checked={settings.fontSize === 'large'}
                        onChange={(e) => updateSettings({ fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Большой</div>
                        <div className="text-base text-gray-600 dark:text-gray-400 mt-1">Пример текста для чтения</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Настройки чата */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Настройки чата</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enterToSend}
                        onChange={(e) => updateSettings({ enterToSend: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Enter для отправки сообщения</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTimestamps}
                        onChange={(e) => updateSettings({ showTimestamps: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Показывать время сообщений</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.messageSound}
                        onChange={(e) => updateSettings({ messageSound: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Звук уведомлений</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={resetSettings}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Сбросить настройки
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}