// Global type declarations for Alpaka project

declare global {
  // Auto-save timeout management
  var __alpaka_autosave_timeout: NodeJS.Timeout | undefined;
  var __alpaka_autosave_globals_timeout: NodeJS.Timeout | undefined;

  // Window extensions (if needed in browser context)
  interface Window {
    __alpaka_autosave_timeout?: NodeJS.Timeout;
    __alpaka_autosave_globals_timeout?: NodeJS.Timeout;
  }
}

// Model provider configuration type
export interface ModelProviderConfig {
  provider: 'ollama' | 'lmstudio' | 'openai' | 'anthropic';
  model: string;
  groupId: number;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  numPredict?: number;
  [key: string]: unknown;
}

export {};