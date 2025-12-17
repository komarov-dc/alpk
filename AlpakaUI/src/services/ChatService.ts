import { apiRequest } from '@/lib/api-client';
import type {
  ChatData,
  CreateChatRequest,
  UpdateChatRequest,
  CreateMessageRequest,
  ChatMessage,
} from '@/types/api';

/**
 * Service для работы с чатами
 */
export class ChatService {
  /**
   * Получить список всех чатов
   */
  static async getAll(): Promise<ChatData[]> {
    return apiRequest<ChatData[]>('/api/chats');
  }

  /**
   * Получить чат по ID
   */
  static async getById(id: string): Promise<ChatData> {
    return apiRequest<ChatData>(`/api/chats/${id}`);
  }

  /**
   * Создать новый чат
   */
  static async create(data: CreateChatRequest): Promise<ChatData> {
    return apiRequest<ChatData>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Обновить чат
   */
  static async update(id: string, data: UpdateChatRequest): Promise<ChatData> {
    return apiRequest<ChatData>(`/api/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Удалить чат
   */
  static async delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/chats/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Получить сообщения чата
   */
  static async getMessages(chatId: string): Promise<ChatMessage[]> {
    const chat = await this.getById(chatId);
    return chat.messages;
  }

  /**
   * Добавить сообщение в чат
   */
  static async createMessage(
    chatId: string,
    data: CreateMessageRequest
  ): Promise<ChatMessage> {
    return apiRequest<ChatMessage>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
