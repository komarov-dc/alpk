import { Node, Edge } from '@xyflow/react';
import { UnifiedNodeData } from '@/types';
import { getUniqueNodeName } from '@/utils/nodeNameGenerator';
import {
  createBasicLLMChainNode,
  createModelProviderNode,
  createNoteNode,
  createTriggerNode,
  createOutputSenderNode
} from './nodeFactories';

export interface NodeOperationsState {
  selectedNodes: string[];
  clipboard: { nodes: Node[]; edges: Edge[] };
}

export interface NodeOperationsActions {
  addNode: (type: string, position: { x: number; y: number }, nodes: Node[]) => Node;
  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>, nodes: Node[]) => Node[];
  deleteNode: (nodeId: string, nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };
  renameNode: (nodeId: string, newName: string, nodes: Node[]) => Node[];
  duplicateNodes: (nodeIds: string[], nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };
  copyNodes: (nodeIds: string[], nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };
  pasteNodes: (nodes: Node[], edges: Edge[], clipboard: { nodes: Node[]; edges: Edge[] }) => { nodes: Node[]; edges: Edge[] };
  deleteSelectedNodes: (selectedNodeIds: string[], nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };
  selectAllNodes: (nodes: Node[]) => string[];
  addNodeAtPosition: (type: string, position: { x: number; y: number }, nodes: Node[]) => Node;
  addNoteNode: (position: { x: number; y: number }, text: string | undefined, nodes: Node[]) => Node;
}

// Node operations implementations
export const nodeOperations: NodeOperationsActions = {
  addNode: (type: string, position: { x: number; y: number }, nodes: Node[]) => {
    const id = crypto.randomUUID();
    
    switch (type) {
      case 'basicLLMChain':
        return createBasicLLMChainNode(id, position, nodes);
      case 'modelProvider':
        return createModelProviderNode(id, position, nodes);
      case 'note':
        return createNoteNode(id, position, nodes);
      case 'trigger':
        return createTriggerNode(id, position, nodes);
      case 'outputSender':
        return createOutputSenderNode(id, position, nodes);
      default:
        return createNoteNode(id, position, nodes);
    }
  },

  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>, nodes: Node[]) => {
    return nodes.map(node => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, ...data } }
        : node
    );
  },

  deleteNode: (nodeId: string, nodes: Node[], edges: Edge[]) => {
    const newNodes = nodes.filter(node => node.id !== nodeId);
    const newEdges = edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
    return { nodes: newNodes, edges: newEdges };
  },

  renameNode: (nodeId: string, newName: string, nodes: Node[]) => {
    return nodes.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, label: newName } }
        : node
    );
  },

  duplicateNodes: (nodeIds: string[], nodes: Node[], edges: Edge[]) => {
    const nodesToDuplicate = nodes.filter(node => nodeIds.includes(node.id));
    const newNodes = [...nodes];
    const newEdges = [...edges];
    const nodeIdMap: Record<string, string> = {};

    // Create duplicated nodes
    nodesToDuplicate.forEach(node => {
      const newId = crypto.randomUUID();
      nodeIdMap[node.id] = newId;
      
      const originalLabel = String(node.data?.label || 'Node');
      const uniqueLabel = getUniqueNodeName(originalLabel, newNodes);
      
      const duplicatedNode = {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50
        },
        data: {
          ...node.data,
          id: newId,
          label: uniqueLabel
        }
      };
      
      newNodes.push(duplicatedNode);
    });

    // Create duplicated edges between duplicated nodes
    const edgesToDuplicate = edges.filter(edge => 
      nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );

    edgesToDuplicate.forEach(edge => {
      const newSource = nodeIdMap[edge.source];
      const newTarget = nodeIdMap[edge.target];
      
      if (newSource && newTarget) {
        const newEdge = {
          ...edge,
          id: crypto.randomUUID(),
          source: newSource,
          target: newTarget
        };
        newEdges.push(newEdge);
      }
    });

    return { nodes: newNodes, edges: newEdges };
  },

  copyNodes: (nodeIds: string[], nodes: Node[], edges: Edge[]) => {
    const nodesToCopy = nodes.filter(node => nodeIds.includes(node.id));
    const edgesToCopy = edges.filter(edge => 
      nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );
    
    return { nodes: nodesToCopy, edges: edgesToCopy };
  },

  pasteNodes: (nodes: Node[], edges: Edge[], clipboard: { nodes: Node[]; edges: Edge[] }) => {
    if (clipboard.nodes.length === 0) return { nodes, edges };

    const newNodes = [...nodes];
    const newEdges = [...edges];
    const nodeIdMap: Record<string, string> = {};

    // Create new nodes from clipboard
    clipboard.nodes.forEach(node => {
      const newId = crypto.randomUUID();
      nodeIdMap[node.id] = newId;
      
      const originalLabel = String(node.data?.label || 'Node');
      const uniqueLabel = getUniqueNodeName(originalLabel, newNodes);
      
      const pastedNode = {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 100,
          y: node.position.y + 100
        },
        data: {
          ...node.data,
          id: newId,
          label: uniqueLabel
        }
      };
      
      newNodes.push(pastedNode);
    });

    // Create new edges from clipboard
    clipboard.edges.forEach(edge => {
      const newSource = nodeIdMap[edge.source];
      const newTarget = nodeIdMap[edge.target];
      
      if (newSource && newTarget) {
        const pastedEdge = {
          ...edge,
          id: crypto.randomUUID(),
          source: newSource,
          target: newTarget
        };
        newEdges.push(pastedEdge);
      }
    });

    return { nodes: newNodes, edges: newEdges };
  },

  deleteSelectedNodes: (selectedNodeIds: string[], nodes: Node[], edges: Edge[]) => {
    const newNodes = nodes.filter(node => !selectedNodeIds.includes(node.id));
    const newEdges = edges.filter(edge => 
      !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
    );
    return { nodes: newNodes, edges: newEdges };
  },

  selectAllNodes: (nodes: Node[]) => {
    return nodes.map(node => node.id);
  },

  addNodeAtPosition: (type: string, position: { x: number; y: number }, nodes: Node[]) => {
    return nodeOperations.addNode(type, position, nodes);
  },

  addNoteNode: (position: { x: number; y: number }, text: string | undefined, nodes: Node[]) => {
    const id = crypto.randomUUID();
    return createNoteNode(id, position, nodes, text);
  }
};


