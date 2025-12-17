import { apiRequest } from '@/lib/api-client';
import type { User } from '@/types/api';

/**
 * API Client для работы с пользователями (frontend)
 * Используется вместе с TanStack Query
 */
export class UserApiClient {
  /**
   * Получить список всех пользователей
   */
  static async getAll(): Promise<User[]> {
    return apiRequest<User[]>('/api/users');
  }

  /**
   * Получить пользователя по ID
   */
  static async getById(id: string): Promise<User> {
    return apiRequest<User>(`/api/users/${id}`);
  }

  /**
   * Обновить роль пользователя
   */
  static async updateRole(id: string, role: string): Promise<User> {
    return apiRequest<User>(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Удалить пользователя
   */
  static async delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }
}
