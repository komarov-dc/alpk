/**
 * Базовый API клиент для взаимодействия с бэкендом
 */

// Получить заголовки авторизации
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

// Обработчик ошибок API
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Базовый метод для выполнения fetch запросов
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Если unauthorized - это не всегда ошибка (например, при работе без авторизации)
  const hasAuthHeader = options?.headers && 'Authorization' in options.headers;
  if (response.status === 401 && !hasAuthHeader) {
    // Это нормальная ситуация для неавторизованных пользователей
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const errorData = await response.text();
    throw new ApiError(
      `API Error: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}
