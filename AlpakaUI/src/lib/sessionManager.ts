/**
 * Session Manager - управляет состоянием сессии и логикой "Запомнить меня"
 */

import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

const SESSION_STORAGE_KEY = 'psypro-session-active';
const REMEMBER_ME_KEY = 'rememberMe';

export class SessionManager {
  private static instance: SessionManager;
  
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }
  
  /**
   * Проверяет, должна ли сессия быть активной
   * Для токенов без "remember me" - проверяет, не была ли перезагружена вкладка/браузер
   */
  checkSessionValidity(): boolean {
    if (typeof window === 'undefined') {
      return true; // На сервере всегда возвращаем true
    }
    
    try {
      const rememberMe = this.getRememberMeStatus();
      
      if (rememberMe) {
        // Если пользователь выбрал "запомнить меня", сессия остается активной
        return true;
      }
      
      // Для сессионных токенов - проверяем, была ли активна сессия
      const wasSessionActive = sessionStorage.getItem(SESSION_STORAGE_KEY);
      
      if (!wasSessionActive) {
        // Сессия не была активна - это означает перезагрузку браузера или новую вкладку
        this.clearSession();
        return false;
      }
      
      return true;
      
    } catch (error) {
      logger.error('[SessionManager] Error checking session validity:', normalizeError(error));
      return false;
    }
  }
  
  /**
   * Устанавливает флаг активной сессии
   */
  markSessionActive(rememberMe: boolean = false): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Сохраняем состояние "запомнить меня" в localStorage
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        localStorage.setItem(REMEMBER_ME_KEY, 'false');
        // Для сессионных токенов отмечаем активность в sessionStorage
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      }
      
      // Session marked as active
    } catch (error) {
      logger.error('[SessionManager] Error marking session active:', normalizeError(error));
    }
  }
  
  /**
   * Получает статус "запомнить меня" из localStorage
   */
  getRememberMeStatus(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const rememberMe = localStorage.getItem(REMEMBER_ME_KEY);
      return rememberMe === 'true';
    } catch (error) {
      logger.error('[SessionManager] Error getting remember me status:', normalizeError(error));
      return false;
    }
  }
  
  /**
   * Очищает сессию полностью
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Очищаем sessionStorage
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      
      // Очищаем флаг "запомнить меня"
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem('user');
      
      // Очищаем куки через API
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Session cleared
    } catch (error) {
      logger.error('[SessionManager] Error clearing session:', normalizeError(error));
    }
  }
  
  /**
   * Принудительный выход с редиректом на страницу входа
   */
  forceLogout(reason: string = 'Session expired'): void {
    this.clearSession();
    
    // Показываем уведомление пользователю
    if (typeof window !== 'undefined') {
      // Редирект на страницу входа
      window.location.href = '/auth/login?reason=' + encodeURIComponent(reason);
    }
  }
  
  /**
   * Инициализация проверки сессии при загрузке приложения
   */
  initializeSessionCheck(): void {
    if (typeof window === 'undefined') return;
    
    // Проверяем валидность сессии при загрузке
    const isValid = this.checkSessionValidity();
    
    if (!isValid) {
      this.forceLogout('Сессия завершена из-за перезагрузки браузера');
      return;
    }
    
    // Для сессионных токенов отмечаем активность
    if (!this.getRememberMeStatus()) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
    }
  }
}

// Экспортируем singleton
export const sessionManager = SessionManager.getInstance();