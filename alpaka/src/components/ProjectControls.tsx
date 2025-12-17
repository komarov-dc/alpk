'use client';

import { useState } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { EditableProjectTitle } from './EditableProjectTitle';
import { ProjectManager } from './ProjectManager';
import { ExecutionDialog } from './ui/ExecutionDialog';
import { safeJsonParse } from '@/utils/safeJson';

interface ImportData {
  project?: {
    name?: string;
    description?: string;
  };
  canvas?: {
    nodes?: unknown[];
    edges?: unknown[];
  };
  executionResults?: unknown;
  metadata?: {
    variableCount?: number;
  };
}

export const ProjectControls = () => {
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const { 
    nodes, 
    edges,
    isExecuting,
    executeFlow,
    clearExecutionResults,
    saveProject,
    createNewProject,
    currentProject,
    executionResults,
    setNodes,
    setEdges,
    setExecutionResults,
  } = useFlowStore();

  // Функция для подсчета статистики выполнения
  const getExecutionStats = () => {
    const totalNodes = nodes.length;
    const completedNodes = Object.keys(executionResults).filter(
      nodeId => executionResults[nodeId]?.success
    ).length;
    
    return {
      totalNodes,
      completedNodes,
      remainingNodes: totalNodes - completedNodes,
      hasResults: completedNodes > 0
    };
  };

  const handleImport = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = safeJsonParse<ImportData>(text);
        
        if (!data) {
          throw new Error('Failed to parse workflow file');
        }
        
        // Validate the import data structure
        if (!data.canvas || !data.canvas.nodes || !data.canvas.edges) {
          throw new Error('Invalid workflow file format');
        }
        
        // Confirm before importing
        const confirmImport = window.confirm(
          `Import workflow "${data.project?.name || 'Unknown'}"?\n\n` +
          `This will replace your current canvas with:\n` +
          `• ${data.canvas.nodes.length} nodes\n` +
          `• ${data.canvas.edges.length} connections\n` +
          `• ${data.metadata?.variableCount || 0} variables`
        );
        
        if (!confirmImport) return;
        
        // Import the workflow
        setNodes(data.canvas.nodes as never[]);
        setEdges(data.canvas.edges as never[]);
        
        if (data.executionResults) {
          setExecutionResults(data.executionResults as never);
        }
        
        // Note: Global variables would need additional handling
        // as they're managed differently in the store
        
        alert(`Successfully imported: ${data.project?.name || 'workflow'}`);
        
      } catch {
        alert('Failed to import workflow. Please check the file format.');
      }
    };
    
    // Trigger file selection
    input.click();
  };

  const handleExport = () => {
    try {
      // Get global variables from store
      const globalVariables = useFlowStore.getState().globalVariables;
      
      // Define type for exported node data
      interface ExportedNodeData {
        order: number;
        nodeName: string;
        thinking: string[] | null;  // Array of lines for readability
        response: string[] | null;  // Array of lines for readability
        receivedVariables: string[];
        receivedVariableValues: Record<string, string[] | string>; // Array of lines or single string
        actualPrompt: string[] | null; // Array of lines for readability
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      }
      
      // Collect execution data from nodes
      const executedNodes: ExportedNodeData[] = [];
      let executionOrder = 0;
      
      // Get all nodes that have execution results
      nodes.forEach(node => {
        // Check if node has been executed (has lastResponse or execution data)
        if (node.data?.lastResponse || node.data?.executionStats || executionResults[node.id]) {
          // Extract variable names and values from messages
          const receivedVariables: string[] = [];
          const receivedVariableValues: Record<string, string[] | string> = {};
          let actualPrompt: string | null = null;

          if (node.data?.messages && Array.isArray(node.data.messages)) {
            // Build full prompt with variable substitution
            const promptParts: string[] = [];

            node.data.messages.forEach((msg: { role?: string; content?: string }) => {
              if (msg.content) {
                let renderedContent = msg.content;

                // Match pattern {{variable_name}} or {{variable_name (llm)}}
                const matches = msg.content.match(/{{([^}]+)}}/g);
                if (matches) {
                  matches.forEach(match => {
                    // Remove {{ }} and trim to get the exact variable name
                    const varName = match.replace(/{{|}}/g, '').trim();

                    if (!receivedVariables.includes(varName)) {
                      receivedVariables.push(varName);

                      // Get actual value from global variables
                      const varData = globalVariables[varName];
                      const varValue = typeof varData === 'string' ? varData : varData?.value || '[NOT FOUND]';

                      // Split into array if contains newlines, otherwise keep as string
                      if (varValue.includes('\n')) {
                        receivedVariableValues[varName] = varValue
                          .split('\n')
                          .map(line => line.trim())
                          .filter(line => line.length > 0);
                      } else {
                        receivedVariableValues[varName] = varValue;
                      }

                      // Substitute in prompt
                      renderedContent = renderedContent.replace(match, varValue);
                    }
                  });
                }

                promptParts.push(`[${msg.role || 'unknown'}]: ${renderedContent}`);
              }
            });

            actualPrompt = promptParts.join('\n\n');
          }
          
          // Helper function to process text for better readability
          // Returns array of lines for better readability in text editors
          const processText = (text: string | null | undefined): string[] | null => {
            if (!text) return null;

            // Convert to string if not already (handle objects, arrays, etc.)
            const textStr = typeof text === 'string' ? text : JSON.stringify(text);

            // Split by newlines and clean up each line
            return textStr
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)  // Remove empty lines
              .map(line => line.replace(/ {2,}/g, ' '));  // Collapse multiple spaces
          };
          
          // Compile node execution data
          executionOrder++;
          
          // Type guard for executionStats
          const stats = node.data?.executionStats as { 
            promptTokens?: number; 
            completionTokens?: number; 
            totalTokens?: number 
          } | undefined;
          
          const nodeData = {
            order: executionOrder,
            nodeName: (node.data?.label as string) || node.id,
            thinking: processText(node.data?.lastThinking as string | null | undefined),
            response: processText((node.data?.lastResponse || executionResults[node.id]?.output) as string | null | undefined),
            receivedVariables: receivedVariables,
            receivedVariableValues: receivedVariableValues, // NEW
            actualPrompt: processText(actualPrompt), // NEW
            inputTokens: stats?.promptTokens || 0,
            outputTokens: stats?.completionTokens || 0,
            totalTokens: stats?.totalTokens || 
                        (stats?.promptTokens || 0) + 
                        (stats?.completionTokens || 0)
          };
          
          executedNodes.push(nodeData);
        }
      });
      
      // Check if there are any executed nodes
      if (executedNodes.length === 0) {
        alert('No execution results to export. Please run the flow first.');
        return;
      }
      
      // Sort nodes by execution order if possible (for now just keep them as is)
      // TODO: Could improve this by tracking actual execution order
      
      // Prepare export data in new format
      const exportData = {
        project: {
          name: currentProject?.name || 'Untitled Project',
          exportDate: new Date().toISOString(),
        },
        executionReport: executedNodes,
        summary: {
          totalNodesExecuted: executedNodes.length,
          totalInputTokens: executedNodes.reduce((sum, node) => sum + node.inputTokens, 0),
          totalOutputTokens: executedNodes.reduce((sum, node) => sum + node.outputTokens, 0),
          totalTokens: executedNodes.reduce((sum, node) => sum + node.totalTokens, 0)
        }
      };

      // Create downloadable JSON file
      // JSON.stringify already properly escapes newlines as \n, tabs as \t, etc.
      // No additional processing needed - the JSON is already valid and readable
      const dataStr = JSON.stringify(exportData, null, 2);

      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${(currentProject?.name || 'workflow').replace(/[^a-z0-9]/gi, '_')}_execution_report_${timestamp}.json`;
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Project Header */}
      <div className="border-b border-gray-800 pb-4">
        <EditableProjectTitle />
        <p className="text-xs text-gray-400 mt-1">
          Description field
        </p>
      </div>

      {/* Project Stats */}
      <div className="bg-gray-900 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{nodes.length}</div>
            <div className="text-xs text-gray-400">Nodes</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{edges.length}</div>
            <div className="text-xs text-gray-400">Connections</div>
          </div>
        </div>
      </div>

      {/* Project Actions */}
      <div className="space-y-2">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setShowExecutionDialog(true);
            }}
            disabled={isExecuting || nodes.length === 0}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all shadow-sm ${
              isExecuting || nodes.length === 0
                ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                : 'bg-green-600 text-white border-green-600 hover:bg-green-700 hover:border-green-700 active:bg-green-800 shadow-lg hover:shadow-xl'
            }`}
          >
            {isExecuting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
                <span>Running...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span className="text-lg">▶️</span>
                <span>Execute Flow</span>
              </div>
            )}
          </button>
          
          <button
            onClick={clearExecutionResults}
            className="px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            🧹
          </button>
        </div>


        <div className="flex space-x-2">
          <button
            onClick={saveProject}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            💾 Save
          </button>
          
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            📁 Projects
          </button>
        </div>

        <button
          onClick={async () => {
            try {
              await createNewProject();
            } catch {
              // Error handled silently
            }
          }}
          className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors border-2 border-dashed border-gray-700 hover:border-gray-600"
        >
          ➕ New Project
        </button>

        {/* Import/Export Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handleImport}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-200 bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors flex items-center justify-center space-x-2"
            title="Import workflow from JSON file"
          >
            <span>📥</span>
            <span>Import</span>
          </button>
          
          <button
            onClick={handleExport}
            disabled={nodes.length === 0}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              nodes.length === 0
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            }`}
            title="Export workflow to JSON file"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Tips */}
      {nodes.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <span className="text-blue-500 text-sm">💡</span>
            <div>
              <p className="text-xs font-medium text-blue-800 mb-1">Getting Started</p>
              <p className="text-xs text-blue-600">
                Drag nodes from above or right-click on canvas to add your first node
              </p>
            </div>
          </div>
        </div>
      )}

      <ProjectManager 
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
      />

      <ExecutionDialog
        isOpen={showExecutionDialog}
        onClose={() => setShowExecutionDialog(false)}
        onExecute={(mode) => {
          const clearResults = mode === 'restart';
          executeFlow(clearResults);
        }}
        stats={getExecutionStats()}
      />
    </div>
  );
};
