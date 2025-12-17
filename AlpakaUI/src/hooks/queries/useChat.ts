import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatService } from '@/services/ChatService';
import type { CreateChatRequest, UpdateChatRequest, CreateMessageRequest } from '@/types/api';

/**
 * Query Keys для chats
 */
export const chatKeys = {
  all: ['chats'] as const,
  lists: () => [...chatKeys.all, 'list'] as const,
  list: () => [...chatKeys.lists()] as const,
  details: () => [...chatKeys.all, 'detail'] as const,
  detail: (id: string) => [...chatKeys.details(), id] as const,
  messages: (id: string) => [...chatKeys.detail(id), 'messages'] as const,
};

/**
 * Hook для получения всех чатов
 */
export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: ChatService.getAll,
    staleTime: 30 * 1000, // 30 секунд
  });
}

/**
 * Hook для получения одного чата
 */
export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id!),
    queryFn: () => ChatService.getById(id!),
    enabled: !!id,
  });
}

/**
 * Hook для получения сообщений чата
 */
export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(chatId!),
    queryFn: () => ChatService.getMessages(chatId!),
    enabled: !!chatId,
  });
}

/**
 * Hook для создания нового чата
 */
export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChatRequest) => ChatService.create(data),
    onSuccess: () => {
      // Инвалидировать список чатов
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}

/**
 * Hook для обновления чата
 */
export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChatRequest }) =>
      ChatService.update(id, data),
    onSuccess: (_, { id }) => {
      // Инвалидировать чат и список чатов
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}

/**
 * Hook для удаления чата
 */
export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: string) => ChatService.delete(chatId),
    onSuccess: () => {
      // Инвалидировать список чатов
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
}

/**
 * Hook для отправки сообщения
 */
export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageRequest) =>
      ChatService.createMessage(chatId, data),
    onSuccess: () => {
      // Инвалидировать сообщения чата
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    },
  });
}
