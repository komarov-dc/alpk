/**
 * Node Name Generator Utility
 * Ensures unique node names to prevent variable conflicts
 */

import { Node } from '@xyflow/react';

/**
 * Generates a unique node name by adding a number suffix if needed
 * @param baseName - The base name for the node
 * @param existingNodes - Array of existing nodes to check against
 * @returns A unique node name
 */
export function getUniqueNodeName(baseName: string, existingNodes: Node[]): string {
  const existingNames = existingNodes
    .map(n => String(n.data?.label || ''))
    .filter(Boolean);
  
  // Check if baseName already exists
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  // Extract base name without existing numbers or "Copy" suffix
  const cleanBaseName = baseName
    .replace(/ Copy \d+$/, '')     // Remove " Copy 2", " Copy 3", etc.
    .replace(/ Copy$/, '')          // Remove " Copy"
    .replace(/ \(\d+\)$/, '');      // Remove " (2)", " (3)", etc.
  
  // Find the highest number suffix
  let counter = 2; // Start with 2 for the first duplicate
  
  // Create a regex to match variations of the name
  const escapedBaseName = cleanBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedBaseName}( \\((\\d+)\\))?$`);
  
  existingNames.forEach(name => {
    const match = name.match(regex);
    if (match) {
      if (match[2]) {
        // Has a number suffix
        counter = Math.max(counter, parseInt(match[2]) + 1);
      } else if (name === cleanBaseName) {
        // Exact match without suffix, ensure counter is at least 2
        counter = Math.max(counter, 2);
      }
    }
  });
  
  return `${cleanBaseName} (${counter})`;
}

/**
 * Generates unique names for multiple nodes at once
 * @param nodeNames - Array of base names
 * @param existingNodes - Array of existing nodes to check against
 * @returns Array of unique node names
 */
export function getUniqueNodeNames(
  nodeNames: string[], 
  existingNodes: Node[]
): string[] {
  const allNodes = [...existingNodes];
  const uniqueNames: string[] = [];
  
  nodeNames.forEach(name => {
    const uniqueName = getUniqueNodeName(name, allNodes);
    uniqueNames.push(uniqueName);
    
    // Add a temporary node to prevent duplicate names within the batch
    allNodes.push({
      id: `temp-${crypto.randomUUID()}`,
      type: 'temp',
      position: { x: 0, y: 0 },
      data: { label: uniqueName }
    } as Node);
  });
  
  return uniqueNames;
}

/**
 * Checks if a node name would create a variable conflict
 * @param nodeName - The name to check
 * @param existingNodes - Array of existing nodes
 * @returns true if there would be a conflict
 */
export function hasNodeNameConflict(nodeName: string, existingNodes: Node[]): boolean {
  const existingNames = existingNodes
    .map(n => String(n.data?.label || ''))
    .filter(Boolean);
  return existingNames.includes(nodeName);
}

/**
 * Suggests a unique name for a node based on its type
 * @param nodeType - The type of node
 * @param existingNodes - Array of existing nodes
 * @returns A suggested unique name
 */
export function suggestNodeName(nodeType: string, existingNodes: Node[]): string {
  const baseNames: Record<string, string> = {
    'basicLLMChain': 'Text Processor',
    'modelProvider': 'Model Provider',
    'input': 'Input',
    'output': 'Output',
    'code': 'Code',
    'note': 'Note',
    'trigger': 'Trigger',
    'branch': 'Branch',
    'variableAggregator': 'Variable Aggregator',
    'executionBarrier': 'Execution Barrier',
    'tools': 'Tools'
  };
  
  const baseName = baseNames[nodeType] || 'Node';
  return getUniqueNodeName(baseName, existingNodes);
}