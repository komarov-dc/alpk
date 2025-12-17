import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

// Types matching Backend's API
export interface BackendProject {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackendVariable {
  name: string;
  value: string;
  type?: string;
  description?: string;
  folder?: string;
}

export interface BackendExecutionResult {
  nodeId: string;
  success: boolean;
  output?: Record<string, unknown> | string | number | boolean | null;
  error?: string;
  duration?: number;
}

export interface BackendNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface BackendEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// API Response schemas
const ProjectListSchema = z.object({
  success: z.boolean(),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }))
});

const ProjectDetailSchema = z.object({
  success: z.boolean(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    canvasData: z.object({
      nodes: z.array(z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.string(), z.unknown())
      })),
      edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional()
      })),
      executionResults: z.record(z.string(), z.object({
        nodeId: z.string(),
        success: z.boolean(),
        output: z.unknown().optional(),
        error: z.string().optional(),
        duration: z.number().optional()
      })).optional(),
    }),
    globalVariables: z.record(z.string(), z.object({
      name: z.string(),
      value: z.string(),
      type: z.string().optional(),
      description: z.string().optional(),
      folder: z.string().optional(),
    })),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
});

// Backend API Client
export class BackendClient {
  private client: AxiosInstance;
  
  constructor(baseURL: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Get all projects
  async getProjects(): Promise<BackendProject[]> {
    const response = await this.client.get('/api/projects');
    const data = ProjectListSchema.parse(response.data);
    return data.projects;
  }
  
  // Get project details
  async getProject(projectId: string) {
    const response = await this.client.get(`/api/projects/${projectId}`);
    const data = ProjectDetailSchema.parse(response.data);
    return data.project;
  }
  
  // Update project
  async updateProject(projectId: string, updates: {
    name?: string;
    description?: string;
    nodes?: BackendNode[];
    edges?: BackendEdge[];
    globalVariables?: Record<string, BackendVariable>;
  }) {
    const response = await this.client.put(`/api/projects/${projectId}`, updates);
    return response.data;
  }
  
  // Execute workflow (this would need to be implemented in Backend)
  async executeWorkflow(projectId: string, input: Record<string, string | number | boolean>) {
    // This endpoint doesn't exist yet in Backend, but would be needed
    const response = await this.client.post(`/api/projects/${projectId}/execute`, {
      input,
    });
    return response.data;
  }
  
  // Get global variables
  async getVariables(projectId: string): Promise<Record<string, BackendVariable>> {
    const project = await this.getProject(projectId);
    return project.globalVariables;
  }
  
  // Update global variable
  async updateVariable(projectId: string, variableName: string, value: string) {
    const project = await this.getProject(projectId);
    const variables = project.globalVariables;
    const existingVariable = variables[variableName];
    if (!existingVariable) {
      throw new Error(`Variable ${variableName} not found`);
    }
    variables[variableName] = {
      ...existingVariable,
      value,
    };
    
    await this.updateProject(projectId, {
      globalVariables: variables,
    });
  }
}

// Singleton instance
export const backendClient = new BackendClient();