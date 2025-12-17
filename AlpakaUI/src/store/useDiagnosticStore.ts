import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppMode } from '@/components/ModeSelector';

/**
 * Zustand store для UI состояния диагностической системы
 *
 * Server state (сессии, вопросы, ответы) теперь управляется через TanStack Query
 * Здесь только UI state (режим приложения)
 */
interface DiagnosticStore {
  // UI state - режим приложения
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

export const useDiagnosticStore = create<DiagnosticStore>()(
  persist(
    (set) => ({
      // Initial state
      appMode: 'chat',

      // Set app mode
      setAppMode: (mode: AppMode) => {
        set({ appMode: mode });
      },
    }),
    {
      name: 'diagnostic-ui-storage',
      partialize: (state) => ({
        appMode: state.appMode,
      }),
    }
  )
);
