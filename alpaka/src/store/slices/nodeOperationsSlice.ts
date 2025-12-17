import { StateCreator } from "zustand";
import { StoreState } from "./types";
import { UnifiedNodeData } from "@/types";
import { historyManager } from "../modules/historyManager";
import { nodeOperations } from "../modules/nodeOperations";

export interface NodeOperationsSlice {
  // Actions for node operations
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
  addNodeAtPosition: (type: string, position: { x: number; y: number }) => void;
  addNoteNode: (position: { x: number; y: number }, text?: string) => void;
  hideSelectedNodes: (nodeIds: string[]) => void;
  showAllNodes: () => void;
}

export const createNodeOperationsSlice: StateCreator<
  StoreState,
  [],
  [],
  NodeOperationsSlice
> = (set, get) => ({
  // Add a new node
  addNode: (type: string, position: { x: number; y: number }) => {
    const currentState = get();

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    const newNode = nodeOperations.addNode(type, position, currentState.nodes);

    set({
      nodes: [...currentState.nodes, newNode],
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  // Update node data
  updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>) => {
    const currentState = get();
    const updatedNodes = nodeOperations.updateNodeData(
      nodeId,
      data,
      currentState.nodes,
    );

    // Only update if nodes actually changed
    if (updatedNodes !== currentState.nodes) {
      set({ nodes: updatedNodes });
    }
  },

  // Delete a node
  deleteNode: (nodeId: string) => {
    const currentState = get();

    // Check if node is protected
    const nodeToDelete = currentState.nodes.find((n) => n.id === nodeId);
    if (nodeToDelete?.data?.protected) {
      console.warn(
        `Cannot delete protected node: ${nodeToDelete.data.label || nodeId}`,
      );
      return; // Silently refuse to delete protected nodes
    }

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    const result = nodeOperations.deleteNode(
      nodeId,
      currentState.nodes,
      currentState.edges,
    );

    // Remove from selected nodes if it was selected
    const newSelectedNodes = currentState.selectedNodes.filter(
      (id) => id !== nodeId,
    );

    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodes: newSelectedNodes,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  // Rename a node
  renameNode: (nodeId: string, newName: string) => {
    const currentState = get();

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    const updatedNodes = nodeOperations.renameNode(
      nodeId,
      newName,
      currentState.nodes,
    );

    set({
      nodes: updatedNodes,
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  // Add node at specific position
  addNodeAtPosition: (type: string, position: { x: number; y: number }) => {
    const currentState = get();

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    const newNode = nodeOperations.addNodeAtPosition(
      type,
      position,
      currentState.nodes,
    );

    set({
      nodes: [...currentState.nodes, newNode],
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  // Add note node
  addNoteNode: (position: { x: number; y: number }, text?: string) => {
    const currentState = get();

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    const newNode = nodeOperations.addNoteNode(
      position,
      text,
      currentState.nodes,
    );

    set({
      nodes: [...currentState.nodes, newNode],
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  // Hide selected nodes (for grouping)
  hideSelectedNodes: (nodeIds: string[]) => {
    const currentState = get();

    const updatedNodes = currentState.nodes.map((node) => {
      if (nodeIds.includes(node.id)) {
        return { ...node, hidden: true };
      }
      return node;
    });

    const updatedEdges = currentState.edges.map((edge) => {
      if (nodeIds.includes(edge.source) || nodeIds.includes(edge.target)) {
        return { ...edge, hidden: true };
      }
      return edge;
    });

    set({
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  },

  // Show all hidden nodes
  showAllNodes: () => {
    const currentState = get();

    const updatedNodes = currentState.nodes.map((node) => {
      if (node.hidden) {
        return { ...node, hidden: false };
      }
      return node;
    });

    const updatedEdges = currentState.edges.map((edge) => {
      if (edge.hidden) {
        return { ...edge, hidden: false };
      }
      return edge;
    });

    set({
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  },
});
