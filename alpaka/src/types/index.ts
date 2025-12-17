// Ollama API types based on latest documentation
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  suffix?: string;
  images?: string[]; // base64 encoded images
  format?: 'json' | string;
  options?: {
    temperature?: number;
    top_k?: number;
    top_p?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    num_predict?: number;
    num_ctx?: number;
    num_batch?: number;
    num_gpu?: number;
    main_gpu?: number;
    low_vram?: boolean;
    f16_kv?: boolean;
    logits_all?: boolean;
    vocab_only?: boolean;
    use_mmap?: boolean;
    use_mlock?: boolean;
    embedding_only?: boolean;
    numa?: boolean;
    num_thread?: number;
    tfs_z?: number;
    typical_p?: number;
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    penalize_newline?: boolean;
    stop?: string[];
  };
  system?: string;
  template?: string;
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string; // e.g., "5m", "10s"
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Re-export the unified node types as primary types
export * from './nodeTypes';

// Canvas types - using UnifiedNodeData instead of legacy NodeData
export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: import('./nodeTypes').UnifiedNodeData;
  selected?: boolean;
  dragging?: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  createdAt: Date;
  updatedAt: Date;
}

import { ExecutionVariables, NodeResults } from './common';

// Execution context - simplified
export interface ExecutionContext {
  variables: ExecutionVariables;
  nodeResults: NodeResults;
}

