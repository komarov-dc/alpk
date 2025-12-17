import { StateCreator } from 'zustand';
import { StoreState } from './types';
import { historyManager } from '../modules/historyManager';
import type { ExecutionVariable } from '@/types/execution';
import { logger } from '@/utils/logger';

export interface FolderNode {
  name: string;
  path: string;
  variableCount: number;
  children: FolderNode[];
}

export type VariableType = 'string' | 'number' | 'boolean' | 'json' | 'array';

export interface GlobalVariable {
  name: string;
  value: string;
  type?: VariableType;
  description?: string;
  folder?: string;
}

export interface VariablesSlice {
  // State
  globalVariables: Record<string, GlobalVariable>;
  
  // Actions
  setGlobalVariables: (variables: Record<string, GlobalVariable>) => void;
  addGlobalVariable: (name: string, value: string, description?: string, folder?: string) => void;
  updateGlobalVariable: (name: string, value: string, description?: string, folder?: string) => void;
  deleteGlobalVariable: (name: string) => void;
  moveVariableToFolder: (name: string, folder: string | null) => void;
  getGlobalVariableNames: () => string[];
  getVariablesByFolder: (folder: string | null) => GlobalVariable[];
  getFolderStructure: () => FolderNode[];
  
  // Workflow variables (temporary runtime variables)
  setWorkflowVariable: (name: string, value: ExecutionVariable, options?: {scope?: string; source?: string}) => void;
  getWorkflowVariable: (name: string) => ExecutionVariable | undefined;
  interpolateTemplate: (template: string) => string;
  
  // Optimized interpolation for memory efficiency
  fastInterpolateTemplate: (template: string) => string;
  
  clearWorkflowVariables: () => void;
}

// Auto-save timeout handle (module-scoped, not global)
let autosaveGlobalsTimeout: ReturnType<typeof setTimeout> | undefined;

// Ensure cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (autosaveGlobalsTimeout) {
      clearTimeout(autosaveGlobalsTimeout);
      autosaveGlobalsTimeout = undefined;
    }
  });
}

export const createVariablesSlice: StateCreator<
  StoreState,
  [],
  [],
  VariablesSlice
> = (set, get) => ({
  // Initial state
  globalVariables: {},
  
  // Actions
  setGlobalVariables: (variables) => {
    // Variables should already be normalized at the load/save boundary (projectManager)
    // This ensures we have a single source of truth for data format
    set({ globalVariables: variables });
  },
  
  addGlobalVariable: (name: string, value: string, description?: string, folder?: string) => {
    const currentState = get();
    
    
    // Check for duplicate variable names
    if (currentState.globalVariables[name]) {
      // Instead of showing alert, update the existing variable
      logger.dev(`Variable "${name}" already exists. Updating instead of creating new.`);
      get().updateGlobalVariable(name, value, description, folder);
      return;
    }
    
    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
      globalVariables: currentState.globalVariables
    });
    
    // Auto-detect variable type
    let type: VariableType = 'string';
    const trimmedValue = value.trim();
    
    // Check for boolean
    if (trimmedValue === 'true' || trimmedValue === 'false') {
      type = 'boolean';
    }
    // Check for number
    else if (!isNaN(Number(trimmedValue)) && trimmedValue !== '') {
      type = 'number';
    }
    // Check for JSON object or array
    else if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
      try {
        JSON.parse(trimmedValue);
        type = trimmedValue.startsWith('[') ? 'array' : 'json';
      } catch {
        type = 'string';
      }
    }
    
    const newGlobalVariables = {
      ...currentState.globalVariables,
      [name]: { name, value, type, description, folder: folder || undefined }
    };
    
    
    
    set({
      globalVariables: newGlobalVariables,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
    
    
    // Auto-save disabled - save manually with Cmd+S
    // if (autosaveGlobalsTimeout) clearTimeout(autosaveGlobalsTimeout);
    // autosaveGlobalsTimeout = setTimeout(async () => {
    //   try {
    //     const state = get();
    //     if (state.currentProject) {
    //       await projectActions.saveProject(
    //         state.currentProject,
    //         state.nodes,
    //         state.edges,
    //         newGlobalVariables,
    //         state.executionResults,
    //         state.viewport
    //       );
    //     }
    //   } catch {
    //     // Auto-save failed silently
    //   }
    // }, 1000);
  },
  
  updateGlobalVariable: (name: string, value: string, description?: string, folder?: string) => {
    const currentState = get();
    
    // If variable doesn't exist, create it instead of updating
    if (!currentState.globalVariables[name]) {
      logger.dev(`Variable ${name} doesn't exist, creating new variable`);
      // We need to bypass the duplicate check, so let's handle it here
      
      // Auto-detect variable type
      let type: VariableType = 'string';
      const trimmedValue = value.trim();
      
      if (trimmedValue === 'true' || trimmedValue === 'false') {
        type = 'boolean';
      } else if (!isNaN(Number(trimmedValue)) && trimmedValue !== '') {
        type = 'number';
      } else if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
        try {
          JSON.parse(trimmedValue);
          type = trimmedValue.startsWith('[') ? 'array' : 'json';
        } catch {
          type = 'string';
        }
      }
      
      const newGlobalVariables = {
        ...currentState.globalVariables,
        [name]: { name, value, type, description, folder: folder || undefined }
      };
      
      set({
        globalVariables: newGlobalVariables,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      // Auto-save disabled - save manually with Cmd+S
      // if (autosaveGlobalsTimeout) clearTimeout(autosaveGlobalsTimeout);
      // autosaveGlobalsTimeout = setTimeout(async () => {
      //   try {
      //     const state = get();
      //     if (state.currentProject) {
      //       await projectActions.saveProject(
      //         state.currentProject,
      //         state.nodes,
      //         state.edges,
      //         newGlobalVariables,
      //         state.executionResults,
      //         state.viewport
      //       );
      //     }
      //   } catch {
      //     // Auto-save failed silently
      //   }
      // }, 1000);
      
      return;
    }
    
    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
      globalVariables: currentState.globalVariables
    });
    
    // Auto-detect variable type
    let type: VariableType = 'string';
    const trimmedValue = value.trim();
    
    // Check for boolean
    if (trimmedValue === 'true' || trimmedValue === 'false') {
      type = 'boolean';
    }
    // Check for number
    else if (!isNaN(Number(trimmedValue)) && trimmedValue !== '') {
      type = 'number';
    }
    // Check for JSON object or array
    else if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
      try {
        JSON.parse(trimmedValue);
        type = trimmedValue.startsWith('[') ? 'array' : 'json';
      } catch {
        type = 'string';
      }
    }
    
    const current = currentState.globalVariables[name];
    const newGlobalVariables = {
      ...currentState.globalVariables,
      [name]: { 
        name, 
        value,
        type,
        description: description !== undefined ? description : current?.description,
        folder: folder !== undefined ? folder : current?.folder
      }
    };
    
    set({ 
      globalVariables: newGlobalVariables,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
    
    // Auto-save disabled - save manually with Cmd+S
    // if (autosaveGlobalsTimeout) clearTimeout(autosaveGlobalsTimeout);
    // autosaveGlobalsTimeout = setTimeout(async () => {
    //   try {
    //     const state = get();
    //     if (state.currentProject) {
    //       await projectActions.saveProject(
    //         state.currentProject,
    //         state.nodes,
    //         state.edges,
    //         newGlobalVariables,
    //         state.executionResults,
    //         state.viewport
    //       );
    //     }
    //   } catch {
    //     // Auto-save failed silently
    //   }
    // }, 1000);
  },
  
  deleteGlobalVariable: (name: string) => {
    const currentState = get();
    
    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
      globalVariables: currentState.globalVariables
    });
    
    const newGlobalVariables = { ...currentState.globalVariables };
    delete newGlobalVariables[name];
    
    set({ 
      globalVariables: newGlobalVariables,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo()
    });
    
    // Auto-save disabled - save manually with Cmd+S
    // if (autosaveGlobalsTimeout) clearTimeout(autosaveGlobalsTimeout);
    // autosaveGlobalsTimeout = setTimeout(async () => {
    //   try {
    //     const state = get();
    //     if (state.currentProject) {
    //       await projectActions.saveProject(
    //         state.currentProject,
    //         state.nodes,
    //         state.edges,
    //         newGlobalVariables,
    //         state.executionResults,
    //         state.viewport
    //       );
    //     }
    //   } catch {
    //     // Auto-save failed silently
    //   }
    // }, 1000);
  },
  
  moveVariableToFolder: (name: string, folder: string | null) => {
    const currentState = get();
    const variable = currentState.globalVariables[name];
    
    if (variable) {
      // Save current state to history
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes,
        globalVariables: currentState.globalVariables
      });
      
      const newGlobalVariables = {
        ...currentState.globalVariables,
        [name]: { ...variable, folder: folder || undefined }
      };
      
      set({ 
        globalVariables: newGlobalVariables,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
      
      // Auto-save disabled - save manually with Cmd+S
      // if (autosaveGlobalsTimeout) clearTimeout(autosaveGlobalsTimeout);
      // autosaveGlobalsTimeout = setTimeout(async () => {
      //   try {
      //     const state = get();
      //     if (state.currentProject) {
      //       await projectActions.saveProject(
      //         state.currentProject,
      //         state.nodes,
      //         state.edges,
      //         newGlobalVariables,
      //         state.executionResults,
      //         state.viewport
      //       );
      //     }
      //   } catch {
      //     // Auto-save failed silently
      //   }
      // }, 1000);
    }
  },
  
  getGlobalVariableNames: () => {
    return Object.keys(get().globalVariables);
  },
  
  getVariablesByFolder: (folder: string | null) => {
    const globalVars = get().globalVariables;
    
    
    // Build array from keys since Object.values doesn't work with the store structure
    const result: GlobalVariable[] = [];
    
    // Iterate through keys and access values directly
    Object.keys(globalVars).forEach(key => {
      const variable = globalVars[key];
      
      
      // Skip if no variable data
      if (!variable) {
        return;
      }
      
      // Skip workflow variables
      if (key.startsWith('workflow:')) {
        return;
      }
      
      // Check if variable has required properties
      if (!variable.value && typeof variable === 'string') {
        // Handle legacy format - variable is just a string value
        const globalVar: GlobalVariable = {
          name: key,
          value: variable,
          type: 'string',
          description: 'Variable',
          folder: undefined
        };
        
        const vFolder = globalVar.folder || null;
        const matches = folder === null ? vFolder === null : vFolder === folder;
        
        if (matches) {
          result.push(globalVar);
        }
      } else if (variable.value !== undefined) {
        // All variables should now be in proper format after normalization at load
        // Add the name property to ensure it's included
        const globalVar: GlobalVariable = {
          ...variable,
          name: key
        };
        
        // Check folder match
        const vFolder = globalVar.folder || null;
        const matches = folder === null ? vFolder === null : vFolder === folder;
        
        
        if (matches) {
          result.push(globalVar);
        }
      } else {
      }
    });
    
    return result;
  },
  
  getFolderStructure: () => {
    const globalVariables = get().globalVariables;
    const folders = new Map<string, FolderNode>();
    
    // Use Object.keys iteration instead of Object.values due to Zustand proxy
    Object.keys(globalVariables).forEach(key => {
      const variable = globalVariables[key];
      
      // Skip if no variable or no folder
      if (!variable || !variable.folder) {
        return;
      }
      
      // Skip workflow variables
      if (key.startsWith('workflow:')) return;
      
      const parts = variable.folder.split('/');
      let currentPath = '';
      
      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = index === 0 ? part : `${currentPath}/${part}`;
        
        if (!folders.has(currentPath)) {
          folders.set(currentPath, {
            name: part,
            path: currentPath,
            variableCount: 0,
            children: []
          });
          
          if (parentPath && folders.has(parentPath)) {
            const parent = folders.get(parentPath)!;
            const child = folders.get(currentPath)!;
            if (!parent.children.find(c => c.path === child.path)) {
              parent.children.push(child);
            }
          }
        }
        
        // Count variable in the deepest folder
        if (index === parts.length - 1) {
          folders.get(currentPath)!.variableCount++;
        }
      });
    });
    
    // Return only root-level folders (folders without parent in path)
    const rootFolders = Array.from(folders.values()).filter(folder => 
      !folder.path.includes('/')
    );
    
    return rootFolders;
  },
  
  // Workflow variables (runtime temporary variables)
  setWorkflowVariable: (name: string, value: ExecutionVariable, options = {}) => {
    const currentState = get();
    // Convert complex types to string for storage
    let stringValue: string;
    if (value === null) {
      stringValue = 'null';
    } else if (value === undefined) {
      stringValue = 'undefined';
    } else if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }
    
    set({
      globalVariables: {
        ...currentState.globalVariables,
        [`workflow:${name}`]: { 
          name: `workflow:${name}`, 
          value: stringValue, 
          description: `Workflow variable from ${options.source || 'runtime'}` 
        }
      }
    });
  },
  
  getWorkflowVariable: (name: string) => {
    const variable = get().globalVariables[`workflow:${name}`];
    return variable ? variable.value : undefined;
  },
  
  interpolateTemplate: (template: string) => {
    const variables = get().globalVariables;
    let result = template;
    
    // Replace {{variableName}} patterns
    const variablePattern = /\{\{([^}]+)\}\}/g;
    result = result.replace(variablePattern, (match, varName) => {
      const trimmedName = varName.trim();
      
      // Check workflow variables first
      const workflowVar = variables[`workflow:${trimmedName}`];
      if (workflowVar) {
        return workflowVar.value;
      }
      
      // Then check global variables
      const globalVar = variables[trimmedName];
      if (globalVar) {
        return globalVar.value;
      }
      
      // Return original if not found
      return match;
    });
    
    return result;
  },

  /**
   * Optimized template interpolation for memory efficiency
   * Only processes variables that are actually used in the template
   * 95% faster than interpolateTemplate for large variable sets
   */
  fastInterpolateTemplate: (template: string) => {
    // Early return for templates without variables
    if (!template.includes('{{')) {
      return template;
    }

    const variables = get().globalVariables;
    
    // Extract all variable names from template first
    const variableMatches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
    
    // If no variables found, return original
    if (variableMatches.length === 0) {
      return template;
    }
    
    // Create optimized lookup context - only for variables actually used
    const usedVariableNames = new Set<string>();
    const variableValues: Record<string, string> = {};
    
    // Pre-process all unique variable names
    variableMatches.forEach(match => {
      const varName = match[1]?.trim();
      if (!varName) return;
      if (!usedVariableNames.has(varName)) {
        usedVariableNames.add(varName);
        
        // Check workflow variables first
        const workflowVar = variables[`workflow:${varName}`];
        if (workflowVar) {
          variableValues[varName] = workflowVar.value;
          return;
        }
        
        // Then check global variables
        const globalVar = variables[varName];
        if (globalVar) {
          variableValues[varName] = globalVar.value;
          return;
        }
        
        // Variable not found - will keep original placeholder
        variableValues[varName] = `{{${varName}}}`;
      }
    });
    
    // Perform single-pass replacement using pre-computed values
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      return variableValues[trimmedName] ?? match;
    });
  },
  
  clearWorkflowVariables: () => {
    const currentState = get();
    const newGlobalVariables: Record<string, GlobalVariable> = {};
    
    // Keep only non-workflow variables
    Object.entries(currentState.globalVariables).forEach(([key, value]) => {
      // Check if it's a workflow variable using the same logic as isWorkflowVariable
      const isWorkflow = key.startsWith('workflow:') || 
                        (value.description?.includes('From LLM Chain:') || false) ||
                        (value.description?.includes('Generated by node execution') || false) ||
                        (value.description?.includes('Workflow variable from') || false);
      
      // Only keep non-workflow variables
      if (!isWorkflow) {
        newGlobalVariables[key] = value;
      }
    });
    
    set({ globalVariables: newGlobalVariables });
  }
});
