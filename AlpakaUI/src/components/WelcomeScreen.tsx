'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  ArrowRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

interface WelcomeScreenProps {
  mode: 'psychodiagnostics' | 'careerGuidance';
  onStart: (name: string) => void;
  onClose: () => void;
}

export function WelcomeScreen({ mode, onStart, onClose }: WelcomeScreenProps) {
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    phone: '',
    birthDate: '',
  });
  
  const [agreed, setAgreed] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  const modeInfo = {
    psychodiagnostics: {
      title: 'Психологическая диагностика',
      description: 'Этот тест поможет лучше понять ваше эмоциональное состояние и личностные особенности.',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-900/20 to-pink-900/20'
    },
    careerGuidance: {
      title: 'Профессиональная ориентация',
      description: 'Определите оптимальный карьерный путь и узнайте о своих профессиональных склонностях.',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'from-green-900/20 to-emerald-900/20'
    }
  };
  
  const info = mode === 'psychodiagnostics' ? modeInfo.psychodiagnostics : modeInfo.careerGuidance;

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    // If starts with 8, replace with 7
    const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;

    // Format: +7 (999) 123-45-67
    if (normalized.length === 0) return '';
    if (normalized.length <= 1) return `+${normalized}`;
    if (normalized.length <= 4) return `+${normalized[0]} (${normalized.slice(1)}`;
    if (normalized.length <= 7) return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4)}`;
    if (normalized.length <= 9) return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`;
    return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  };

  // Load user data from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const birthDateStr = user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '';

        setFormData({
          lastName: user.lastName || '',
          firstName: user.firstName || '',
          middleName: user.middleName || '',
          phone: formatPhoneNumber(user.phone || ''),
          birthDate: birthDateStr || '',
        });
      } catch (error) {
        logger.error('Failed to parse user data', normalizeError(error));
      }
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatPhoneNumber(input);
    setFormData({ ...formData, phone: formatted });
  };

  const handleStart = () => {
    if (agreed && formData.firstName && formData.lastName) {
      const fullName = `${formData.lastName} ${formData.firstName}${formData.middleName ? ' ' + formData.middleName : ''}`;
      onStart(fullName);
    }
  };
  
  // All users can edit their own data before starting a session
  const canEdit = true;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full max-h-[95vh] overflow-y-auto"
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${info.color} p-1 rounded-t-2xl`}>
          <div className="bg-gray-900 rounded-t-2xl p-4 sm:p-6 md:p-8 relative">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors z-10"
              title="Закрыть"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3 pr-10 sm:pr-12">
              {info.title}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base md:text-lg">
              {info.description}
            </p>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="bg-gray-800 p-6 sm:p-8 space-y-6">
          {/* Respondent Data Form */}
          <div className="space-y-4">
            <p className="text-sm text-blue-400 bg-blue-900/20 p-3 rounded-lg border border-blue-700">
              ℹ️ Данные заполнены из вашего профиля. Вы можете их изменить при необходимости.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Фамилия */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Фамилия *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Иванов"
                  className={`w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 
                    focus:border-blue-500 focus:outline-none placeholder-gray-400
                    ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              
              {/* Имя */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Имя *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Иван"
                  className={`w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 
                    focus:border-blue-500 focus:outline-none placeholder-gray-400
                    ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
            
            {/* Отчество */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Отчество
              </label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                disabled={!canEdit}
                placeholder="Иванович"
                className={`w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 
                  focus:border-blue-500 focus:outline-none placeholder-gray-400
                  ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Телефон */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Телефон *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  disabled={!canEdit}
                  placeholder="+7 (999) 123-45-67"
                  maxLength={18}
                  className={`w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600
                    focus:border-blue-500 focus:outline-none placeholder-gray-400
                    ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              
              {/* Дата рождения */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Дата рождения *
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  disabled={!canEdit}
                  className={`w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 
                    focus:border-blue-500 focus:outline-none
                    ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-1">
                  Конфиденциальность
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Все ваши ответы строго конфиденциальны и будут использованы только
                  для анализа и формирования персональных рекомендаций.
                </p>
              </div>
            </div>
          </div>
          
          {/* Agreement Checkbox */}
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded 
                         focus:ring-blue-500 focus:ring-2 flex-shrink-0"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Я согласен(согласна) на обработку персональных данных согласно{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowConsentModal(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  Федеральному закону № 152-ФЗ
                </button>{' '}
                «О персональных данных»
              </span>
            </label>
          </div>
        </div>
        
        {/* Footer */}
        <div className={`bg-gradient-to-r ${info.bgColor} p-1 rounded-b-2xl`}>
          <div className="bg-gray-800 rounded-b-2xl p-4 sm:p-6">
            <button
              onClick={handleStart}
              disabled={!formData.firstName || !formData.lastName || !formData.phone || !formData.birthDate || !agreed}
              className={`
                w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl
                font-semibold text-base sm:text-lg transition-all transform
                ${formData.firstName && formData.lastName && formData.phone && formData.birthDate && agreed
                  ? `bg-gradient-to-r ${info.color} text-white hover:scale-[1.02] active:scale-[0.98]`
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <span>Начать диагностику</span>
              {formData.firstName && formData.lastName && formData.phone && formData.birthDate && agreed && <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            
            {(!formData.firstName || !formData.lastName || !formData.phone || !formData.birthDate || !agreed) && (
              <p className="text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                {!agreed 
                  ? 'Необходимо дать согласие для продолжения'
                  : 'Заполните все обязательные поля'}
              </p>
            )}
          </div>
        </div>
      </motion.div>
      
      {/* Consent Modal */}
      <AnimatePresence>
        {showConsentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowConsentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-2xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto border border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  Согласие на обработку персональных данных
                </h2>
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                <p>
                  В соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ 
                  «О персональных данных» (далее — Закон о персональных данных), я, действуя 
                  свободно, своей волей и в своем интересе, даю согласие Нейролаборатории МГИМО 
                  (далее — Оператор) на обработку своих персональных данных.
                </p>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">1. Перечень персональных данных</h3>
                  <p>
                    Я даю согласие на обработку следующих персональных данных:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>Фамилия, имя, отчество</li>
                    <li>Дата рождения</li>
                    <li>Контактные данные (телефон, адрес электронной почты)</li>
                    <li>Ответы на вопросы психологической диагностики и профориентации</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">2. Цели обработки персональных данных</h3>
                  <p>
                    Персональные данные обрабатываются в следующих целях:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>Проведение психологической диагностики</li>
                    <li>Формирование рекомендаций по профессиональной ориентации</li>
                    <li>Подготовка отчетов и статистического анализа</li>
                    <li>Научно-исследовательская деятельность</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">3. Способы обработки данных</h3>
                  <p>
                    Оператор осуществляет обработку персональных данных как с использованием 
                    средств автоматизации, так и без использования таких средств, включая сбор, 
                    запись, систематизацию, накопление, хранение, уточнение, извлечение, 
                    использование, передачу, обезличивание, блокирование, удаление, уничтожение.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">4. Срок обработки данных</h3>
                  <p>
                    Согласие действует в течение 5 (пяти) лет с момента его предоставления. 
                    Согласие может быть отозвано мною в любое время путем направления письменного 
                    заявления Оператору.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">5. Права субъекта персональных данных</h3>
                  <p>
                    Я проинформирован(а) о своих правах, предусмотренных Законом о персональных 
                    данных, в том числе:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>Право на получение информации, касающейся обработки персональных данных</li>
                    <li>Право на уточнение, блокирование или уничтожение персональных данных</li>
                    <li>Право на отзыв согласия на обработку персональных данных</li>
                  </ul>
                </div>
                
                <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
                  <p className="text-xs text-gray-400">
                    Нажимая кнопку &ldquo;Начать диагностику&rdquo;, я подтверждаю, что ознакомлен(а) с 
                    настоящим согласием и принимаю его условия.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setAgreed(true);
                    setShowConsentModal(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 
                           text-white rounded-lg font-semibold hover:from-green-700 
                           hover:to-emerald-700 transition-all"
                >
                  Принять и продолжить
                </button>
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold 
                           hover:bg-gray-600 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
