import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SessionService } from '@/services/SessionService';
import type { CreateSessionRequest, SubmitResponseRequest } from '@/types/api';

/**
 * Query Keys для sessions
 */
export const sessionKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionKeys.all, 'list'] as const,
  list: (filters?: { status?: string }) =>
    [...sessionKeys.lists(), filters] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};

/**
 * Hook для получения всех сессий
 */
export function useSessions(params?: { status?: string }) {
  return useQuery({
    queryKey: sessionKeys.list(params),
    queryFn: () => SessionService.getAll(params),
    // Не кешировать незавершенные сессии надолго
    staleTime: params?.status === 'IN_PROGRESS' ? 0 : 60 * 1000,
  });
}

/**
 * Hook для получения одной сессии
 */
export function useSession(id: string | null) {
  return useQuery({
    queryKey: sessionKeys.detail(id!),
    queryFn: () => SessionService.getById(id!),
    enabled: !!id,
  });
}

/**
 * Hook для создания новой сессии
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionRequest) => SessionService.create(data),
    onSuccess: () => {
      // Инвалидировать список сессий
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}

/**
 * Hook для отправки ответа на вопрос
 */
export function useSubmitResponse(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitResponseRequest) =>
      SessionService.submitResponse(sessionId, data),
    onSuccess: () => {
      // Инвалидировать текущую сессию
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
  });
}

/**
 * Hook для завершения сессии
 */
export function useSubmitSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => SessionService.submit(sessionId),
    onSuccess: (_, sessionId) => {
      // Инвалидировать сессию и список сессий
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}

/**
 * Hook для удаления сессии
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => SessionService.delete(sessionId),
    onSuccess: () => {
      // Инвалидировать список сессий
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}
