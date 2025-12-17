import { apiRequest } from '@/lib/api-client';
import type {
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  SubmitResponseRequest,
  SubmitResponseResponse,
} from '@/types/api';

/**
 * Service для работы с диагностическими сессиями
 */
export class SessionService {
  /**
   * Получить список всех сессий
   */
  static async getAll(params?: { status?: string }): Promise<Session[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) {
      queryParams.append('status', params.status);
    }

    const url = `/api/sessions${queryParams.toString() ? `?${queryParams}` : ''}`;
    return apiRequest<Session[]>(url);
  }

  /**
   * Получить сессию по ID
   */
  static async getById(id: string): Promise<Session> {
    const sessions = await apiRequest<Session[]>(`/api/sessions?id=${id}`);
    const session = sessions?.[0];
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  /**
   * Создать новую сессию
   */
  static async create(data: CreateSessionRequest): Promise<CreateSessionResponse> {
    return apiRequest<CreateSessionResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Отправить ответ на вопрос
   */
  static async submitResponse(
    sessionId: string,
    data: SubmitResponseRequest
  ): Promise<SubmitResponseResponse> {
    return apiRequest<SubmitResponseResponse>(
      `/api/sessions/${sessionId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Отправить сессию (завершить)
   */
  static async submit(sessionId: string): Promise<void> {
    return apiRequest<void>(`/api/sessions/${sessionId}/submit`, {
      method: 'POST',
    });
  }

  /**
   * Получить отчет по сессии
   */
  static async getReport(sessionId: string): Promise<unknown> {
    return apiRequest<unknown>(`/api/sessions/${sessionId}/report`);
  }

  /**
   * Удалить сессию
   */
  static async delete(sessionId: string): Promise<void> {
    return apiRequest<void>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }
}
