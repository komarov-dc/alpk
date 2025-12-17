import { StateCreator } from "zustand";
import { Node, Edge } from "@xyflow/react";
import { StoreState } from "./types";
import { historyManager } from "../modules/historyManager";

export interface SelectionSlice {
  // State
  selectedNodes: string[];
  clipboard: { nodes: Node[]; edges: Edge[] };

  // Actions
  setSelectedNodes: (nodeIds: string[]) => void;
  selectAllNodes: () => void;
  deleteSelectedNodes: () => void;
  duplicateNodes: (nodeIds: string[]) => void;
  copyNodes: (nodeIds: string[]) => void;
  pasteNodes: () => void;
}

export const createSelectionSlice: StateCreator<
  StoreState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  // Initial state
  selectedNodes: [],
  clipboard: { nodes: [], edges: [] },

  // Actions
  setSelectedNodes: (nodeIds: string[]) => {
    const currentState = get();

    // Only save to history if selection actually changed
    if (
      JSON.stringify(currentState.selectedNodes) !== JSON.stringify(nodeIds)
    ) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes,
      });

      set({
        selectedNodes: nodeIds,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
      });
    }
  },

  selectAllNodes: () => {
    const currentState = get();
    const allNodeIds = currentState.nodes.map((n) => n.id);

    // Only save to history if selection actually changed
    if (
      JSON.stringify(currentState.selectedNodes) !== JSON.stringify(allNodeIds)
    ) {
      historyManager.saveToHistory({
        nodes: currentState.nodes,
        edges: currentState.edges,
        selectedNodes: currentState.selectedNodes,
      });

      set({
        selectedNodes: allNodeIds,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
      });
    }
  },

  deleteSelectedNodes: () => {
    const currentState = get();
    const { selectedNodes, nodes, edges } = currentState;

    if (selectedNodes.length === 0) return;

    // Filter out protected nodes from deletion
    const protectedNodeIds = nodes
      .filter((node) => selectedNodes.includes(node.id) && node.data?.protected)
      .map((node) => node.id);

    const nodesToDelete = selectedNodes.filter(
      (id) => !protectedNodeIds.includes(id),
    );

    // Log warning if some nodes were protected
    if (protectedNodeIds.length > 0) {
      const protectedNames = nodes
        .filter((n) => protectedNodeIds.includes(n.id))
        .map((n) => n.data?.label || n.id)
        .join(", ");
      console.warn(`Cannot delete protected nodes: ${protectedNames}`);
    }

    // If no nodes to delete after filtering, return
    if (nodesToDelete.length === 0) return;

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    // Filter out selected nodes (excluding protected)
    const newNodes = nodes.filter((node) => !nodesToDelete.includes(node.id));

    // Filter out edges connected to deleted nodes
    const newEdges = edges.filter(
      (edge) =>
        !nodesToDelete.includes(edge.source) &&
        !nodesToDelete.includes(edge.target),
    );

    set({
      nodes: newNodes,
      edges: newEdges,
      selectedNodes: protectedNodeIds, // Keep protected nodes selected
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  duplicateNodes: (nodeIds: string[]) => {
    const currentState = get();
    const { nodes, edges } = currentState;

    if (nodeIds.length === 0) return;

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    // Create mapping of old IDs to new IDs
    const idMapping: Record<string, string> = {};
    const newNodes: Node[] = [];

    // Duplicate selected nodes
    nodeIds.forEach((nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const newId = `${node.id}_copy_${Date.now()}`;
      idMapping[nodeId] = newId;

      newNodes.push({
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
      });
    });

    // Duplicate edges between selected nodes
    const newEdges: Edge[] = [];
    edges.forEach((edge) => {
      const newSource = idMapping[edge.source];
      const newTarget = idMapping[edge.target];

      if (newSource && newTarget) {
        newEdges.push({
          ...edge,
          id: `${edge.id}_copy_${Date.now()}`,
          source: newSource,
          target: newTarget,
        });
      }
    });

    set({
      nodes: [...nodes, ...newNodes],
      edges: [...edges, ...newEdges],
      selectedNodes: newNodes.map((n) => n.id),
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },

  copyNodes: (nodeIds: string[]) => {
    const { nodes, edges } = get();

    if (nodeIds.length === 0) return;

    // Filter nodes to copy
    const nodesToCopy = nodes.filter((node) => nodeIds.includes(node.id));

    // Filter edges between copied nodes
    const edgesToCopy = edges.filter(
      (edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target),
    );

    set({
      clipboard: {
        nodes: nodesToCopy,
        edges: edgesToCopy,
      },
    });
  },

  pasteNodes: () => {
    const currentState = get();
    const { clipboard, nodes, edges } = currentState;

    if (clipboard.nodes.length === 0) return;

    // Save current state to history
    historyManager.saveToHistory({
      nodes: currentState.nodes,
      edges: currentState.edges,
      selectedNodes: currentState.selectedNodes,
    });

    // Create mapping of old IDs to new IDs
    const idMapping: Record<string, string> = {};
    const newNodes: Node[] = [];

    // Find the center of copied nodes
    const centerX =
      clipboard.nodes.reduce((sum, node) => sum + node.position.x, 0) /
      clipboard.nodes.length;
    const centerY =
      clipboard.nodes.reduce((sum, node) => sum + node.position.y, 0) /
      clipboard.nodes.length;

    // Paste nodes with offset from center
    clipboard.nodes.forEach((node) => {
      const newId = `${node.id}_paste_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMapping[node.id] = newId;

      newNodes.push({
        ...node,
        id: newId,
        position: {
          x: node.position.x - centerX + 400, // Paste at a visible position
          y: node.position.y - centerY + 300,
        },
        selected: true,
      });
    });

    // Paste edges with new IDs
    const newEdges: Edge[] = [];
    clipboard.edges.forEach((edge) => {
      const newSource = idMapping[edge.source];
      const newTarget = idMapping[edge.target];

      if (newSource && newTarget) {
        newEdges.push({
          ...edge,
          id: `${edge.id}_paste_${Date.now()}`,
          source: newSource,
          target: newTarget,
        });
      }
    });

    set({
      nodes: [...nodes, ...newNodes],
      edges: [...edges, ...newEdges],
      selectedNodes: newNodes.map((n) => n.id),
      canUndo: historyManager.canUndo(),
      canRedo: historyManager.canRedo(),
    });
  },
});
