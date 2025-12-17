/**
 * Centralized configuration constants for Alpaka
 * All hardcoded values should be moved here
 */

// API Configuration
export const API_CONFIG = {
  // Ollama
  OLLAMA_BASE_URL: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_DEFAULT_PORT: 11434,
  OLLAMA_TIMEOUT: 30000, // 30 seconds
  
  // LM Studio
  LMSTUDIO_BASE_URL: process.env.NEXT_PUBLIC_LMSTUDIO_URL || 'http://localhost:1234',
  LMSTUDIO_DEFAULT_PORT: 1234,
  
  // OpenAI
  OPENAI_BASE_URL: process.env.NEXT_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_TIMEOUT: 60000, // 60 seconds
  
  
  // General
  DEFAULT_REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// UI Configuration
export const UI_CONFIG = {
  // Node dimensions
  NODE_MIN_WIDTH: 350,
  NODE_MIN_HEIGHT: 200,
  NODE_DEFAULT_WIDTH: 400,
  NODE_DEFAULT_HEIGHT: 300,
  
  // Canvas
  CANVAS_MIN_ZOOM: 0.1,
  CANVAS_MAX_ZOOM: 4,
  CANVAS_DEFAULT_ZOOM: 1,
  CANVAS_FIT_VIEW_PADDING: 0.2,
  CANVAS_FIT_VIEW_DURATION: 200,
  
  // Animation
  ANIMATION_DURATION_SHORT: 150,
  ANIMATION_DURATION_MEDIUM: 300,
  ANIMATION_DURATION_LONG: 500,
  
  // Debounce/Throttle
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  AUTO_SAVE_DELAY: 2000, // 2 seconds
  
  // Limits
  MAX_UNDO_HISTORY: 50,
  MAX_CLIPBOARD_SIZE: 100,
  MAX_VARIABLE_PREVIEW_LENGTH: 100,
  MAX_LOG_MESSAGE_LENGTH: 500,
} as const;

// Model Provider Configuration
export const MODEL_CONFIG = {
  // Default models
  DEFAULT_OLLAMA_MODEL: 'llama3.2',
  DEFAULT_OPENAI_MODEL: 'gpt-4o-mini',
  DEFAULT_LMSTUDIO_MODEL: 'local-model',
  
  // Model parameters
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
  DEFAULT_TOP_P: 1,
  DEFAULT_TOP_K: 40,
  DEFAULT_FREQUENCY_PENALTY: 0,
  DEFAULT_PRESENCE_PENALTY: 0,
  
  // Model groups
  MAX_MODEL_GROUPS: 5,
  DEFAULT_MODEL_GROUP: 1,
} as const;

// Execution Configuration
export const EXECUTION_CONFIG = {
  // Execution limits
  MAX_EXECUTION_DEPTH: 100,
  MAX_LOOP_ITERATIONS: 100,
  EXECUTION_TIMEOUT: 300000, // 5 minutes
  
  // Retry configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  
  // Batch processing
  BATCH_SIZE: 10,
  PARALLEL_EXECUTION_LIMIT: 5,
} as const;

// Storage Configuration
export const STORAGE_CONFIG = {
  // Local storage keys
  PROJECT_STORAGE_KEY: 'alpaka_current_project',
  PREFERENCES_STORAGE_KEY: 'alpaka_preferences',
  RECENT_PROJECTS_KEY: 'alpaka_recent_projects',
  
  // Limits
  MAX_RECENT_PROJECTS: 10,
  MAX_PROJECT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VARIABLE_SIZE: 1024 * 1024, // 1MB
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_STREAMING: process.env.NEXT_PUBLIC_ENABLE_STREAMING === 'true',
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
  ENABLE_PERFORMANCE_MONITORING: process.env.NEXT_PUBLIC_ENABLE_MONITORING === 'true',
} as const;

// Export all configs as a single object for convenience
export const CONFIG = {
  API: API_CONFIG,
  UI: UI_CONFIG,
  MODEL: MODEL_CONFIG,
  EXECUTION: EXECUTION_CONFIG,
  STORAGE: STORAGE_CONFIG,
  FEATURES: FEATURE_FLAGS,
} as const;

// Type exports
export type ApiConfig = typeof API_CONFIG;
export type UiConfig = typeof UI_CONFIG;
export type ModelConfig = typeof MODEL_CONFIG;
export type ExecutionConfig = typeof EXECUTION_CONFIG;
export type StorageConfig = typeof STORAGE_CONFIG;
export type FeatureFlags = typeof FEATURE_FLAGS;
