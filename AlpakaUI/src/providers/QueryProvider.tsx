'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Данные считаются свежими 1 минуту
            staleTime: 60 * 1000,
            // Кеш хранится 5 минут
            gcTime: 5 * 60 * 1000,
            // Повторить запрос 1 раз при ошибке
            retry: 1,
            // Не перезапрашивать при фокусе окна
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Показывать ошибки в консоли
            onError: (error) => {
              console.error('Mutation error:', error);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
