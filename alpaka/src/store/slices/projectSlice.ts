import { StateCreator } from 'zustand';
import { Node } from '@xyflow/react';
import { StoreState, Project } from './types';
import { historyManager } from '../modules/historyManager';
import { logger } from '@/utils/logger';
import { ensureCorrectNodeOrder } from '@/utils/nodeOrdering';

export interface ProjectSlice {
  // State
  currentProject: Project | undefined;
  
  // Actions
  setCurrentProject: (project: Project | undefined) => void;
  createProject: (name: string, description?: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  updateProjectName: (name: string) => Promise<void>;
  createNewProject: () => Promise<void>;
}

export const createProjectSlice: StateCreator<
  StoreState,
  [],
  [],
  ProjectSlice
> = (set, get) => ({
  // Initial state
  currentProject: undefined,
  
  // Actions
  setCurrentProject: (project: Project | undefined) => {
    set({ currentProject: project });
  },
  
  createProject: (name: string, description?: string) => {
    const newProject: Project = {
      id: `project_${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    set({ currentProject: newProject });
  },
  
  saveProject: async () => {
    const state = get();
    const { currentProject, nodes, edges, globalVariables, executionResults } = state;
    
    // Get current viewport from React Flow instance
    const viewport = state.viewport;
    
    if (!currentProject) return;
    
    
    // Clean nodes before saving - remove transient execution states
    // CRITICAL: Preserve parent-child relationships!
    const cleanedNodes = nodes.map(node => ({
      ...node,
      // Explicitly preserve parent-child properties
      parentId: node.parentId,
      extent: node.extent, 
      expandParent: node.expandParent,
      data: {
        ...node.data,
        // Remove ONLY transient states
        isExecuting: false,
        lastExecuted: undefined,
        executionStats: undefined,
        error: undefined
      }
    }));
    
    try {
      let response = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: currentProject.name,
          description: currentProject.description,
          nodes: cleanedNodes,
          edges,
          executionResults,
          globalVariables,
          viewport,
        }),
      });

      if (!response.ok) {
        // If update fails, try to create new project
        response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: currentProject.name,
            description: currentProject.description,
            nodes: cleanedNodes,
            edges,
            executionResults,
            globalVariables,
            viewport,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to save project: ${response.statusText}`);
      }

      const savedProject = await response.json();
      logger.info('Project saved successfully:', savedProject.name);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save project:', errorObj);
      throw errorObj;
    }
  },
  
  loadProject: async (projectId: string) => {
    const state = get();
    
    try {
      // Reset execution queue when switching projects
      const { queueManager } = await import('../modules/execution/queueManager');
      queueManager.reset();
      
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.statusText}`);
      }
      
      const projectData = await response.json();
      const project = projectData.project;
      
      if (!project) {
        throw new Error('Invalid project data');
      }
      
      const canvasData = project.canvasData || {};
      const rawNodes = canvasData.nodes || [];
      const executionResults = canvasData.executionResults || {};
      
      // Clean nodes on load - remove any persisted execution states
      // CRITICAL: Preserve parent-child relationships!
      const nodes = rawNodes.map((node: Node) => ({
        ...node,
        // Preserve parent-child properties
        parentId: node.parentId,
        extent: node.extent,
        expandParent: node.expandParent,
        data: {
          ...node.data,
          isExecuting: false,
          lastExecuted: undefined,
          executionStats: undefined,
          error: undefined,
          queueStatus: undefined
        }
      }));
      
      // Apply correct parent-child ordering before setting nodes
      const orderedNodes = ensureCorrectNodeOrder(nodes);

      const updatedEdges = canvasData.edges || [];
      
      // CRITICAL: Restore visual states BEFORE setting store
      // This ensures nodes show as completed when loaded
      const nodesWithRestoredStates = orderedNodes.map(node => {
        const executionResult = executionResults[node.id];
        if (executionResult && executionResult.success) {
          return {
            ...node,
            data: {
              ...node.data,
              queueStatus: 'completed' as const,
              lastExecuted: new Date(executionResult.executionStats?.timestamp || Date.now()),
              executionStats: executionResult.executionStats
            }
          };
        }
        return node;
      });
      
      // Restore completed nodes in queue manager BEFORE setting store
      // This ensures executeFlow can skip completed nodes correctly
      queueManager.restoreCompletedNodesFromExecutionResults(executionResults);
      
      // Restore ExecutionManager history from execution results
      // This populates the ExecutionManager with completed items from previous sessions
      queueManager.restoreQueueHistoryFromExecutionResults(executionResults, nodesWithRestoredStates);
      
      // Load project data with restored states
      set({
        nodes: nodesWithRestoredStates,
        edges: updatedEdges,
        globalVariables: project.globalVariables || {},
        executionResults: executionResults,
        viewport: canvasData.viewport || null,
        currentProject: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }
      });
      
      // Clear history and save initial state after loading
      historyManager.clearHistory();
      historyManager.saveToHistory({
        nodes: nodesWithRestoredStates,  // Use restored nodes
        edges: updatedEdges,  // Use updated edges with correct visibility
        selectedNodes: []
      });
      
      // Auto-execute InputNodes with values to restore variables
      if (state.executeNode) {
        const inputNodesToExecute = nodesWithRestoredStates.filter((node: Node) =>
          node.type === 'input' && 
          node.data?.value && 
          typeof node.data.value === 'string' &&
          node.data.value.trim() !== ''
        );
        
        // Execute all InputNodes with values
        for (const inputNode of inputNodesToExecute) {
          try {
            await state.executeNode(inputNode.id);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`Failed to restore variable for InputNode ${inputNode.id}:`, errorMsg);
          }
        }
      }
      
      logger.info('Project loaded successfully:', project.name);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load project:', errorObj);
      throw errorObj;
    }
  },
  
  updateProjectName: async (name: string) => {
    const state = get();
    const { currentProject } = state;
    
    if (!currentProject) return;
    
    const updatedProject = {
      ...currentProject,
      name,
      updatedAt: new Date().toISOString()
    };
    
    set({ currentProject: updatedProject });
    
    // Auto-save after name change
    try {
      await state.saveProject();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save project after name update:', errorObj);
    }
  },
  
  createNewProject: async () => {
    // Clear everything for new project
    set({
      nodes: [],
      edges: [],
      globalVariables: {},
      executionResults: {},
      selectedNodes: [],
      currentProject: {
        id: `project_${Date.now()}`,
        name: 'Untitled Project',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    
    // Clear history for new project
    historyManager.clearHistory();
    
    // Clear execution queue
    const { queueManager } = await import('../modules/execution/queueManager');
    queueManager.reset();
    
    logger.info('Created new project');
  }
});
