'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  HomeIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

interface CompletionScreenProps {
  name: string;
  mode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  sessionId: string;
  onNewSession: () => void;
  onGoHome: () => void;
}

export function CompletionScreen({
  name,
  mode,
  sessionId,
  onNewSession,
  onGoHome
}: CompletionScreenProps) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sessionStats, setSessionStats] = useState<{
    totalQuestions: number;
    totalWords: number;
    totalChars: number;
    avgTimePerQuestion: number;
  } | null>(null);
  const [jobStatus, setJobStatus] = useState<'queued' | 'processing' | 'completed' | 'failed' | null>(null);
  const [reportsReady, setReportsReady] = useState(false);
  
  const modeTitle = mode === 'PSYCHODIAGNOSTICS' 
    ? 'Психологическая диагностика' 
    : 'Профессиональная ориентация';
  
  // Fetch session statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/sessions?id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const session = data[0];
            const responses = session.responses || [];
            
            const totalWords = responses.reduce((sum: number, r: { answer: string }) => 
              sum + (r.answer?.split(/\s+/).length || 0), 0
            );
            const totalChars = responses.reduce((sum: number, r: { answer: string }) => 
              sum + (r.answer?.length || 0), 0
            );
            const avgTime = responses.reduce((sum: number, r: { timeSpent: number }) => 
              sum + (r.timeSpent || 0), 0
            ) / Math.max(responses.length, 1);
            
            setSessionStats({
              totalQuestions: session.totalQuestions || 5,
              totalWords,
              totalChars,
              avgTimePerQuestion: Math.round(avgTime)
            });
          }
        }
      } catch {
        // Failed to fetch stats - continue without them
      }
    };
    
    fetchStats();
  }, [sessionId]);

  // Poll for job status and reports
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const response = await fetch(`/api/sessions?id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const session = data[0];
            setJobStatus(session.alpakaJobStatus);
            setReportsReady(session.reports && session.reports.length > 0);

            // Stop polling if job is completed or failed
            if (session.alpakaJobStatus === 'completed' || session.alpakaJobStatus === 'failed') {
              return true; // Signal to stop polling
            }
          }
        }
      } catch {
        // Failed to fetch status - continue polling
      }
      return false; // Continue polling
    };

    // Initial check
    pollJobStatus();

    // Poll every 5 seconds until completed or failed
    const interval = setInterval(async () => {
      const shouldStop = await pollJobStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleEmailSubmit = async () => {
    if (email && email.includes('@')) {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          setEmailSent(true);
          setTimeout(() => setEmailSent(false), 5000);
        } else {
          alert('Не удалось отправить письмо. Попробуйте позже.');
        }
      } catch (error) {
        logger.error('Failed to send email', normalizeError(error));
        alert('Произошла ошибка при отправке письма.');
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full max-h-[95vh] overflow-y-auto"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            delay: 0.2, 
            type: "spring", 
            stiffness: 200,
            damping: 15 
          }}
          className="flex justify-center mb-4 sm:mb-8"
        >
          <div className="relative">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
            </div>
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                repeatType: "loop" 
              }}
              className="absolute inset-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-green-400/30 to-emerald-500/30 rounded-full"
            />
          </div>
        </motion.div>
        
        {/* Main Content */}
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Спасибо, {name}!
            </h1>
            <p className="text-base sm:text-xl text-gray-300">
              Вы успешно завершили {modeTitle.toLowerCase()}
            </p>
          </div>
          
          {/* Session Stats Visualization */}
          {sessionStats && (
            <div className="space-y-4">
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg p-4 border border-blue-500/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
                    <span className="text-xs text-gray-400">Слов написано</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{sessionStats.totalWords.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ~{Math.round(sessionStats.totalWords / sessionStats.totalQuestions)} слов/вопрос
                  </p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg p-4 border border-purple-500/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ClockIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-xs text-gray-400">Среднее время</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-400">
                    {Math.floor(sessionStats.avgTimePerQuestion / 60)}:{String(sessionStats.avgTimePerQuestion % 60).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">минут на вопрос</p>
                </motion.div>
              </div>

              {/* Progress Visualization */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-700/50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-semibold text-gray-300">Детализация ответов</span>
                  </div>
                  <span className="text-xs text-gray-500">{sessionStats.totalQuestions} вопросов</span>
                </div>
                
                {/* Character count bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Объем текста</span>
                    <span>{sessionStats.totalChars.toLocaleString()} символов</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((sessionStats.totalChars / 3000) * 100, 100)}%` }}
                      transition={{ delay: 0.7, duration: 1 }}
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {sessionStats.totalChars < 1000 
                      ? 'Краткие ответы' 
                      : sessionStats.totalChars < 2000 
                      ? 'Средние ответы' 
                      : 'Развернутые ответы'}
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {/* Session Info */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">ID сессии</span>
              <span className="text-sm font-mono text-gray-300">{sessionId.slice(0, 8)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Дата прохождения</span>
              <span className="text-sm text-gray-300">
                {new Date().toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Report Generation Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`rounded-lg p-4 border ${
              jobStatus === 'completed' && reportsReady
                ? 'bg-green-900/20 border-green-800'
                : jobStatus === 'failed'
                ? 'bg-red-900/20 border-red-800'
                : 'bg-blue-900/20 border-blue-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {jobStatus === 'completed' && reportsReady ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-400" />
                ) : jobStatus === 'failed' ? (
                  <XMarkIcon className="w-6 h-6 text-red-400" />
                ) : (
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-1 ${
                  jobStatus === 'completed' && reportsReady
                    ? 'text-green-400'
                    : jobStatus === 'failed'
                    ? 'text-red-400'
                    : 'text-blue-400'
                }`}>
                  {jobStatus === 'completed' && reportsReady
                    ? '✅ Отчеты готовы!'
                    : jobStatus === 'failed'
                    ? '❌ Ошибка генерации'
                    : jobStatus === 'processing'
                    ? '⚙️ Генерация отчетов...'
                    : '⏳ Отчеты в очереди'}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {jobStatus === 'completed' && reportsReady
                    ? 'Персональные отчеты успешно сгенерированы системой анализа. Вы можете получить их по email.'
                    : jobStatus === 'failed'
                    ? 'Произошла ошибка при генерации отчетов. Пожалуйста, обратитесь в поддержку.'
                    : jobStatus === 'processing'
                    ? `Система анализирует ваши ответы и генерирует персональные отчеты. Это может занять ${mode === 'CAREER_GUIDANCE' ? '10-20 минут' : '40-60 минут'}.`
                    : 'Ваши ответы отправлены на обработку. Система скоро начнет генерацию персональных отчетов.'}
                </p>
                {(jobStatus === 'queued' || jobStatus === 'processing') && (
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Страница автоматически обновится, когда отчеты будут готовы
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Email Section - Only show when reports are ready */}
          {reportsReady && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white">
                Получить результаты анализа
              </h3>
              <p className="text-sm text-gray-400">
                Введите email, чтобы получить детальный анализ ваших ответов
              </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg 
                           border border-gray-600 focus:border-blue-500 focus:outline-none
                           placeholder-gray-400"
                />
              </div>
              <button
                onClick={handleEmailSubmit}
                disabled={!email || emailSent}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  emailSent 
                    ? 'bg-green-600 text-white'
                    : email 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {emailSent ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 inline mr-2" />
                    Отправлено
                  </>
                ) : (
                  'Отправить'
                )}
              </button>
            </div>
            </div>
          )}

          {/* What's Next */}
          {!reportsReady && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-400 mb-2">
                Что дальше?
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {jobStatus === 'processing'
                  ? 'Пожалуйста, дождитесь завершения генерации отчетов. Вы можете закрыть эту страницу и вернуться позже - результаты будут сохранены в вашей истории сессий.'
                  : 'Ваши ответы сохранены в системе. После завершения генерации отчетов вы сможете получить их по email или просмотреть в разделе истории.'}
              </p>
            </div>
          )}
          {reportsReady && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-400 mb-2">
                ✨ Всё готово!
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Ваши персональные отчеты готовы. Вы можете получить их по email или начать новую сессию диагностики.
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <button
              onClick={onNewSession}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 
                       text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              <ArrowPathIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Новая сессия</span>
            </button>
            <button
              onClick={onGoHome}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 
                       text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              <HomeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>На главную</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}