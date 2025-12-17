import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppSettings {
  // UI Settings
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showTimestamps: boolean;
  
  // Chat Settings
  autoScroll: boolean;
  enterToSend: boolean;
  showTypingIndicator: boolean;
  messageSound: boolean;
  
  // AI Settings
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  streamResponses: boolean;
  
  // Backend Integration
  backendUrl: string;
  defaultProjectId?: string;
  autoSaveChats: boolean;
  syncWithBackend: boolean;
}

interface SettingsStore {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  // UI Settings
  fontSize: 'medium',
  compactMode: false,
  showTimestamps: true,
  
  // Chat Settings
  autoScroll: true,
  enterToSend: true,
  showTypingIndicator: true,
  messageSound: false,
  
  // AI Settings
  defaultModel: 'gpt-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
  streamResponses: true,
  
  // Backend Integration
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
  defaultProjectId: undefined,
  autoSaveChats: true,
  syncWithBackend: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      
      updateSettings: (newSettings: Partial<AppSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
    }),
    {
      name: 'psypro-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);