/**
 * Basic LLM Chain Node Component
 * Uses BaseNode architecture with modular components
 * Includes queue management and execution logic
 */

'use client';

import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { LLMNodeData } from '@/types/nodeTypes';
import { BaseNode } from './BaseNode';
import { MessageEditor } from './LLMChain/MessageEditor';
import { StreamingDisplay } from './LLMChain/StreamingDisplay';
import { ResponseDisplay } from './LLMChain/ResponseDisplay';
import { useFlowStore } from '@/store/useFlowStore';
import { selectIsExecuting } from '@/store/selectors';
import { motion } from 'framer-motion';
import { useStreamingLLM } from '@/hooks/useStreamingLLM';
import { Position } from '@xyflow/react';

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface BasicLLMChainNodeProps {
  id: string;
  data: LLMNodeData;
  selected?: boolean;
}

const BasicLLMChainNodeComponent: React.FC<BasicLLMChainNodeProps> = ({ id, data, selected }) => {
  // Use selectors for fine-grained subscriptions
  const updateNodeData = useFlowStore(state => state.updateNodeData);
  const deleteNode = useFlowStore(state => state.deleteNode);
  const interpolateTemplate = useFlowStore(state => state.interpolateTemplate);
  const getAvailableVariables = useFlowStore(state => state.getAvailableVariables);
  const globalExecuting = useFlowStore(selectIsExecuting);
  
  // Get execution result directly - avoid curried selector
  const executionResult = useFlowStore(state => state.executionResults[id]);
  
  // Get all nodes and filter model providers
  const nodes = useFlowStore(state => state.nodes);
  
  // Find the model provider for this group
  const modelProvider = useMemo(
    () => nodes.find(n => n.type === 'modelProvider' && n.data?.groupId === (data.modelGroup || 1)),
    [nodes, data.modelGroup]
  );
  
  // Get all model providers for the settings dropdown
  const modelProviders = useMemo(
    () => nodes.filter(n => n.type === 'modelProvider'),
    [nodes]
  );
  const executionState = {
    isExecuting: Boolean(data.isExecuting),
    queueStatus: data.queueStatus,
    error: data.error
  };
  
  // UI-only states
  const [activeTab, setActiveTab] = useState<'messages' | 'response' | 'settings' | 'debug'>(
    (data.activeTab as 'messages' | 'response' | 'settings' | 'debug') || 'messages'
  );
  const [showVariableHelper, setShowVariableHelper] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState<{ context: boolean; request: boolean; response: boolean }>({
    context: false,
    request: false,
    response: false
  });
  
  // Sync activeTab with data.activeTab changes from external updates (e.g., context menu)
  useEffect(() => {
    if (data.activeTab && data.activeTab !== activeTab) {
      setActiveTab(data.activeTab as 'messages' | 'response' | 'settings' | 'debug');
    }
  }, [data.activeTab, activeTab]);
  
  // Streaming state
  const [streamingResponse, setStreamingResponse] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStats, setStreamingStats] = useState<{ tokensPerSecond: number; duration: number } | null>(null);
  
  // Initialize messages only once
  useEffect(() => {
    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      const messages: Message[] = [];
      
      // Default messages if none exist
      messages.push({ id: `msg_${Date.now()}_1`, role: 'system', content: 'You are a helpful AI assistant.' });
      messages.push({ id: `msg_${Date.now()}_2`, role: 'user', content: 'Enter your prompt here...' });
      
      updateNodeData(id, { messages });
    }
  }, [id, updateNodeData, data.messages]);
  
  // Separate effect for cleaning up execution state
  useEffect(() => {
    if (data.isExecuting && !globalExecuting) {
      updateNodeData(id, { isExecuting: false });
    }
  }, [id, data.isExecuting, globalExecuting, updateNodeData]);
  
  const messages = useMemo(() => (data.messages as Message[]) || [], [data.messages]);
  const isNodeExecuting = Boolean(executionState.isExecuting);
  const response = executionResult?.output as Record<string, unknown>;
  
  const handleDataChange = useCallback((updates: Partial<LLMNodeData>) => {
    updateNodeData(id, updates);
  }, [id, updateNodeData]);
  
  // Queue-based execution (preserving existing logic)
  const handleExecute = useCallback(async () => {
    const providerData = modelProvider?.data as { model?: string; temperature?: number; topP?: number } | undefined;
    if (!providerData?.model) {
      alert('Please configure a Model Provider for this group first');
      return;
    }
    
    // Prevent double execution or queuing
    if (executionState.isExecuting || data.queueStatus === 'queued' || data.queueStatus === 'executing') {
      return;
    }
    
    // Reset status if it was completed
    if (data.queueStatus === 'completed') {
      handleDataChange({ queueStatus: undefined });
    }
    
    // Add to queue for sequential execution (preserved from original)
    const nodeToQueue: Node = { 
      id, 
      data: data as unknown as Record<string, unknown>, 
      position: { x: 0, y: 0 }, 
      type: 'basicLLMChain' 
    };
    const { queueManager } = await import('@/store/modules/execution/queueManager');
    await queueManager.addToQueue(nodeToQueue, 0);
  }, [executionState.isExecuting, data, modelProvider, handleDataChange, id]);
  
  // Initialize streaming hook
  const { startStreaming, stopStreaming } = useStreamingLLM({
    onToken: (token) => {
      setStreamingResponse(prev => prev + token);
    },
    onComplete: (fullResponse, thinking) => {
      // Save to executionResults
      const result = {
        nodeId: id,
        success: true,
        output: {
          type: 'basicLLMChain',
          response: fullResponse,
          thinking: thinking,
          text: fullResponse
        },
        duration: streamingStats?.duration || 0
      };
      
      // Update execution results in store
      useFlowStore.setState(state => ({
        executionResults: {
          ...state.executionResults,
          [id]: result
        }
      }));
      
      handleDataChange({
        lastResponse: fullResponse,
        lastThinking: thinking,
        error: undefined
      });
      
      setIsStreaming(false);
      setActiveTab('response');
    },
    onError: (error) => {
      handleDataChange({ error });
      setIsStreaming(false);
      alert(`Streaming error: ${error}`);
    },
    onStats: (stats) => {
      setStreamingStats({
        tokensPerSecond: stats.tokensPerSecond,
        duration: stats.duration
      });
    }
  });
  
  // Streaming execute handler
  const handleStreamExecute = useCallback(async () => {
    const providerData = modelProvider?.data as { model?: string; temperature?: number; topP?: number } | undefined;
    if (!providerData?.model) {
      alert('Please configure a Model Provider for this group first');
      return;
    }
    
    setStreamingResponse('');
    setStreamingThinking('');
    setStreamingStats(null);
    setIsStreaming(true);
    handleDataChange({ error: undefined });
    
    const modelConfig = {
      temperature: providerData.temperature,
      topP: providerData.topP,
    };
    
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    
    const interpolatedMessages = messages.map(msg => ({
      ...msg,
      content: interpolateTemplate(msg.content)
    }));
    
    await startStreaming(
      interpolatedMessages,
      providerData.model,
      modelConfig,
      systemMessage
    );
  }, [modelProvider, messages, startStreaming, handleDataChange, interpolateTemplate]);
  
  // Message Management Functions
  const addMessage = useCallback((role: Message['role']) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      role,
      content: role === 'system' 
        ? 'System message...' 
        : role === 'assistant'
        ? 'Assistant response...'
        : 'User message...'
    };
    handleDataChange({ messages: [...messages, newMessage] });
  }, [messages, handleDataChange]);
  
  const updateMessage = useCallback((index: number, updates: Partial<Message>) => {
    const newMessages = [...messages];
    const existingMessage = newMessages[index];
    if (existingMessage) {
      newMessages[index] = { ...existingMessage, ...updates } as Message;
    }
    handleDataChange({ messages: newMessages });
  }, [messages, handleDataChange]);
  
  const deleteMessage = useCallback((index: number) => {
    const newMessages = messages.filter((_, i) => i !== index);
    handleDataChange({ messages: newMessages });
  }, [messages, handleDataChange]);
  
  const moveMessage = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= messages.length) return;
    
    const newMessages = [...messages];
    const temp = newMessages[index];
    const swapWith = newMessages[newIndex];
    if (temp && swapWith) {
      newMessages[index] = swapWith;
      newMessages[newIndex] = temp;
    }
    handleDataChange({ messages: newMessages });
  }, [messages, handleDataChange]);
  
  // Tab components using new subcomponents
  const renderTabs = () => (
    <div className="flex gap-1 px-3 py-2">
      {(['messages', 'response', 'settings', 'debug'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => {
            setActiveTab(tab);
            handleDataChange({ activeTab: tab });
          }}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            activeTab === tab 
              ? 'text-blue-400 border-b-2 border-blue-400' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
  
  const renderMainContent = () => {
    switch (activeTab) {
      case 'messages':
        return (
          <div className="p-3">
            <MessageEditor
              messages={messages}
              onUpdateMessage={updateMessage}
              onAddMessage={addMessage}
              onDeleteMessage={deleteMessage}
              onMoveMessage={moveMessage}
              nodeId={id}
            />
          </div>
        );
      
      case 'response':
        return (
          <div className="p-3 space-y-3">
            {/* Streaming Toggle */}
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(data.streamingEnabled)}
                  onChange={(e) => handleDataChange({ streamingEnabled: e.target.checked })}
                  className="rounded text-blue-500"
                />
                <span className="text-xs text-gray-300">Enable Streaming</span>
              </label>
            </div>
            
            {/* Streaming Display */}
            {isStreaming && (
              <StreamingDisplay
                isStreaming={isStreaming}
                streamingResponse={streamingResponse}
                streamingThinking={streamingThinking}
                streamingStats={streamingStats}
                onStopStreaming={stopStreaming}
              />
            )}
            
            {/* Response Display */}
            {!isStreaming && (
              <ResponseDisplay
                response={response}
                streamingResponse={streamingResponse}
                streamingThinking={streamingThinking}
                isStreaming={isStreaming}
                error={data.error}
              />
            )}
          </div>
        );
      
      case 'settings':
        return (
          <div className="p-3 space-y-3">
            {/* Model Provider Connection Status */}
            <div className="p-2 bg-gray-800 rounded">
              <label className="text-xs font-semibold text-gray-300 mb-2 block">Model Provider Connection</label>
              {modelProvider ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-xs text-green-400">Connected</span>
                  </div>
                  <div className="text-xs text-gray-400 ml-4">
                    <div>Provider: <span className="text-gray-200">{(modelProvider.data as { provider?: string })?.provider || 'Unknown'}</span></div>
                    <div>Model: <span className="text-gray-200">{(modelProvider.data as { model?: string })?.model || 'Not selected'}</span></div>
                    <div>Node: <span className="text-gray-200">{String(modelProvider.data?.label || modelProvider.id)}</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span className="text-xs text-red-400">Not Connected</span>
                  </div>
                  <div className="text-xs text-gray-400 ml-4">
                    Add a Model Provider node and set it to Group {data.modelGroup || 1}
                  </div>
                </div>
              )}
            </div>
            
            {/* Model Group Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-300">Model Group</label>
              <select
                value={data.modelGroup || 1}
                onChange={(e) => handleDataChange({ modelGroup: parseInt(e.target.value) })}
                className={`w-full mt-1 px-2 py-1 text-xs border bg-gray-700 text-white rounded focus:outline-none focus:ring-1 ${
                  modelProvider ? 'border-green-600 focus:ring-green-400' : 'border-gray-600 focus:ring-blue-400'
                }`}
              >
                {[1, 2, 3, 4, 5].map(group => {
                  const hasProvider = modelProviders.some(n => n.data?.groupId === group);
                  return (
                    <option key={group} value={group}>
                      Group {group} {hasProvider ? '✓' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Output Variable */}
            <div>
              <label className="text-xs font-semibold text-gray-300">Output Variable Name</label>
              <input
                type="text"
                value={data.outputVariable || ''}
                onChange={(e) => handleDataChange({ outputVariable: e.target.value })}
                placeholder={`llm_${id}`}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-600 bg-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            
            {/* Variable Helper */}
            <div>
              <button
                onClick={() => setShowVariableHelper(!showVariableHelper)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {showVariableHelper ? 'Hide' : 'Show'} Available Variables
              </button>
              
              {showVariableHelper && (
                <div className="mt-2 p-2 bg-gray-700 rounded max-h-32 overflow-auto">
                  {Object.keys(getAvailableVariables()).map(varName => (
                    <div key={varName} className="text-xs cursor-pointer hover:bg-gray-600 p-1 rounded"
                         onClick={() => navigator.clipboard.writeText(`{{${varName}}}`)}>
                      <code className="bg-gray-800 px-1 rounded text-gray-200">{`{{${varName}}}`}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      
      case 'debug':
        return (
          <div className="p-3 space-y-3">
            {executionResult?.debugInfo ? (
              <>
                {/* Debug sections now read from executionResult instead of node.data */}
                {executionResult.debugInfo.context && (
                  <div className="border border-blue-600/30 rounded">
                    <button
                      onClick={() => setDebugExpanded(prev => ({ ...prev, context: !prev.context }))}
                      className="w-full px-3 py-2 flex items-center justify-between bg-blue-900/20 hover:bg-blue-900/30"
                    >
                      <span className="text-sm font-medium text-blue-400">📋 Debug Context</span>
                      <span className="text-gray-400">{debugExpanded.context ? '▲' : '▼'}</span>
                    </button>
                    {debugExpanded.context && (
                      <div className="p-3 border-t border-blue-600/30">
                        <pre className="text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
                          {JSON.stringify(executionResult.debugInfo.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                
                {executionResult.debugInfo.request && (
                  <div className="border border-green-600/30 rounded">
                    <button
                      onClick={() => setDebugExpanded(prev => ({ ...prev, request: !prev.request }))}
                      className="w-full px-3 py-2 flex items-center justify-between bg-green-900/20 hover:bg-green-900/30"
                    >
                      <span className="text-sm font-medium text-green-400">📤 Provider Request</span>
                      <span className="text-gray-400">{debugExpanded.request ? '▲' : '▼'}</span>
                    </button>
                    {debugExpanded.request && (
                      <div className="p-3 border-t border-green-600/30">
                        <pre className="text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
                          {JSON.stringify(executionResult.debugInfo.request, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                
                {executionResult.debugInfo.response && (
                  <div className="border border-purple-600/30 rounded">
                    <button
                      onClick={() => setDebugExpanded(prev => ({ ...prev, response: !prev.response }))}
                      className="w-full px-3 py-2 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30"
                    >
                      <span className="text-sm font-medium text-purple-400">📥 Provider Response</span>
                      <span className="text-gray-400">{debugExpanded.response ? '▲' : '▼'}</span>
                    </button>
                    {debugExpanded.response && (
                      <div className="p-3 border-t border-purple-600/30">
                        <pre className="text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
                          {JSON.stringify(executionResult.debugInfo.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-xs italic text-center py-8">
                No debug information available.
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };
  
  // Execute buttons
  const renderActions = () => (
    <div className="px-3 py-2">
      {isStreaming ? (
        <button
          onClick={stopStreaming}
          className="w-full px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-500 transition-colors text-sm font-medium"
        >
          <span className="flex items-center justify-center gap-2">
            <span>⏹</span>
            Stop Streaming
          </span>
        </button>
      ) : data.streamingEnabled ? (
        <button
          onClick={handleStreamExecute}
          disabled={isNodeExecuting || !(modelProvider?.data as { model?: string })?.model}
          className="w-full px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          <span className="flex items-center justify-center gap-2">
            <span>🚀</span>
            Stream Execute
          </span>
        </button>
      ) : (
        <button
          onClick={handleExecute}
          disabled={isNodeExecuting || !(modelProvider?.data as { model?: string })?.model || data.queueStatus === 'queued' || data.queueStatus === 'executing' || data.queueStatus === 'waiting'}
          className={`w-full px-3 py-1.5 text-white rounded transition-colors text-sm font-medium ${
            data.queueStatus === 'waiting'
              ? 'bg-orange-600 cursor-wait'
              : data.queueStatus === 'queued' 
              ? 'bg-yellow-600 cursor-wait' 
              : data.queueStatus === 'executing'
              ? 'bg-green-600 animate-pulse'
              : data.queueStatus === 'completed'
              ? 'bg-gray-600 hover:bg-blue-600'
              : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed'
          }`}
        >
          {data.queueStatus === 'waiting' ? (
            <span className="flex items-center justify-center gap-2">
              <span>⏳</span>
              WAITING
            </span>
          ) : data.queueStatus === 'queued' ? (
            <span className="flex items-center justify-center gap-2">
              <span>⏱️</span>
              IN QUEUE
            </span>
          ) : data.queueStatus === 'executing' || isNodeExecuting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚡
              </motion.span>
              RUNNING
            </span>
          ) : data.queueStatus === 'completed' ? (
            <span className="flex items-center justify-center gap-2">
              <span>✅</span>
              COMPLETE - Click to Run Again
            </span>
          ) : (
            'Execute LLM Chain'
          )}
        </button>
      )}
    </div>
  );
  
  // Model Provider Badge Component
  const ModelProviderBadge = () => {
    if (!modelProvider) {
      return (
        <div 
          className="flex items-center gap-1 px-2 py-0.5 bg-red-900/50 border border-red-600 rounded text-xs text-red-400 cursor-help"
          title="No Model Provider configured for this group. Add a Model Provider node and set it to the same group."
        >
          <span className="text-[10px]">⚠</span>
          <span>No Provider</span>
        </div>
      );
    }
    
    const providerData = modelProvider.data as { 
      provider?: string; 
      model?: string; 
      temperature?: number;
      topP?: number;
    };
    const providerName = providerData.provider || 'unknown';
    const modelName = providerData.model || 'not selected';
    
    // Provider icons and colors
    const getProviderStyle = (provider: string) => {
      switch (provider) {
        case 'openai': 
          return { 
            icon: '🟢', 
            bgColor: 'bg-emerald-900/30', 
            borderColor: 'border-emerald-600/50',
            textColor: 'text-emerald-400'
          };
        case 'anthropic': 
          return { 
            icon: '🔵', 
            bgColor: 'bg-blue-900/30', 
            borderColor: 'border-blue-600/50',
            textColor: 'text-blue-400'
          };
        case 'ollama': 
          return { 
            icon: '🦙', 
            bgColor: 'bg-orange-900/30', 
            borderColor: 'border-orange-600/50',
            textColor: 'text-orange-400'
          };
        case 'lmstudio': 
          return { 
            icon: '💻', 
            bgColor: 'bg-purple-900/30', 
            borderColor: 'border-purple-600/50',
            textColor: 'text-purple-400'
          };
        default: 
          return { 
            icon: '🤖', 
            bgColor: 'bg-gray-900/30', 
            borderColor: 'border-gray-600/50',
            textColor: 'text-gray-400'
          };
      }
    };
    
    const style = getProviderStyle(providerName);
    const tooltipText = `Provider: ${providerName}\nModel: ${modelName}\nGroup: ${data.modelGroup || 1}${providerData.temperature !== undefined ? `\nTemp: ${providerData.temperature}` : ''}${providerData.topP !== undefined ? `\nTop-P: ${providerData.topP}` : ''}`;
    
    return (
      <div 
        className={`flex items-center gap-1 px-2 py-0.5 ${style.bgColor} border ${style.borderColor} rounded text-xs ${style.textColor} cursor-help transition-all hover:opacity-80`}
        title={tooltipText}
      >
        <span className="text-[10px]">{style.icon}</span>
        <span className="font-medium truncate max-w-[150px]">{modelName}</span>
        <span className="text-gray-500 text-[10px]">• G{data.modelGroup || 1}</span>
      </div>
    );
  };
  
  const footerContent = executionResult && (
    <div className="flex items-center justify-between text-xs text-gray-400">
      {executionResult.success ? (
        <>
          <span className="text-green-400">✓ Success</span>
          {executionResult.duration && <span>{executionResult.duration}ms</span>}
        </>
      ) : (
        <span className="text-red-400">✗ {executionResult.error}</span>
      )}
    </div>
  );
  
  // Use ComplexBaseNode with slots
  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
        config={{
          title: 'LLM Chain',
          icon: <span className="text-blue-400">🤖</span>,
          minWidth: 350,
          minHeight: 300,
          maxWidth: 800,
          resizable: true,
          renamable: true,
          collapsible: true,
          customOverflow: 'overflow-auto',
        inputs: [{ 
          position: Position.Left,
          id: 'input',
          label: 'Input'
        }],
        outputs: [{ 
          position: Position.Right,
          id: 'output',
          label: 'Output'
        }]
      }}
      slots={{
        header: <ModelProviderBadge />,
        tabs: renderTabs(),
        main: renderMainContent(),
        actions: renderActions(),
        footer: footerContent
      }}
      onDataChange={(data) => handleDataChange(data as Partial<LLMNodeData>)}
      onDelete={() => deleteNode(id)}
      onRename={(newName) => handleDataChange({ label: newName })}
    />
  );
};

export const BasicLLMChainNode = memo(BasicLLMChainNodeComponent);
