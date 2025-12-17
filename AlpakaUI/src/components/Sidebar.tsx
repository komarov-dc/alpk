'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { SettingsPanel } from './SettingsPanel';
import { formatRelativeTime } from '@/utils/formatters';
import { 
  PlusIcon, 
  TrashIcon, 
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

interface Session {
  id: string;
  mode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  status: string;
  startedAt: string;
  completedAt?: string;
  totalQuestions: number;
  currentIndex: number;
  respondentName?: string | null;
  user?: {
    id: string;
    email: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    role: string;
  };
  responses: Array<{ id: string }>;
}

interface SidebarProps {
  onSessionSelect?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function Sidebar({ onSessionSelect, onNewSession }: SidebarProps = {}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load sessions
  useEffect(() => {
    loadSessions();
  }, []);
  
  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      logger.error('Failed to load sessions:', normalizeError(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleNewSession = () => {
    if (onNewSession) {
      onNewSession();
    }
    // Reload sessions after creating new one
    setTimeout(() => loadSessions(), 500);
  };
  
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    if (onSessionSelect) {
      onSessionSelect(sessionId);
    }
  };
  
  const deleteSession = async (sessionId: string) => {
    if (!confirm('Удалить эту сессию?')) return;

    // Optimistic update - instantly remove from UI
    const previousSessions = sessions;
    setSessions(sessions.filter(s => s.id !== sessionId));

    // If deleted session was selected, clear selection
    if (selectedSessionId === sessionId) {
      handleSessionSelect('');
    }

    // Then make API call in background
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      // Rollback on error - restore previous state
      logger.error('Failed to delete session:', normalizeError(error));
      setSessions(previousSessions);
      alert('Не удалось удалить сессию. Попробуйте еще раз.');
    }
  };
  
  const clearHistory = async () => {
    if (confirm('Очистить всю историю сессий? Это действие нельзя отменить.')) {
      try {
        const response = await fetch('/api/sessions/clear', { 
          method: 'DELETE' 
        });
        
        if (!response.ok) {
          throw new Error('Failed to clear sessions');
        }
        
        // Clear local state
        setSessions([]);
        
        // Clear selection
        if (selectedSessionId) {
          handleSessionSelect('');
        }
      } catch (error) {
      logger.error('Failed to clear sessions:', normalizeError(error));
        alert('Не удалось очистить историю. Попробуйте еще раз.');
      }
    }
  };
  
  const getModeIcon = (mode: string) => {
    return mode === 'PSYCHODIAGNOSTICS' 
      ? <AcademicCapIcon className="w-4 h-4 flex-shrink-0 text-purple-500" />
      : <BriefcaseIcon className="w-4 h-4 flex-shrink-0 text-green-500" />;
  };

  return (
    <div className="flex w-full md:w-64 bg-white dark:bg-gray-900 md:border-r border-gray-200 dark:border-gray-800 flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={handleNewSession}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors">
          <PlusIcon className="w-5 h-5" />
          <span className="font-medium">Новая сессия</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto scrollbar-custom p-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500">
            <p className="text-sm">Загрузка...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500">
            <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-2 opacity-60" />
            <p className="text-sm">Нет сессий</p>
            <p className="text-xs mt-1">Начните новую сессию диагностики</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const progress = session.totalQuestions > 0 
                ? Math.round((session.responses.length / session.totalQuestions) * 100)
                : 0;
              const isCompleted = session.status === 'COMPLETED';
              
              return (
                <div
                  key={session.id}
                  className={`
                    group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${selectedSessionId === session.id 
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }
                  `}
                  onClick={() => handleSessionSelect(session.id)}>
                  {getModeIcon(session.mode)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {session.respondentName || (session.user ? `${session.user.lastName} ${session.user.firstName}` : 'Пользователь')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                      <span>{formatRelativeTime(session.startedAt)}</span>
                      {!isCompleted && (
                        <span className="text-blue-500">• {progress}%</span>
                      )}
                      {isCompleted && (
                        <span className="text-green-500">• Завершено</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <TrashIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-2 space-y-1">
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <Cog6ToothIcon className="w-4 h-4" />
          <span className="text-sm">Настройки</span>
        </button>
        <button 
          onClick={clearHistory}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span className="text-sm">Очистить историю</span>
        </button>
      </div>
      
      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
