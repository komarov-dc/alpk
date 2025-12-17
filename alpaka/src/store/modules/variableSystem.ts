import { Node } from '@xyflow/react';
import { ExecutionResult } from '@/types';

// Variable context building
export function buildVariableContext(
  nodes: Node[], 
  executionResults: Record<string, ExecutionResult>,
  globalVariables: Record<string, { name: string; value: string; description?: string }>
): Record<string, string> {
  const context: Record<string, string> = {};
  
  
  // Add global variables
  Object.values(globalVariables).forEach(variable => {
    context[variable.name] = variable.value;
  });
  
  // Add variables from executed nodes - support ALL node types
  nodes.forEach(node => {
    const result = executionResults[node.id];
    if (result?.success && result.output) {
      // Use node.type instead of node.data.type for consistency
      const nodeType = node.type || node.data?.type;
      const nodeLabel = (node.data?.label as string) || node.id;
      const output = result.output as Record<string, unknown>;
      
      let variableValue = '';
      let variableName = '';

      switch (nodeType) {
        case 'basicLLMChain':
          variableName = nodeLabel || `Basic LLM Chain`;
          variableValue = String(output.response || output.text || '');
          break;

        // Non-executable nodes (don't create variables)
        case 'modelProvider':
        case 'trigger':
        case 'note':
        case 'outputSender':
          // These nodes don't produce output variables - skip processing
          variableName = '';
          variableValue = '';
          break;

        default:
          // Generic fallback for unknown node types
          variableName = nodeLabel || `${nodeType}_${node.id.slice(-4)}`;
          variableValue = String(output.text || output.response || output.value || output.result || '');
          break;
      }
      
      // Add variable to context if it has a value
      if (variableValue && variableName) {
        context[variableName] = variableValue;
      }
    }
  });
  
  return context;
}

// Get available variables (for UI dropdowns)
export function getAvailableVariables(
  nodes: Node[], 
  executionResults: Record<string, ExecutionResult>,
  globalVariables: Record<string, { name: string; value: string; description?: string }>
): Record<string, string> {
  return buildVariableContext(nodes, executionResults, globalVariables);
}

// Get node variable schema (for pre-execution planning)
export function getNodeVariableSchema(
  nodeId: string, 
  nodes: Node[]
): Array<{name: string, type: string, hasValue: boolean}> {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];
  
  const schema: Array<{name: string, type: string, hasValue: boolean}> = [];
  const nodeType = node.type || node.data?.type;
  const nodeLabel = (node.data?.label as string) || node.id;
  
  switch (nodeType) {
    case 'basicLLMChain':
      schema.push({
        name: nodeLabel || `Basic LLM Chain`,
        type: 'string',
        hasValue: false // LLM nodes don't have values until execution
      });
      break;

    // Non-executable nodes don't create variables
    case 'modelProvider':
    case 'trigger':
    case 'note':
    case 'outputSender':
      // These nodes don't produce output variables
      break;

    default:
      // Generic fallback for unknown node types
      schema.push({
        name: nodeLabel || `${nodeType}_${nodeId.slice(-4)}`,
        type: 'unknown',
        hasValue: false
      });
      break;
  }
  
  return schema;
}

// Build extended variable context (includes potential variables)
export function buildExtendedVariableContext(
  nodes: Node[], 
  executionResults: Record<string, ExecutionResult>,
  globalVariables: Record<string, { name: string; value: string; description?: string }>
): Array<{name: string, type: string, hasValue: boolean, value?: string}> {
  const context = buildVariableContext(nodes, executionResults, globalVariables);
  const extended: Array<{name: string, type: string, hasValue: boolean, value?: string}> = [];
  
  // Add global variables
  Object.values(globalVariables).forEach(variable => {
    extended.push({
      name: variable.name,
      type: 'string',
      hasValue: true,
      value: variable.value
    });
  });
  
  // Add variables from all nodes (including potential ones)
  nodes.forEach(node => {
    const schema = getNodeVariableSchema(node.id, nodes);
    schema.forEach(schemaItem => {
      const hasValue = context[schemaItem.name] !== undefined;
      extended.push({
        name: schemaItem.name,
        type: schemaItem.type,
        hasValue,
        value: hasValue ? context[schemaItem.name] : undefined
      });
    });
  });
  
  return extended;
}
