'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    lastName: '',
    firstName: '',
    middleName: '',
    phone: '',
    birthDate: '',
    status: 'OTHER',
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Format phone number to +7 (XXX) XXX-XX-XX
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    // If starts with 8, replace with 7
    const normalizedDigits = digits.startsWith('8') ? '7' + digits.slice(1) : digits;

    // Format based on number of digits
    if (normalizedDigits.length === 0) return '';
    if (normalizedDigits.length <= 1) return `+${normalizedDigits}`;
    if (normalizedDigits.length <= 4) return `+${normalizedDigits.slice(0, 1)} (${normalizedDigits.slice(1)}`;
    if (normalizedDigits.length <= 7) return `+${normalizedDigits.slice(0, 1)} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4)}`;
    if (normalizedDigits.length <= 9) return `+${normalizedDigits.slice(0, 1)} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7)}`;
    return `+${normalizedDigits.slice(0, 1)} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7, 9)}-${normalizedDigits.slice(9, 11)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      const { confirmPassword: _confirmPassword, ...dataToSend } = formData;

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if we have detailed validation errors
        if (data.details && Array.isArray(data.details)) {
          // Map Zod errors to user-friendly format
          const errors = data.details.map((issue: { path: string[]; message: string }) => ({
            path: issue.path.join('.'),
            message: issue.message,
          }));
          setValidationErrors(errors);
          setError('Пожалуйста, исправьте ошибки в форме');
        } else {
          setError(data.error || 'Ошибка при регистрации');
        }
        setLoading(false);
        return;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to main page
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Регистрация
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Или{' '}
            <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
              войдите в существующий аккаунт
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">{error}</p>
              {validationErrors.length > 0 && (
                <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 mt-2">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Фамилия *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Иванов"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Имя *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Иван"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Отчество
              </label>
              <input
                id="middleName"
                name="middleName"
                type="text"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Иванович"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Телефон *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="+7 (999) 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
              />
            </div>

            <div>
              <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Дата рождения *
              </label>
              <input
                id="birthDate"
                name="birthDate"
                type="date"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Статус *
              </label>
              <select
                id="status"
                name="status"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="STUDENT">Студент</option>
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="OTHER">Другое</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Пароль *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Минимум 6 символов"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Подтвердите пароль *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Повторите пароль"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
            Регистрируясь, вы соглашаетесь с обработкой персональных данных
          </p>
        </form>
      </div>
    </div>
  );
}