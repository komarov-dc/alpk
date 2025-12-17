// Unified Node Type System for Alpaka Workflow Engine
// This replaces the old fragmented type system with a modern, extensible approach

// Base execution statistics
export interface ExecutionStats {
  tokens?: number; // Legacy field for backward compatibility
  promptTokens?: number; // Input tokens
  completionTokens?: number; // Output tokens
  totalTokens?: number; // Total tokens (prompt + completion)
  duration: number;
  timestamp: string;
  startTime?: string;
  endTime?: string;
}

// Base node interface - common properties for all nodes
export interface BaseNodeData {
  // Core identification
  id: string;
  type: string;
  label: string;

  // Protection flag - prevents deletion of critical nodes in system projects
  protected?: boolean;

  // Execution state
  isExecuting?: boolean;
  lastExecuted?: Date;

  // Error handling
  error?: string;
  lastError?: string;

  // Output management
  outputVariable?: string;
  outputValue?: unknown;

  // Execution results
  executionStats?: ExecutionStats;
  fullContext?: object; // Full application context
  providerRequest?: object; // Request sent to model provider (Ollama, LMStudio, etc.)
  providerResponse?: object; // Response from model provider

  // UI state
  isCollapsed?: boolean;
  width?: number;
  height?: number;
}

// LLM-specific data structure
export interface LLMNodeData extends BaseNodeData {
  // Model configuration
  modelGroup?: number; // For Basic LLM Chain
  model?: string; // For legacy Ollama Node

  // Queue status
  queueStatus?: "queued" | "executing" | "completed" | "failed" | "waiting";

  // Prompts
  systemPrompt?: string;
  userPrompt?: string;
  userPrompts?: Array<{
    id: string;
    content: string;
    variables?: string[];
  }>;

  // Basic LLM Chain messages
  messages?: Array<{
    id: string;
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  // LLM responses
  lastResponse?: string;
  lastThinking?: string;

  // UI state
  activeTab?: "messages" | "response" | "settings" | "debug";

  // Streaming configuration
  streamingEnabled?: boolean;

  // Model configuration (legacy support)
  config?: {
    model: string;
    prompt: string;
    system?: string;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    [key: string]: unknown;
  };
}

// Model Provider specific data
export interface ModelProviderData extends BaseNodeData {
  // Provider configuration
  provider: "ollama" | "lmstudio" | "openai" | "anthropic" | "yandex";
  model: string;
  groupId: number;
  apiKey?: string;
  oauthToken?: string; // Yandex Cloud OAuth token
  baseURL?: string;
  folderId?: string; // Yandex Cloud folder ID
  maxTokens?: number;
  maxTokensEnabled?: boolean;

  // Model parameters with enable/disable toggles
  temperature: number;
  temperatureEnabled: boolean;
  topP: number;
  topPEnabled: boolean;
  topK: number;
  topKEnabled: boolean;
  repeatPenalty: number;
  repeatPenaltyEnabled: boolean;
  numPredict: number;
  numPredictEnabled: boolean;
  mirostatSampling: number;
  mirostatSamplingEnabled: boolean;
  mirostatEta: number;
  mirostatEtaEnabled: boolean;
  mirostatTau: number;
  mirostatTauEnabled: boolean;
  contextWindow: number;
  contextWindowEnabled: boolean;
  gpuLayers: number;
  gpuLayersEnabled: boolean;
  numThread: number;
  numThreadEnabled: boolean;
  repeatLastN: number;
  repeatLastNEnabled: boolean;
  tfsZ: number;
  tfsZEnabled: boolean;
  seed: number;
  seedEnabled: boolean;
  keepAlive: boolean;
  keepAliveEnabled: boolean;
  format: string;
  formatEnabled: boolean;
  jsonSchema: string;
  jsonSchemaEnabled: boolean;
  stopSequences: string[];
  stopSequencesEnabled: boolean;

  // GPT-OSS specific parameters
  harmonyMode: boolean;
  harmonyModeEnabled: boolean;
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  reasoningEffort: "none" | "low" | "medium" | "high";
  reasoningEffortEnabled: boolean;

  // Qwen3 thinking mode
  think: boolean;
  thinkEnabled: boolean;
}

// Output field interface for advanced Output nodes
export interface OutputField {
  id: string;
  variable: string;
  format: "text" | "json" | "html" | "markdown";
  label?: string;
}

// Trigger node data
export interface TriggerNodeData extends BaseNodeData {
  triggerType: "manual" | "webhook" | "schedule" | "event";
  config?: {
    schedule?: string;
    webhook?: {
      url?: string;
      method?: "GET" | "POST";
      headers?: Record<string, string>;
    };
    event?: {
      type: string;
      condition?: string;
    };
  };
}

// Output Sender node data - sends job results back to backend
export interface OutputSenderNodeData extends BaseNodeData {
  config?: {
    baseUrl?: string; // Backend base URL (e.g., http://localhost:3001)
    endpoint?: string; // API endpoint (e.g., /api/external/jobs)
    method?: "POST" | "PATCH" | "PUT"; // HTTP method
    secretKey?: string; // Authentication secret key
    includeReports?: boolean; // Whether to include reports in payload
    autoSend?: boolean; // Auto-send on node execution
    customFields?: Record<string, string>; // Additional fields to send (fieldName -> variableName)
  };
  mapping?: {
    jobIdVariable?: string; // Variable containing job ID
    statusVariable?: string; // Variable containing job status (default: 'completed')
    reports?: Record<string, string>; // Report name (e.g. "Adapted Report") -> variable name
  };
  lastSent?: Date; // Last successful send timestamp
  lastResponse?: Record<string, unknown>; // Last API response
}

// Note node data
export interface NoteNodeData extends BaseNodeData {
  content: string;
  color?: string;
  fontSize?: number;
}

// Union type for all node data types
export type UnifiedNodeData =
  | LLMNodeData
  | ModelProviderData
  | TriggerNodeData
  | OutputSenderNodeData
  | NoteNodeData;

// Node type constants - aligned with actual usage in codebase
export const NODE_TYPES = {
  // LLM Nodes
  BASIC_LLM_CHAIN: "basicLLMChain",
  MODEL_PROVIDER: "modelProvider",

  // Control Nodes
  TRIGGER: "trigger",
  OUTPUT_SENDER: "outputSender",

  // Organization Nodes
  NOTE: "note",
} as const;

export type NodeTypeConstant = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];

// Helper type guards - aligned with actual node types used in codebase
export function isLLMNode(data: UnifiedNodeData): data is LLMNodeData {
  return data.type === NODE_TYPES.BASIC_LLM_CHAIN;
}

export function isModelProviderNode(
  data: UnifiedNodeData,
): data is ModelProviderData {
  return data.type === NODE_TYPES.MODEL_PROVIDER;
}

export function isTriggerNode(data: UnifiedNodeData): data is TriggerNodeData {
  return data.type === NODE_TYPES.TRIGGER;
}

export function isOutputSenderNode(
  data: UnifiedNodeData,
): data is OutputSenderNodeData {
  return data.type === NODE_TYPES.OUTPUT_SENDER;
}

export function isNoteNode(data: UnifiedNodeData): data is NoteNodeData {
  return data.type === NODE_TYPES.NOTE;
}

// Execution result interface (updated)
export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  output?: {
    type: string;
    value?: unknown;
    text?: string;
    response?: string;
    thinking?: string;
    [key: string]: unknown;
  };
  error?: string;
  duration: number;
  executionStats?: ExecutionStats;
  // Debug information (moved from node.data to prevent memory bloat)
  debugInfo?: {
    context?: Record<string, unknown>;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
}
