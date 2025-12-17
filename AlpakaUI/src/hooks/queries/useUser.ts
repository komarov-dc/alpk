import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserApiClient } from '@/services/UserApiClient';

/**
 * Query Keys для users
 */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: () => [...userKeys.lists()] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

/**
 * Hook для получения всех пользователей
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: UserApiClient.getAll,
  });
}

/**
 * Hook для получения одного пользователя
 */
export function useUser(id: string | null) {
  return useQuery({
    queryKey: userKeys.detail(id!),
    queryFn: () => UserApiClient.getById(id!),
    enabled: !!id,
  });
}

/**
 * Hook для обновления роли пользователя
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      UserApiClient.updateRole(id, role),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Hook для удаления пользователя
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => UserApiClient.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
