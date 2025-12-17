/**
 * Strategy pattern for extracting output from different node types
 * Replaces the huge switch-case statement in the monolithic store
 */

type OutputExtractor = (output: Record<string, unknown>) => string;

export const nodeOutputExtractors: Record<string, OutputExtractor> = {
  basicLLMChain: (output) => String(output.response || output.text || ''),

  // Configuration nodes that don't produce output
  modelProvider: () => '',
  trigger: () => '',
  note: () => '',
  outputSender: () => '',
};

/**
 * Extract variable value from node execution result
 * @param nodeType - Type of the node
 * @param output - Execution output
 * @returns Extracted string value
 */
export function extractNodeOutput(nodeType: string, output: unknown): string {
  // Ensure output is an object
  if (!output || typeof output !== 'object') {
    return '';
  }
  
  const outputObj = output as Record<string, unknown>;
  const extractor = nodeOutputExtractors[nodeType];
  
  if (!extractor) {
    // Default fallback for unknown node types
    return String(outputObj.text || outputObj.response || outputObj.value || outputObj.result || '');
  }
  
  return extractor(outputObj);
}

/**
 * Check if node type produces output variables
 * @param nodeType - Type of the node
 * @returns true if node produces output
 */
export function nodeProducesOutput(nodeType: string): boolean {
  const nonOutputTypes = ['modelProvider', 'trigger', 'note', 'outputSender'];
  return !nonOutputTypes.includes(nodeType);
}
