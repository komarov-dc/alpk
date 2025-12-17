'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useChat, useChatMessages } from '@/hooks/queries/useChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { LoadingDots } from './ui/Loading';
import { AcademicCapIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

interface ChatViewProps {
  onStartSession: (mode: 'psychodiagnostics' | 'careerGuidance') => void;
}

export function ChatView({ onStartSession }: ChatViewProps) {
  const { activeChatId } = useChatStore();
  const { data: activeChat } = useChat(activeChatId);
  const { data: apiMessages = [], isLoading } = useChatMessages(activeChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Преобразуем ChatMessage[] из API в Message[] для компонента
  const messages = apiMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.createdAt),
    metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined,
  }));
  
  // Auto-scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto scrollbar-custom">
        {!activeChatId || messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center py-4">
            <div className="text-center max-w-sm md:max-w-4xl mx-auto px-4 md:p-8">
              <h1 className="text-xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">
                Выберите режим работы
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6 md:mb-12 text-sm md:text-lg">
                Начните новую сессию диагностики
              </p>
              
              {/* Mode selection */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 max-w-sm md:max-w-4xl mx-auto">
                {/* Psychodiagnostics Card */}
                <button 
                  onClick={() => onStartSession('psychodiagnostics')}
                  className="relative p-4 md:p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600 rounded-xl md:rounded-2xl transition-all group hover:scale-105 flex flex-col min-h-[120px] md:min-h-auto">
                  {/* Icon Container - Fixed height */}
                  <div className="flex justify-center mb-3 md:mb-6">
                    <div className="w-12 h-12 md:w-20 md:h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg md:rounded-xl flex items-center justify-center">
                      <AcademicCapIcon className="w-6 h-6 md:w-10 md:h-10 text-white" />
                    </div>
                  </div>
                  
                  {/* Title - Fixed height with 2 lines */}
                  <div className="flex items-center justify-center mb-2 md:mb-3">
                    <h3 className="text-base md:text-xl font-semibold text-gray-900 dark:text-white text-center leading-5 md:leading-7">
                      Психологическая диагностика
                    </h3>
                  </div>
                </button>
                
                {/* Career Guidance Card */}
                <button
                  onClick={() => onStartSession('careerGuidance')}
                  className="relative p-4 md:p-8 bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-300 dark:border-green-700 hover:border-green-400 dark:hover:border-green-600 rounded-xl md:rounded-2xl transition-all group hover:scale-105 flex flex-col min-h-[120px] md:min-h-auto">
                  
                  {/* Icon Container - Fixed height */}
                  <div className="flex justify-center mb-3 md:mb-6">
                    <div className="w-12 h-12 md:w-20 md:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg md:rounded-xl flex items-center justify-center">
                      <BriefcaseIcon className="w-6 h-6 md:w-10 md:h-10 text-white" />
                    </div>
                  </div>
                  
                  {/* Title - Fixed height with 2 lines */}
                  <div className="flex items-center justify-center mb-2 md:mb-3">
                    <h3 className="text-base md:text-xl font-semibold text-gray-900 dark:text-white text-center leading-5 md:leading-7">
                      Профессиональная ориентация
                    </h3>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-4 p-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <LoadingDots size="sm" color="white" />
                </div>
                <div className="flex-1">
                  <LoadingDots size="md" color="gray" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - только когда есть активный чат */}
      {activeChat && activeChat.messages.length > 0 && (
        <ChatInput />
      )}
    </div>
  );
}