export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
    error?: string;
  };
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  projectId?: string; // Link to Backend project
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  projectId?: string;
}

export type ChatState = 
  | 'idle'
  | 'loading'
  | 'streaming'
  | 'error';

export interface ChatStore {
  // State
  chats: Chat[];
  activeChat: Chat | null;
  currentMessage: string;
  state: ChatState;
  settings: ChatSettings;
  
  // Actions
  createChat: () => void;
  selectChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  setCurrentMessage: (message: string) => void;
  updateSettings: (settings: Partial<ChatSettings>) => void;
  clearChats: () => void;
  loadChats: () => void;
  saveChats: () => void;
}