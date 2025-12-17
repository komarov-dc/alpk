import { Node, Edge, NodeChange, EdgeChange, Connection, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { createEdgeColorMap, getVariableColor } from '@/utils/colorUtils';

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  edgeColors: Record<string, string>;
  cursorMode: 'grab' | 'selection';
  selectedNodes: string[];
  clipboard: { nodes: Node[]; edges: Edge[] };
}

export interface CanvasActions {
  setNodes: (nodes: Node[]) => Node[];
  setEdges: (edges: Edge[]) => Edge[];
  onNodesChange: (changes: NodeChange[], currentNodes: Node[]) => Node[];
  onEdgesChange: (changes: EdgeChange[], currentEdges: Edge[]) => Edge[];
  onConnect: (connection: Connection, currentEdges: Edge[], executeNode: (nodeId: string) => Promise<void>, updateEdgeColors: () => void, nodes: Node[]) => Promise<Edge[]>;
  setCursorMode: (mode: 'grab' | 'selection') => 'grab' | 'selection';
  setSelectedNodes: (nodeIds: string[]) => string[];
  clearAllEdges: () => Edge[];
}

// Canvas action implementations
export const canvasActions: CanvasActions = {
  setNodes: (nodes: Node[]) => nodes,
  
  setEdges: (edges: Edge[]) => edges,
  
  onNodesChange: (changes: NodeChange[], currentNodes: Node[]) => {
    return applyNodeChanges(changes, currentNodes);
  },
  
  onEdgesChange: (changes: EdgeChange[], currentEdges: Edge[]) => {
    return applyEdgeChanges(changes, currentEdges);
  },
  
  onConnect: async (
    connection: Connection, 
    currentEdges: Edge[],
    executeNode: (nodeId: string) => Promise<void>, 
    updateEdgeColors: () => void,
    nodes: Node[]
  ) => {
    const newEdges = addEdge(connection, currentEdges);
    
    // Update edge colors after connection
    updateEdgeColors();
    
    // Auto-execute Input nodes when connected
    if (connection.source) {
      const sourceNode = nodes.find(n => n.id === connection.source);
      if (sourceNode?.type === 'input' || sourceNode?.data?.type === 'input') {
        // Always execute Input node when connected to update result
        await executeNode(connection.source);
      }
    }
    
    return newEdges;
  },
  
  setCursorMode: (mode: 'grab' | 'selection') => mode,
  
  setSelectedNodes: (nodeIds: string[]) => nodeIds,
  
  clearAllEdges: () => []
};

// Canvas state helpers
export function updateEdgeColors(
  _nodes: Node[], 
  edges: Edge[], 
  _executionResults: Record<string, unknown>
): Record<string, string> {
  void _nodes; // Mark as intentionally unused
  void _executionResults;
  return createEdgeColorMap(edges);
}

export function getEdgeColor(edgeId: string, edgeColors: Record<string, string>): string {
  return edgeColors[edgeId] || '#b1b1b7';
}

export function getVariableColorForNodes(
  sourceNodeId: string, 
  targetNodeId: string, 
  _nodes: Node[], 
  _executionResults: Record<string, unknown>
): string {
  void _nodes; // Mark as intentionally unused
  void _executionResults;
  return getVariableColor(sourceNodeId, targetNodeId);
}
