import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatSettings } from '@/types/chat';

/**
 * Zustand store для UI состояния чата
 *
 * Server state (chats, messages) теперь управляется через TanStack Query
 * Здесь только UI state:
 * - activeChatId - какой чат открыт
 * - currentMessage - текущий текст в input
 * - settings - настройки чата (локальные)
 */
interface ChatStore {
  // UI State
  activeChatId: string | null;
  currentMessage: string;
  settings: ChatSettings;

  // Actions
  setActiveChatId: (chatId: string | null) => void;
  setCurrentMessage: (message: string) => void;
  updateSettings: (settings: Partial<ChatSettings>) => void;
  clearCurrentMessage: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Initial state
      activeChatId: null,
      currentMessage: '',
      settings: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: 'You are a helpful AI assistant.',
      },

      // Actions
      setActiveChatId: (chatId: string | null) => {
        set({ activeChatId: chatId });
      },

      setCurrentMessage: (message: string) => {
        set({ currentMessage: message });
      },

      updateSettings: (newSettings: Partial<ChatSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      clearCurrentMessage: () => {
        set({ currentMessage: '' });
      },
    }),
    {
      name: 'psypro-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        activeChatId: state.activeChatId,
      }),
    }
  )
);
