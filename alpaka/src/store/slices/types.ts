// Import slice interfaces
import { CanvasSlice } from './canvasSlice';
import { ExecutionSlice } from './executionSlice';
import { VariablesSlice } from './variablesSlice';
import { SelectionSlice } from './selectionSlice';
import { ProjectSlice } from './projectSlice';
import { NodeOperationsSlice } from './nodeOperationsSlice';
import { HistorySlice } from './historySlice';

// Combined store state
export interface StoreState extends 
  CanvasSlice,
  ExecutionSlice,
  VariablesSlice,
  SelectionSlice,
  ProjectSlice,
  HistorySlice,
  NodeOperationsSlice {
  // Any additional shared state can go here
}

// Helper types
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GlobalVariable {
  name: string;
  value: string;
  description?: string;
  folder?: string;
}
