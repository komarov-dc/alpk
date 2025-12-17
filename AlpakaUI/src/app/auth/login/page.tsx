'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutReason, setLogoutReason] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Проверяем, есть ли параметр reason в URL
      const urlParams = new URLSearchParams(window.location.search);
      const reason = urlParams.get('reason');
      
      if (reason) {
        const reasonMessages: Record<string, string> = {
          'session_expired': 'Ваша сессия истекла. Войдите заново.',
          'browser_restart': 'Сессия завершена из-за перезагрузки браузера',
          'Сессия завершена из-за перезагрузки браузера': 'Ваш браузер был перезагружен. Для продолжения работы без повторного входа в будущем отметьте "Запомнить меня"'
        };
        
        setLogoutReason(reasonMessages[reason] || decodeURIComponent(reason));
        
        // Очищаем URL от параметра reason
        window.history.replaceState({}, '', '/auth/login');
      }
    }
  }, []);

  const handleLogin = async () => {
    // Validate form
    if (!formData.email || !formData.password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rememberMe
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при входе');
      }

      // Store user data and mark session as active
      localStorage.setItem('user', JSON.stringify(data.user));

      // Отмечаем сессию как активную через SessionManager
      if (typeof window !== 'undefined') {
        const { sessionManager } = await import('@/lib/sessionManager');
        sessionManager.markSessionActive(rememberMe);
      }

      // Use replace to prevent back button issues
      window.location.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Вход в систему
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Или{' '}
            <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
              зарегистрируйте новый аккаунт
            </Link>
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {logoutReason && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-400">{logoutReason}</p>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email адрес"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Пароль"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyPress={handleKeyPress}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Запомнить меня
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Забыли пароль?
              </a>
            </div>
          </div>

          <div>
            <button
              type="button"
              disabled={loading}
              onClick={handleLogin}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}