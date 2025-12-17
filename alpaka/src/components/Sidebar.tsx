'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NodeItem } from '@/components/ui/NodeItem';
import { VariableManager } from './VariableManager/VariableManager';
import { ExecutionManager } from './ExecutionManager/ExecutionManager';
import { ProjectControls } from '@/components/ProjectControls';
import { useFlowStore } from '@/store/useFlowStore';
import { API_ENDPOINTS } from '@/config/api';

interface NodeTemplate {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  comingSoon?: boolean;
}

const nodeTemplates: NodeTemplate[] = [
  {
    id: 'model-provider',
    type: 'modelProvider',
    label: 'Model Provider',
    description: 'Configure AI model provider and groups (Ollama, OpenAI, etc.)',
    icon: '🏭',
    category: 'AI Models',
  },
  {
    id: 'basic-llm-chain',
    type: 'basicLLMChain',
    label: 'LLM Chain',
    description: 'Execute prompts using configured model groups',
    icon: '🤖',
    category: 'AI Models',
  },
  {
    id: 'note',
    type: 'note',
    label: 'Note',
    description: 'Add notes and documentation',
    icon: '📝',
    category: 'Documentation',
  },
];

const categories = ['All', ...Array.from(new Set(nodeTemplates.map(node => node.category)))];

interface SidebarProps {
  onExecutionManagerToggle?: (isOpen: boolean) => void;
  onVariableManagerToggle?: (isOpen: boolean) => void;
}

export const Sidebar = ({ onExecutionManagerToggle, onVariableManagerToggle }: SidebarProps = {}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('AI Models');
  const [activeTab, setActiveTab] = useState<'project' | 'nodes'>('project');
  const [showVariableManager, setShowVariableManager] = useState(false);
  const [showExecutionManager, setShowExecutionManager] = useState(false);
  
  // Notify parent when ExecutionManager state changes
  useEffect(() => {
    onExecutionManagerToggle?.(showExecutionManager);
  }, [showExecutionManager, onExecutionManagerToggle]);
  
  // Notify parent when VariableManager state changes
  useEffect(() => {
    onVariableManagerToggle?.(showVariableManager);
  }, [showVariableManager, onVariableManagerToggle]);
  
  // Use direct state access to avoid selector issues
  const resetAllLLMNodes = useFlowStore(state => state.resetAllLLMNodes);
  const clearAllEdges = useFlowStore(state => state.clearAllEdges);
  const edges = useFlowStore(state => state.edges);
  const nodes = useFlowStore(state => state.nodes);
  const llmNodes = nodes.filter(n => n.type === 'basicLLMChain');
  const llmNodesCount = llmNodes.length;
  
  // Keyboard shortcuts for managers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Variable Manager: Cmd+Shift+V
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        setShowVariableManager(true);
      }
      // Execution Manager: Cmd+Shift+E
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setShowExecutionManager(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  

  const filteredNodes = nodeTemplates.filter(node => 
    selectedCategory === 'All' || node.category === selectedCategory
  );

  return (
    <motion.div
      className="bg-gray-900 border-r border-gray-800 shadow-sm relative z-10 h-screen flex flex-col"
      initial={{ width: 320 }}
      animate={{ width: isCollapsed ? 60 : 320 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {/* Navigation Tabs - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {/* Row 1 */}
                <button
                  onClick={() => setActiveTab('project')}
                  className={`px-3 py-2 text-xs rounded-lg transition-colors text-center flex flex-col items-center gap-1 ${
                    activeTab === 'project'
                      ? 'bg-white text-black font-medium'
                      : 'text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-sm">📁</span>
                  <span>Project</span>
                </button>
                <button
                  onClick={() => setActiveTab('nodes')}
                  className={`px-3 py-2 text-xs rounded-lg transition-colors text-center flex flex-col items-center gap-1 ${
                    activeTab === 'nodes'
                      ? 'bg-white text-black font-medium'
                      : 'text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-sm">🔧</span>
                  <span>Nodes</span>
                </button>
                {/* Row 2 */}
                <button
                  onClick={() => setShowVariableManager(true)}
                  className="px-3 py-2 text-xs rounded-lg transition-all text-center flex flex-col items-center gap-1 bg-gradient-to-br from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg hover:shadow-xl transform hover:scale-105"
                  title="Open Variable Manager - Cmd+Shift+V"
                >
                  <span className="text-sm">📊</span>
                  <span className="font-medium">Variables</span>
                </button>
                <button
                  onClick={() => setShowExecutionManager(true)}
                  className="px-3 py-2 text-xs rounded-lg transition-all text-center flex flex-col items-center gap-1 bg-gradient-to-br from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg hover:shadow-xl transform hover:scale-105"
                  title="Open Execution Manager - Cmd+Shift+E"
                >
                  <span className="text-sm">⚡</span>
                  <span className="font-medium">Execution</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isCollapsed ? '→' : '←'}
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Tab Content */}
            {activeTab === 'project' ? (
              /* Project Controls */
              <div className="flex-1 overflow-y-auto p-4">
                <ProjectControls />
              </div>
            ) : activeTab === 'nodes' ? (
              <>
                {/* Category Filter */}
                <div className="p-4 border-b border-gray-700">
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                          selectedCategory === category
                            ? 'bg-gray-700 text-white font-medium border border-gray-600'
                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Node List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {filteredNodes.map((node) => (
                      <NodeItem
                        key={node.id}
                        node={node}
                      />
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500 text-center">
                    <p className="mb-1">💡 Drag nodes to canvas</p>
                    <p>Connect nodes to build workflows</p>
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed State Icons */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="p-2 space-y-2"
          >
            {/* Variable Manager button in collapsed state */}
            <div
              onClick={() => setShowVariableManager(true)}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:from-purple-500 hover:to-blue-500 transition-all shadow-md hover:shadow-lg"
              title="Open Variable Manager"
            >
              📊
            </div>
            
            {/* Execution Manager button in collapsed state */}
            <div
              onClick={() => setShowExecutionManager(true)}
              className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:from-green-500 hover:to-emerald-500 transition-all shadow-md hover:shadow-lg"
              title="Open Execution Manager"
            >
              ⚡
            </div>
            
            {/* Node templates */}
            {nodeTemplates.slice(0, 5).map((node) => (
              <div
                key={node.id}
                className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:bg-gray-700 transition-colors"
                title={node.label}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/reactflow', node.type);
                  event.dataTransfer.effectAllowed = 'move';
                }}
              >
                {node.icon}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons - Fixed at bottom */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-800 bg-gray-900 space-y-2">
          {/* Reset All LLM Nodes Button */}
          <button
            onClick={() => {
              if (llmNodesCount > 0) {
                resetAllLLMNodes();
              }
            }}
            disabled={llmNodesCount === 0}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              llmNodesCount === 0
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'
            }`}
            title={`Reset all ${llmNodesCount} LLM nodes - clears responses, execution results, and variables`}
          >
            <span>🔄</span>
            <span>Reset LLM Nodes ({llmNodesCount})</span>
          </button>
          
          {/* Stop Ollama Button */}
          <button
            onClick={async () => {
              try {
                // Create an AbortController to cancel any pending requests
                const controller = new AbortController();
                
                // Try to abort all pending Ollama requests by sending a signal
                await fetch(API_ENDPOINTS.OLLAMA_ABORT, {
                  method: 'POST',
                  signal: controller.signal,
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ abort_all: true })
                }).catch(() => null);
                
                // Also try to clear the queue
                const { queueManager } = await import('@/store/modules/execution/queueManager');
                
                // Get all executing items and mark them as failed
                const activeItems = queueManager.getActiveItems();
                if (activeItems.length > 0) {
                  // Stopping active Ollama requests
                  
                  // Clear the entire queue and reset
                  queueManager.reset();
                  
                  // Reset all executing nodes' statuses
                  const { useFlowStore: useFlowStore } = await import('@/store/useFlowStore');
                  const store = useFlowStore.getState();
                  const nodes = store.nodes;
                  
                  nodes.forEach(node => {
                    if (node.data?.isExecuting || node.data?.queueStatus === 'executing') {
                      store.updateNodeData(node.id, { 
                        isExecuting: false,
                        queueStatus: 'failed',
                        error: 'Execution stopped by user'
                      });
                    }
                  });
                  
                  alert(`Stopped ${activeItems.length} active Ollama request(s)`);
                } else {
                  alert('No active Ollama requests to stop');
                }
          } catch {
                alert('Failed to stop Ollama. You may need to restart Ollama manually.');
              }
            }}
            className="w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800"
            title="Stop all active Ollama requests and clear execution queue"
          >
            <span>⛔</span>
            <span>Stop Ollama</span>
          </button>
          
          {/* Clear All Connections Button */}
          <button
            onClick={() => {
              if (edges.length > 0) {
                const confirmClear = window.confirm(`Are you sure you want to remove all ${edges.length} connection(s)?`);
                if (confirmClear) {
                  clearAllEdges();
                }
              }
            }}
            disabled={edges.length === 0}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              edges.length === 0
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
            }`}
            title={`Remove all ${edges.length} connection(s) between nodes`}
          >
            <span>✂️</span>
            <span>Clear Connections ({edges.length})</span>
          </button>
        </div>
      )}

      {/* Variable Manager Modal */}
      <VariableManager
        isOpen={showVariableManager}
        onClose={() => setShowVariableManager(false)}
      />
      
      {/* Execution Manager Modal */}
      <ExecutionManager
        isOpen={showExecutionManager}
        onClose={() => setShowExecutionManager(false)}
      />
    </motion.div>
  );
};
