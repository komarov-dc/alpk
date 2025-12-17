/**
 * API Configuration
 * Centralized configuration for all API endpoints and base URLs
 */

// Base URLs from environment variables with defaults
export const API_URLS = {
  // Ollama
  OLLAMA_BASE_URL: process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434',
  
  // OpenAI
  OPENAI_BASE_URL: process.env.NEXT_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  
  // LM Studio
  LMSTUDIO_BASE_URL: process.env.NEXT_PUBLIC_LMSTUDIO_BASE_URL || 'http://localhost:1234',
  
  // Anthropic
  ANTHROPIC_BASE_URL: process.env.NEXT_PUBLIC_ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
  
  // Google AI
  GOOGLE_AI_BASE_URL: process.env.NEXT_PUBLIC_GOOGLE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1',
} as const;

// Specific endpoints
export const API_ENDPOINTS = {
  // Ollama endpoints
  OLLAMA_GENERATE: `${API_URLS.OLLAMA_BASE_URL}/api/generate`,
  OLLAMA_CHAT: `${API_URLS.OLLAMA_BASE_URL}/api/chat`,
  OLLAMA_TAGS: `${API_URLS.OLLAMA_BASE_URL}/api/tags`,
  OLLAMA_PULL: `${API_URLS.OLLAMA_BASE_URL}/api/pull`,
  OLLAMA_ABORT: `${API_URLS.OLLAMA_BASE_URL}/api/abort`,
  
  // OpenAI endpoints
  OPENAI_MODELS: `${API_URLS.OPENAI_BASE_URL}/models`,
  OPENAI_CHAT: `${API_URLS.OPENAI_BASE_URL}/chat/completions`,
  
  // LM Studio endpoints  
  LMSTUDIO_CHAT: `${API_URLS.LMSTUDIO_BASE_URL}/v1/chat/completions`,
  LMSTUDIO_MODELS: `${API_URLS.LMSTUDIO_BASE_URL}/v1/models`,
  
  // Anthropic endpoints
  ANTHROPIC_MESSAGES: `${API_URLS.ANTHROPIC_BASE_URL}/messages`,
  
  // Google AI endpoints
  GOOGLE_AI_MODELS: `${API_URLS.GOOGLE_AI_BASE_URL}/models`,
} as const;

// Helper function to validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Helper to get base URL for a provider
export function getProviderBaseUrl(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'ollama':
      return API_URLS.OLLAMA_BASE_URL;
    case 'openai':
      return API_URLS.OPENAI_BASE_URL;
    case 'lmstudio':
      return API_URLS.LMSTUDIO_BASE_URL;
    case 'anthropic':
      return API_URLS.ANTHROPIC_BASE_URL;
    case 'google':
      return API_URLS.GOOGLE_AI_BASE_URL;
    default:
      return API_URLS.OLLAMA_BASE_URL;
  }
}
