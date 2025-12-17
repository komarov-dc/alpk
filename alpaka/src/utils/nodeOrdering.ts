import { Node } from '@xyflow/react';

/**
 * Ensures correct node ordering for React Flow parent-child relationships.
 * Parent nodes must appear before their children in the array for proper rendering and interaction.
 * 
 * @param nodes - Array of React Flow nodes
 * @returns Properly ordered array of nodes
 */
export function ensureCorrectNodeOrder(nodes: Node[]): Node[] {
  // Create a map to track parent-child relationships
  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();
  const rootNodes: Node[] = [];

  // First pass: categorize nodes
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
    
    if (node.parentId) {
      // This is a child node
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, []);
      }
      childrenMap.get(node.parentId)!.push(node);
    } else {
      // This is a root node (no parent)
      rootNodes.push(node);
    }
  });

  // Recursive function to add node and its children in correct order
  const orderedNodes: Node[] = [];
  const addedNodes = new Set<string>();

  function addNodeWithChildren(node: Node) {
    // Avoid duplicates
    if (addedNodes.has(node.id)) {
      return;
    }

    // Add the parent node first
    orderedNodes.push(node);
    addedNodes.add(node.id);

    // Then add all its children
    const children = childrenMap.get(node.id);
    if (children) {
      // Sort children to maintain consistent ordering
      children.sort((a, b) => a.id.localeCompare(b.id));
      
      children.forEach(child => {
        addNodeWithChildren(child);
      });
    }
  }

  // Process all root nodes first (these include group nodes)
  // Sort root nodes to maintain consistent ordering
  rootNodes.sort((a, b) => {
    // Groups (groupBackground type) should come before other nodes at the same level
    if (a.type === 'groupBackground' && b.type !== 'groupBackground') return -1;
    if (a.type !== 'groupBackground' && b.type === 'groupBackground') return 1;
    return a.id.localeCompare(b.id);
  });

  rootNodes.forEach(node => {
    addNodeWithChildren(node);
  });

  // Safety check: if we somehow missed any nodes, add them at the end
  // This shouldn't happen with correct parent-child relationships
  nodes.forEach(node => {
    if (!addedNodes.has(node.id)) {
      console.warn(`Node ${node.id} was not properly ordered. Adding at the end.`);
      orderedNodes.push(node);
    }
  });

  return orderedNodes;
}

/**
 * Validates that all parent-child relationships are correctly set up
 * @param nodes - Array of React Flow nodes
 * @returns true if all relationships are valid
 */
export function validateNodeRelationships(nodes: Node[]): boolean {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  for (const node of nodes) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      console.error(`Node ${node.id} references non-existent parent ${node.parentId}`);
      return false;
    }
  }
  
  return true;
}