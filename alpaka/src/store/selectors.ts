import { FlowStore } from './useFlowStore';
import { Node, Edge } from '@xyflow/react';

// ============================================
// Node Selectors
// ============================================

// Get a single node by ID - prevents re-renders when other nodes change
export const selectNode = (nodeId: string) => (state: FlowStore): Node | undefined => {
  return state.nodes.find(n => n.id === nodeId);
};

// Get multiple nodes by IDs
export const selectNodes = (nodeIds: string[]) => (state: FlowStore): Node[] => {
  const idSet = new Set(nodeIds);
  return state.nodes.filter(n => idSet.has(n.id));
};

// Get nodes by type
export const selectNodesByType = (type: string) => (state: FlowStore): Node[] => {
  return state.nodes.filter(n => n.type === type);
};

// Get only the node count (useful for UI indicators)
export const selectNodesCount = (state: FlowStore): number => state.nodes.length;

// Get node position (useful for connection lines)
export const selectNodePosition = (nodeId: string) => (state: FlowStore) => {
  const node = state.nodes.find(n => n.id === nodeId);
  return node?.position;
};

// ============================================
// Edge Selectors
// ============================================

// Get edges connected to a specific node
export const selectNodeEdges = (nodeId: string) => (state: FlowStore): Edge[] => {
  return state.edges.filter(e => e.source === nodeId || e.target === nodeId);
};

// Get incoming edges for a node
export const selectIncomingEdges = (nodeId: string) => (state: FlowStore): Edge[] => {
  return state.edges.filter(e => e.target === nodeId);
};

// Get outgoing edges for a node
export const selectOutgoingEdges = (nodeId: string) => (state: FlowStore): Edge[] => {
  return state.edges.filter(e => e.source === nodeId);
};

// Get connected node IDs
export const selectConnectedNodeIds = (nodeId: string) => (state: FlowStore): string[] => {
  const edges = state.edges.filter(e => e.source === nodeId || e.target === nodeId);
  const connectedIds = new Set<string>();
  
  edges.forEach(edge => {
    if (edge.source === nodeId) connectedIds.add(edge.target);
    if (edge.target === nodeId) connectedIds.add(edge.source);
  });
  
  return Array.from(connectedIds);
};

// ============================================
// Execution Selectors
// ============================================

// Get execution result for a specific node
export const selectNodeExecutionResult = (nodeId: string) => (state: FlowStore) => {
  return state.executionResults[nodeId];
};

// Check if flow is currently executing
export const selectIsExecuting = (state: FlowStore): boolean => {
  return state.isExecuting;
};

// Get node queue status from node data
export const selectNodeQueueStatus = (nodeId: string) => (state: FlowStore) => {
  const node = state.nodes.find(n => n.id === nodeId);
  return node?.data?.queueStatus;
};

// Get all nodes with queue status
export const selectNodesWithQueueStatus = (status: string) => (state: FlowStore): Node[] => {
  return state.nodes.filter(n => n.data?.queueStatus === status);
};

// Get executing node IDs (based on node data)
export const selectExecutingNodeIds = (state: FlowStore): string[] => {
  return state.nodes
    .filter(n => n.data?.queueStatus === 'executing')
    .map(n => n.id);
};

// Get queued node IDs (based on node data)
export const selectQueuedNodeIds = (state: FlowStore): string[] => {
  return state.nodes
    .filter(n => n.data?.queueStatus === 'queued')
    .map(n => n.id);
};

// ============================================
// Variable Selectors
// ============================================

// Get global variables (memoized by reference)
export const selectGlobalVariables = (state: FlowStore) => state.globalVariables;

// Get a specific global variable
export const selectGlobalVariable = (key: string) => (state: FlowStore) => {
  return state.globalVariables[key];
};

// Get available variables for a node (includes upstream outputs)
export const selectNodeAvailableVariables = (nodeId: string) => (state: FlowStore) => {
  // This is complex - get all upstream nodes' outputs
  const visited = new Set<string>();
  const variables: Record<string, string> = {};
  
  // Add global variables
  Object.entries(state.globalVariables).forEach(([key, variable]) => {
    variables[key] = typeof variable === 'object' && 'value' in variable 
      ? String(variable.value) 
      : String(variable);
  });
  
  const collectUpstreamVariables = (targetId: string) => {
    if (visited.has(targetId)) return;
    visited.add(targetId);
    
    const incomingEdges = state.edges.filter(e => e.target === targetId);
    
    for (const edge of incomingEdges) {
      const sourceNode = state.nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        // Add output from this node if it has been executed
        const result = state.executionResults[edge.source];
        if (result?.output) {
          variables[`output_${edge.source}`] = String(result.output);
        }
        
        // Recursively collect from upstream
        collectUpstreamVariables(edge.source);
      }
    }
  };
  
  collectUpstreamVariables(nodeId);
  return variables;
};

// ============================================
// Selection Selectors
// ============================================

// Get selected nodes
export const selectSelectedNodes = (state: FlowStore) => state.selectedNodes;

// Check if a specific node is selected
export const selectIsNodeSelected = (nodeId: string) => (state: FlowStore): boolean => {
  return state.selectedNodes.includes(nodeId);
};



// ============================================
// Project Selectors
// ============================================

// Get current project
export const selectCurrentProject = (state: FlowStore) => state.currentProject;

// Get project metadata
export const selectProject = (state: FlowStore) => ({
  id: state.currentProject?.id,
  name: state.currentProject?.name,
  description: state.currentProject?.description
});

// ============================================
// History Selectors
// ============================================

// Get undo/redo availability - separate selectors for stability
export const selectCanUndo = (state: FlowStore) => state.canUndo;
export const selectCanRedo = (state: FlowStore) => state.canRedo;

// Composite selector (avoid using this in components - use individual selectors instead)
export const selectHistoryStatus = (state: FlowStore) => ({
  canUndo: state.canUndo,
  canRedo: state.canRedo
});

// ============================================
// Composite Selectors (Complex Derived State)
// ============================================

// Get execution statistics based on node queue status
export const selectExecutionStats = (state: FlowStore) => {
  const stats = {
    total: state.nodes.length,
    completed: 0,
    failed: 0,
    executing: 0,
    queued: 0,
    waiting: 0,
    idle: 0
  };
  
  state.nodes.forEach(node => {
    const status = node.data?.queueStatus;
    switch (status) {
      case 'completed': stats.completed++; break;
      case 'failed': stats.failed++; break;
      case 'executing': stats.executing++; break;
      case 'queued': stats.queued++; break;
      case 'waiting': stats.waiting++; break;
      default: stats.idle++; break;
    }
  });
  
  return stats;
};

// Get nodes in topological order (for execution)
export const selectNodesInExecutionOrder = (state: FlowStore): Node[] => {
  const { nodes, edges } = state;
  const sorted: Node[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  const visit = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return true;
    if (visiting.has(nodeId)) return false; // Cycle detected
    
    visiting.add(nodeId);
    
    // Visit all dependencies first
    const incomingEdges = edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      if (!visit(edge.source)) return false;
    }
    
    visiting.delete(nodeId);
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) sorted.push(node);
    
    return true;
  };
  
  // Start with nodes that have no incoming edges
  const nodeIds = nodes.map(n => n.id);
  const hasIncoming = new Set(edges.map(e => e.target));
  const startNodes = nodeIds.filter(id => !hasIncoming.has(id));
  
  for (const nodeId of startNodes) {
    visit(nodeId);
  }
  
  // Visit any remaining nodes (disconnected components)
  for (const node of nodes) {
    visit(node.id);
  }
  
  return sorted;
};

// Check if the graph has cycles
export const selectHasCycles = (state: FlowStore): boolean => {
  const { nodes, edges } = state;
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  const hasCycle = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return false;
    if (visiting.has(nodeId)) return true;
    
    visiting.add(nodeId);
    
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) return true;
    }
    
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  
  for (const node of nodes) {
    if (hasCycle(node.id)) return true;
  }
  
  return false;
};

// Get nodes that can be executed (all dependencies satisfied)
export const selectExecutableNodes = (state: FlowStore): string[] => {
  const { nodes, edges, executionResults } = state;
  const executable: string[] = [];
  
  for (const node of nodes) {
    // Skip if already executed or running
    const status = node.data?.queueStatus;
    if (status === 'completed' || status === 'executing' || status === 'queued' || status === 'waiting') {
      continue;
    }
    
    // Check if all dependencies are satisfied
    const incomingEdges = edges.filter(e => e.target === node.id);
    const allDependenciesSatisfied = incomingEdges.every(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const sourceStatus = sourceNode?.data?.queueStatus;
      return sourceStatus === 'completed' && executionResults[edge.source];
    });
    
    if (allDependenciesSatisfied) {
      executable.push(node.id);
    }
  }
  
  return executable;
};
