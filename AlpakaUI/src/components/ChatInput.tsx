'use client';

import React, { useRef, useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSendMessage } from '@/hooks/queries/useChat';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';
import { PaperClipIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

export function ChatInput() {
  const {
    activeChatId,
    currentMessage,
    setCurrentMessage,
    clearCurrentMessage,
  } = useChatStore();
  
  const { settings } = useSettingsStore();
  const sendMessageMutation = useSendMessage(activeChatId || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = sendMessageMutation.isPending;
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [currentMessage]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !activeChatId || isLoading) return;

    try {
      await sendMessageMutation.mutateAsync({
        role: 'user',
        content: currentMessage.trim(),
      });
      clearCurrentMessage();
    } catch (error) {
      logger.error('Failed to send message:', normalizeError(error));
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.enterToSend && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/50">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="relative flex items-center gap-3">
          {/* Attachment button */}
          <button
            type="button"
            className="flex-shrink-0 p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Прикрепить файл">
            <PaperClipIcon className="w-5 h-5" />
          </button>
          
          {/* Input field */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите ваше сообщение..."
              disabled={isLoading}
              className="w-full px-3 md:px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg 
                       border border-gray-300 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-600 focus:outline-none 
                       resize-none scrollbar-custom text-base
                       placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
              rows={1}
              style={{ minHeight: '52px', maxHeight: '200px' }}
            />
            
            {/* Character count */}
            {currentMessage.length > 0 && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                {currentMessage.length}
              </div>
            )}
          </div>
          
          {/* Voice input button */}
          <button
            type="button"
            className="flex-shrink-0 p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Голосовой ввод">
            <MicrophoneIcon className="w-5 h-5" />
          </button>
          
          {/* Send/Stop button */}
          <button
            type="submit"
            disabled={!currentMessage.trim() || isLoading}
            className={`flex-shrink-0 p-2.5 rounded-lg transition-all ${
              isLoading
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : currentMessage.trim()
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <StopIcon className="w-5 h-5" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Hints */}
        {(settings.enterToSend || isLoading) && (
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {settings.enterToSend && (
              <>
                <span>Enter — отправить</span>
                <span>Shift + Enter — новая строка</span>
              </>
            )}
            {isLoading && (
              <span className="text-blue-500 dark:text-blue-400 animate-pulse">Обработка...</span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}