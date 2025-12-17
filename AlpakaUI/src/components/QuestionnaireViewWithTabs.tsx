'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  XMarkIcon,
  AcademicCapIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { LoadingDots } from './ui/Loading';
import { useSubmitResponse } from '@/hooks/queries/useSession';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

interface Question {
  id: number;
  text: string;
  orderIndex: number;
}

interface QuestionnaireViewProps {
  sessionId: string;
  questions: Question[];
  currentIndex: number;
  totalQuestions: number;
  mode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  onComplete: () => void;
  onExit: () => void;
  savedResponses?: Array<{questionId: number; answer: string; timeSpent: number}>;
}

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

export function QuestionnaireViewWithTabs({
  sessionId,
  questions,
  currentIndex,
  totalQuestions,
  mode,
  onComplete: _onComplete,
  onExit,
  savedResponses = [],
}: QuestionnaireViewProps) {
  // TanStack Query hook для отправки ответов
  const submitResponseMutation = useSubmitResponse(sessionId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'overview' | 'responses'>('chat');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [responses, setResponses] = useState<Array<{question: string; answer: string; index: number}>>([]);
  const [showCompletionActions, setShowCompletionActions] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progress = Math.round((currentIndex / totalQuestions) * 100);
  
  const messageCounter = useRef(0);
  
  // Initialize messages and responses on mount
  useEffect(() => {
    // Only run when we have questions and haven't initialized
    if (!questions || questions.length === 0) return undefined;
    if (messages.length > 0) return undefined; // Already initialized

    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      type: 'bot',
      content: mode === 'PSYCHODIAGNOSTICS'
        ? 'Добро пожаловать! Я задам вам 5 вопросов для психологической диагностики. Отвечайте развернуто и честно.'
        : 'Добро пожаловать! Я задам вам 5 вопросов для профессиональной ориентации. Поделитесь вашим опытом и мыслями.',
      timestamp: new Date()
    };

    // If we have saved responses, restore the conversation
    if (savedResponses && savedResponses.length > 0) {
      const restoredMessages: ChatMessage[] = [welcomeMessage];
      const restoredResponses: Array<{question: string; answer: string; index: number}> = [];

      // Restore each Q&A pair
      savedResponses.forEach((savedResp, idx) => {
        const questionData = questions.find(q => q.id === savedResp.questionId);
        if (questionData) {
          // Question message
          restoredMessages.push({
            id: `question-${idx + 1}-${Date.now() + idx * 2}`,
            type: 'bot',
            content: `Вопрос ${idx + 1} из ${totalQuestions}:\n\n${questionData.text}`,
            timestamp: new Date()
          });

          // User answer message
          restoredMessages.push({
            id: `user-${idx + 1}-${Date.now() + idx * 2 + 1}`,
            type: 'user',
            content: savedResp.answer,
            timestamp: new Date()
          });

          // Thank you message (except for last question if session is complete)
          if (idx < savedResponses.length - 1 || currentIndex < totalQuestions - 1) {
            restoredMessages.push({
              id: `ack-${idx + 1}-${Date.now() + idx * 3}`,
              type: 'bot',
              content: 'Спасибо за ваш ответ!',
              timestamp: new Date()
            });
          }

          // Store response for the Responses tab
          restoredResponses.push({
            question: questionData.text,
            answer: savedResp.answer,
            index: idx + 1
          });
        }
      });

      // Add current question if not finished
      if (currentIndex < totalQuestions) {
        const currentQ = questions[currentIndex];
        if (currentQ && !savedResponses.find(r => r.questionId === currentQ.id)) {
          restoredMessages.push({
            id: `question-${currentIndex + 1}-${Date.now() + savedResponses.length * 3}`,
            type: 'bot',
            content: `Вопрос ${currentIndex + 1} из ${totalQuestions}:\n\n${currentQ.text}`,
            timestamp: new Date()
          });
        }
      }

      setMessages(restoredMessages);
      setResponses(restoredResponses);
      setStartTime(Date.now());
      return undefined; // No cleanup needed for restored state
    }

    // Fresh start - show welcome and first question
    const firstQuestion: ChatMessage = {
      id: `question-1-${Date.now() + 1}`,
      type: 'bot',
      content: `Вопрос 1 из ${totalQuestions}:\n\n${questions[0]?.text || ''}`,
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);

    // Show typing and then first question after delay
    let questionTimer: NodeJS.Timeout;
    const typingTimer = setTimeout(() => {
      setIsBotTyping(true);

      questionTimer = setTimeout(() => {
        setMessages(prev => [...prev, firstQuestion]);
        setIsBotTyping(false);
        setStartTime(Date.now());
      }, 2000);
    }, 1500);

    return () => {
      clearTimeout(typingTimer);
      if (questionTimer) clearTimeout(questionTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - dependencies intentionally omitted for initialization
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [answer]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);
  
  // Character/word counting
  // Считаем символы без учета множественных пробелов (заменяем множественные пробелы на один)
  const charCount = answer.replace(/\s+/g, ' ').trim().length;
  // Правильный подсчет слов: разбиваем по пробелам/переносам и фильтруем пустые
  const wordCount = answer.trim() ? answer.trim().split(/[\s\n]+/).filter(word => word.length > 0).length : 0;
  const MIN_CHARS = 1500;
  const RECOMMENDED_CHARS = 2500;
  const isValidLength = charCount >= MIN_CHARS;
  
  const getCharCountColor = () => {
    if (charCount < MIN_CHARS) return 'text-red-500 dark:text-red-400';
    return 'text-green-500 dark:text-green-400';
  };
  
  const getDetailLevel = () => {
    if (charCount < MIN_CHARS) return 'Недостаточно';
    if (charCount < RECOMMENDED_CHARS) return 'Развернуто';
    if (charCount < 3500) return 'Подробно';
    return 'Очень подробно';
  };
  
  const handleSubmit = async () => {
    if (!answer.trim() || !currentQuestion || isSubmitting || processingRef.current) return;
    if (!isValidLength) {
      // Optional: could show a warning but not block
      return;
    }
    
    processingRef.current = true;
    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const userAnswer = answer;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${++messageCounter.current}-${Date.now()}`,
      type: 'user',
      content: userAnswer,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setAnswer('');
    
    try {
      // Save answer using TanStack Query mutation
      await submitResponseMutation.mutateAsync({
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        answer: userAnswer,
        timeSpent,
      });
      
      // Store response for display
      setResponses(prev => [...prev, {
        question: currentQuestion.text,
        answer: userAnswer,
        index: currentIndex + 1
      }]);
      
      // Bot response
      setTimeout(() => setIsBotTyping(true), 500);
      
      setTimeout(() => {
        setIsBotTyping(false);
        
        if (isLastQuestion) {
          // Thank you message
          const thankYouMessage: ChatMessage = {
            id: `thank-${++messageCounter.current}-${Date.now()}`,
            type: 'bot',
            content: 'Спасибо за ваш развернутый ответ!',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, thankYouMessage]);
          
            // Final message
            setTimeout(() => {
              const finalMessage: ChatMessage = {
                id: `final-${++messageCounter.current}-${Date.now()}`,
                type: 'bot',
                content: '🎉 Поздравляю! Вы ответили на все вопросы диагностики.\n\n' +
                        '📊 Вы можете посмотреть свои ответы во вкладке "Ответы" выше.\n\n' +
                        '⚙️ Сейчас система начнет генерацию персональных отчетов на основе ваших ответов.\n' +
                        'Это может занять несколько минут.\n\n' +
                        'Выберите действие ниже, чтобы продолжить:',
                timestamp: new Date()
              };
              setMessages(prev => [...prev, finalMessage]);

              // Show completion actions after a short delay
              setTimeout(() => {
                setShowCompletionActions(true);
              }, 1500);
            }, 2000);
        } else {
          // Acknowledgment and next question
          const ackMessage: ChatMessage = {
            id: `ack-${++messageCounter.current}-${Date.now()}`,
            type: 'bot',
            content: 'Спасибо за ваш ответ!',
            timestamp: new Date()
          };
          
          setMessages(prev => {
            // Check if acknowledgment already exists
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.content === 'Спасибо за ваш ответ!') {
              return prev;
            }
            return [...prev, ackMessage];
          });
          
          // Next question
          const nextIndex = currentIndex + 1;
          const nextQuestion = questions[nextIndex];
          
          if (nextQuestion) {
            setTimeout(() => {
              setIsBotTyping(true);
              setTimeout(() => {
                const questionMessage: ChatMessage = {
                  id: `question-${nextIndex + 1}-${++messageCounter.current}-${Date.now()}`,
                  type: 'bot',
                  content: `Вопрос ${nextIndex + 1} из ${totalQuestions}:\n\n${nextQuestion.text}`,
                  timestamp: new Date()
                };
                setMessages(prev => {
                  // Check if question already exists
                  const exists = prev.some(m => m.content.includes(`Вопрос ${nextIndex + 1} из`));
                  if (exists) return prev;
                  return [...prev, questionMessage];
                });
                setIsBotTyping(false);
                setStartTime(Date.now());
              }, 2000);
            }, 1000);
          }
        }
      }, 2000);
    } catch (error) {
      logger.error('Failed to submit response:', normalizeError(error));
      setIsBotTyping(false);
    } finally {
      setIsSubmitting(false);
      processingRef.current = false;
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const modeConfig = {
    PSYCHODIAGNOSTICS: {
      title: 'Психологическая диагностика',
      color: 'from-purple-500 to-pink-500',
    },
    CAREER_GUIDANCE: {
      title: 'Профессиональная ориентация',
      color: 'from-green-500 to-emerald-500',
    },
  };
  
  const config = modeConfig[mode];
  const ModeIcon = mode === 'PSYCHODIAGNOSTICS' ? AcademicCapIcon : BriefcaseIcon;
  
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 bg-gradient-to-br ${config.color} rounded-lg`}>
                <ModeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">{config.title}</h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Сессия активна</p>
              </div>
            </div>
            <button
              onClick={onExit}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Завершить сессию">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-2">
            <div className="h-1 bg-gray-200 dark:bg-gray-800">
              <motion.div
                className={`h-full bg-gradient-to-r ${config.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              💬 Чат
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📊 Обзор
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'responses'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📝 Ответы ({responses.length}/{totalQuestions})
            </button>
          </div>
        </div>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'chat' && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${message.type === 'user' ? 'order-2' : ''}`}>
                    {message.type === 'bot' && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                          <ModeIcon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Ассистент</span>
                      </div>
                    )}
                    <div className={`px-4 py-3 rounded-2xl ${
                      message.type === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isBotTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[70%]">
                    <div className="px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <LoadingDots size="sm" color="gray" />
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Completion Actions */}
              {showCompletionActions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[70%] mx-auto mt-6"
                >
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      🎆 Сессия завершена успешно!
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Система генерирует персональные отчеты. Этот процесс может занять несколько минут.
                    </p>
                    <div className="space-y-3">
                      <button
                        onClick={_onComplete}
                        className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105"
                      >
                        📊 Проверить статус отчетов
                      </button>
                      <button
                        onClick={() => setActiveTab('responses')}
                        className="w-full px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        👁️ Посмотреть мои ответы
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="max-w-3xl mx-auto">
              {/* Character Counter */}
              {answer.length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className={`text-sm font-semibold ${getCharCountColor()}`}>
                          {charCount.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400"> / {MIN_CHARS.toLocaleString()} символов (минимум)</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{wordCount}</span> слов
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        charCount < MIN_CHARS
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {getDetailLevel()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        charCount < MIN_CHARS
                          ? 'bg-red-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: charCount >= MIN_CHARS ? '100%' : `${(charCount / MIN_CHARS) * 100}%`
                      }}
                    />
                  </div>
                  
                  {/* Warning/Info messages */}
                  {charCount < MIN_CHARS && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      ⚠️ Пожалуйста, напишите более развернутый ответ (минимум 1500 символов для качественной диагностики)
                    </p>
                  )}
                  {charCount >= MIN_CHARS && charCount < RECOMMENDED_CHARS && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 <span className="font-medium">Рекомендация:</span> Для более точного и глубокого анализа рекомендуется написать еще <span className="font-semibold">{(RECOMMENDED_CHARS - charCount).toLocaleString()}</span> символов (оптимально 2500+ символов)
                      </p>
                    </div>
                  )}
                  {charCount >= RECOMMENDED_CHARS && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                      ✅ Отлично! Ваш ответ достаточно подробный для качественной диагностики
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isSubmitting || isBotTyping ? 'Подождите...' : 'Напишите ваш развернутый ответ (минимум 1500 символов)...'}
                  disabled={isSubmitting || isBotTyping || currentIndex >= totalQuestions}
                  className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl 
                           border border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-gray-600 focus:outline-none 
                           resize-none placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                  rows={1}
                  style={{ maxHeight: '150px' }}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!answer.trim() || !isValidLength || isSubmitting || isBotTyping || currentIndex >= totalQuestions}
                  className={`p-3 rounded-xl transition-all ${
                    answer.trim() && isValidLength && !isSubmitting && !isBotTyping && currentIndex < totalQuestions
                      ? `bg-gradient-to-r ${config.color} text-white hover:scale-105`
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                  title={!isValidLength ? 'Минимум 1500 символов' : 'Отправить ответ'}
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Обзор сессии</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Прогресс</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{responses.length} из {totalQuestions}</p>
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div 
                      className={`h-full bg-gradient-to-r ${config.color} rounded-full transition-all`}
                      style={{ width: `${(responses.length / totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Статус</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {responses.length >= totalQuestions ? '✅ Завершено' : '⏳ В процессе'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Ваши ответы</h2>
            {responses.length > 0 ? (
              <div className="space-y-4">
                {responses.map((response, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="mb-2">
                      <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-sm rounded">
                        Вопрос {response.index}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      {response.question}
                    </h3>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      {response.answer}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center">
                Пока нет ответов. Начните отвечать на вопросы в чате.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}