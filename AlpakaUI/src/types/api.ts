/**
 * Типы для API responses и requests
 */

// Session types
export interface SessionQuestion {
  id: number;
  text: string;
  orderIndex: number;
}

export interface SessionResponse {
  questionId: number;
  answer: string;
  timeSpent: number;
}

export interface Session {
  id: string;
  mode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  respondentName: string;
  totalQuestions: number;
  currentIndex: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  completedAt?: string;
  responses: SessionResponse[];
  questions?: SessionQuestion[];
}

export interface CreateSessionRequest {
  mode: 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE';
  totalQuestions: number;
  respondentName?: string;
}

export interface CreateSessionResponse {
  session: Session;
  questions: SessionQuestion[];
}

export interface SubmitResponseRequest {
  questionId: number;
  questionText: string;
  answer: string;
  timeSpent: number;
}

export interface SubmitResponseResponse {
  currentIndex: number;
  sessionComplete: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: string;
}

export interface ChatData {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatRequest {
  title: string;
}

export interface UpdateChatRequest {
  title?: string;
}

export interface CreateMessageRequest {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}
