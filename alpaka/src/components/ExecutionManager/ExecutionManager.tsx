'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QueueItem, QueueStats, ExecutionQueueManager } from '@/store/modules/execution/queueManager';
import { selectIsExecuting, selectNodesCount } from '@/store/selectors';
import { formatDuration } from '@/utils/formatters';
import { ExecutionDialog } from '../ui/ExecutionDialog';
import { ExecutionResult } from '@/types';

interface ExecutionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutionManager: React.FC<ExecutionManagerProps> = ({ isOpen, onClose }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [maxWorkers, setMaxWorkers] = useState(2);
  const [activeTab, setActiveTab] = useState<'queue' | 'timeline'>('queue');
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    active: true,
    queued: true,
    completed: false,
    failed: false,
    statistics: true,
    retrySettings: false
  });
  
  const queueManagerRef = useRef<ExecutionQueueManager | null>(null);
  
  // Get executeFlow and isExecuting from store - using selectors
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});

  // Initialize queueManager and get store data
  useEffect(() => {
    if (!isOpen) return;
    
    let unsubscribe: (() => void) | undefined;
    let unsubscribeStore: (() => void) | undefined;
    // Removed interval - using only subscription for updates
    
    // Get store data with selectors
    import('@/store/useFlowStore').then(({ useFlowStore }) => {
      const store = useFlowStore.getState();
      setIsExecuting(selectIsExecuting(store));
      setNodeCount(selectNodesCount(store));
      setExecutionResults(store.executionResults || {});
      
      // Subscribe to store changes with selectors
      unsubscribeStore = useFlowStore.subscribe((state) => {
        setIsExecuting(selectIsExecuting(state));
        setNodeCount(selectNodesCount(state));
        setExecutionResults(state.executionResults || {});
      });
    });
    
    // Dynamically import queueManager
    import('@/store/modules/execution/queueManager').then(({ queueManager }) => {
      queueManagerRef.current = queueManager;
      
      const updateQueueData = () => {
        // Only update if component is still mounted (isOpen is true)
        if (!isOpen) return;
        
        const queueData = queueManager.getQueue();
        setQueue(queueData);
        const currentStats = queueManager.getStats();
        setStats(currentStats);
        setMaxWorkers(queueManager.getMaxWorkers());
      };

      // Initial load
      updateQueueData();

      // Subscribe to updates - this is sufficient for real-time updates
      // queueManager already notifies on every change
      unsubscribe = queueManager.subscribe(updateQueueData);
    });
    
    // Cleanup
    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeStore) unsubscribeStore();
    };
  }, [isOpen]);

  const handleWorkersChange = useCallback((newValue: number) => {
    if (queueManagerRef.current) {
      queueManagerRef.current.setMaxWorkers(newValue);
      setMaxWorkers(newValue);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    if (queueManagerRef.current) {
      queueManagerRef.current.clearHistory();
    }
  }, []);

  const handleClearQueue = useCallback(() => {
    if (queueManagerRef.current) {
      queueManagerRef.current.clearQueue();
    }
  }, []);
  
  // Функция для подсчета статистики выполнения
  const getExecutionStats = useCallback(() => {
    const totalNodes = nodeCount;
    const completedNodes = Object.keys(executionResults).filter(
      nodeId => executionResults[nodeId]?.success
    ).length;
    
    return {
      totalNodes,
      completedNodes,
      remainingNodes: totalNodes - completedNodes,
      hasResults: completedNodes > 0
    };
  }, [nodeCount, executionResults]);

  const handleExecuteFlow = useCallback(async () => {
    setShowExecutionDialog(true);
  }, []);

  const handleStopFlow = useCallback(async () => {
    const queueManager = queueManagerRef.current;
    if (queueManager) {
      queueManager.stopFlow();
      setIsExecuting(false);
    }
  }, []);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!isOpen) return null;

  // Categorize queue items
  const activeItems = queue.filter(item => item.status === 'executing');
  const queuedItems = queue.filter(item => item.status === 'queued');
  const waitingItems = queue.filter(item => item.status === 'waiting');
  const completedItems = queue.filter(item => item.status === 'completed');
  const failedItems = queue.filter(item => item.status === 'failed');

  const totalProgress = queue.length > 0 
    ? Math.round((completedItems.length / queue.length) * 100)
    : 0;

  // Get total flow time (wall-clock time from start to finish)
  // This is the actual elapsed time, not the sum of node execution times
  const totalTime = queueManagerRef.current?.getTotalFlowTime() || 0;

  // Calculate total token statistics
  const totalInputTokens = queue.reduce((sum, item) => {
    return sum + (item.tokenStats?.promptTokens || 0);
  }, 0);

  const totalOutputTokens = queue.reduce((sum, item) => {
    return sum + (item.tokenStats?.completionTokens || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-[98vw] h-[95vh] flex flex-col border border-gray-800" style={{ maxWidth: '98vw', maxHeight: '95vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl font-semibold text-white">Execution Manager</h2>
            {stats && (
              <div className="flex items-center gap-4 ml-6">
                <span className="text-sm text-gray-400">
                  Total: {queue.length} tasks
                </span>
                <span className="text-sm text-gray-400">
                  Time: {formatDuration(totalTime)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-6">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'queue'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            📋 Queue
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 text-sm font-medium transition-colors ml-4 ${
              activeTab === 'timeline'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            📊 Timeline
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Queue Items or Timeline */}
          <div className="flex-1 overflow-y-auto border-r border-gray-800">
            {activeTab === 'queue' ? (
              <div className="p-6 space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">Overall Progress</span>
                  <span className="text-sm font-bold text-blue-400">{totalProgress}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
              </div>

              {/* Active Tasks */}
              {activeItems.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => toggleSection('active')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400">⚡</span>
                      <h3 className="text-sm font-semibold text-gray-200">
                        Active Tasks ({activeItems.length})
                      </h3>
                    </div>
                    <span className="text-gray-400">{expandedSections.active ? '▲' : '▼'}</span>
                  </button>
                  {expandedSections.active && (
                    <div className="space-y-2">
                      {activeItems.map(item => (
                        <TaskItem key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Queued Tasks */}
              {(queuedItems.length > 0 || waitingItems.length > 0) && (
                <div className="space-y-3">
                  <button
                    onClick={() => toggleSection('queued')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">🕐</span>
                      <h3 className="text-sm font-semibold text-gray-200">
                        Queued Tasks ({queuedItems.length + waitingItems.length})
                      </h3>
                    </div>
                    <span className="text-gray-400">{expandedSections.queued ? '▲' : '▼'}</span>
                  </button>
                  {expandedSections.queued && (
                    <div className="space-y-2">
                      {[...waitingItems, ...queuedItems].map(item => (
                        <TaskItem key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Completed Tasks */}
              {completedItems.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => toggleSection('completed')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <h3 className="text-sm font-semibold text-gray-200">
                        Completed Tasks ({completedItems.length})
                      </h3>
                    </div>
                    <span className="text-gray-400">{expandedSections.completed ? '▲' : '▼'}</span>
                  </button>
                  {expandedSections.completed && (
                    <div className="space-y-2">
                      {completedItems.map(item => (
                        <TaskItem key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Failed Tasks */}
              {failedItems.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => toggleSection('failed')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-red-400">⚠️</span>
                      <h3 className="text-sm font-semibold text-gray-200">
                        Failed Tasks ({failedItems.length})
                      </h3>
                    </div>
                    <span className="text-gray-400">{expandedSections.failed ? '▲' : '▼'}</span>
                  </button>
                  {expandedSections.failed && (
                    <div className="space-y-2">
                      {failedItems.map(item => (
                        <TaskItem key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            ) : (
              /* Timeline Tab Content */
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                  <div className="text-6xl">📈</div>
                  <h3 className="text-xl font-semibold text-gray-300">Timeline View</h3>
                  <p className="text-gray-500">Coming Soon</p>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Visualize your workflow execution timeline with parallel task tracking,
                    dependency chains, and performance insights.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Controls & Stats */}
          <div className="w-96 p-6 space-y-6 overflow-y-auto">
            {/* Worker Control */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">👥</span>
                <h3 className="text-sm font-semibold text-gray-200">Workers</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Active Workers</span>
                  <span className="text-sm font-mono text-blue-400">
                    {stats?.activeWorkers || 0} / {maxWorkers}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={maxWorkers}
                    onChange={(e) => handleWorkersChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1</span>
                    <span>{maxWorkers} workers</span>
                    <span>25</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="space-y-4">
              <button
                onClick={() => toggleSection('statistics')}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📊</span>
                  <h3 className="text-sm font-semibold text-gray-200">Statistics</h3>
                </div>
                <span className="text-gray-400">{expandedSections.statistics ? '▲' : '▼'}</span>
              </button>
              
              {expandedSections.statistics && stats && (
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="Total Queued"
                    value={stats.totalQueued}
                    color="blue"
                  />
                  <StatCard
                    label="Executing"
                    value={stats.executing}
                    color="yellow"
                  />
                  <StatCard
                    label="Completed"
                    value={stats.completed}
                    color="green"
                  />
                  <StatCard
                    label="Failed"
                    value={stats.failed}
                    color="red"
                  />
                  <StatCard
                    label="Waiting"
                    value={stats.waiting}
                    color="purple"
                  />
                  <StatCard
                    label="Total Time"
                    value={formatDuration(totalTime)}
                    color="blue"
                  />
                  <StatCard
                    label="Input Tokens"
                    value={totalInputTokens.toLocaleString()}
                    color="blue"
                  />
                  <StatCard
                    label="Output Tokens"
                    value={totalOutputTokens.toLocaleString()}
                    color="green"
                  />
                </div>
              )}
            </div>

            {/* Retry Settings */}
            <div className="space-y-4 pt-6 border-t border-gray-800">
              <button
                onClick={() => toggleSection('retrySettings')}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🔄</span>
                  <h3 className="text-sm font-semibold text-gray-200">Retry Settings</h3>
                </div>
                <span className="text-gray-400">{expandedSections.retrySettings ? '▲' : '▼'}</span>
              </button>

              {expandedSections.retrySettings && (
                <div className="space-y-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">LLM Requests:</span>
                      <span className="text-green-400 font-mono">3 retries, 2s base delay</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">HTTP Requests:</span>
                      <span className="text-green-400 font-mono">3 retries, 1s base delay</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        <span className="text-yellow-400">ℹ️</span> Transient errors (timeouts, rate limits, 503) are automatically retried with exponential backoff.
                        Permanent errors (401, 404) fail immediately.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-6 border-t border-gray-800">
              <button
                onClick={handleClearHistory}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                Clear Completed
              </button>
              <button
                onClick={handleClearQueue}
                className="w-full px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                Clear Queue
              </button>
              
              {/* Execute Flow / Stop Flow Buttons */}
              <div className="pt-3 border-t border-gray-700 space-y-2">
                {!isExecuting ? (
                  <button
                    onClick={handleExecuteFlow}
                    disabled={nodeCount === 0}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 ${
                      nodeCount === 0
                        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <span className="text-lg">▶️</span>
                    <span>Execute Flow</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopFlow}
                    className="w-full px-4 py-3 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-lg hover:shadow-xl"
                  >
                    <span className="text-lg">⏹️</span>
                    <span>Stop Flow</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <ExecutionDialog
        isOpen={showExecutionDialog}
        onClose={() => setShowExecutionDialog(false)}
        onExecute={async (mode) => {
          const { useFlowStore } = await import('@/store/useFlowStore');
          const store = useFlowStore.getState();
          const clearResults = mode === 'restart';
          store.executeFlow(clearResults);
        }}
        stats={getExecutionStats()}
      />
    </div>
  );
};

// Task Item Component with expandable details
const TaskItem: React.FC<{ item: QueueItem }> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const statusColors = {
    executing: 'bg-yellow-900/20 border-yellow-700 text-yellow-400',
    queued: 'bg-blue-900/20 border-blue-700 text-blue-400',
    waiting: 'bg-purple-900/20 border-purple-700 text-purple-400',
    completed: 'bg-green-900/20 border-green-700 text-green-400',
    failed: 'bg-red-900/20 border-red-700 text-red-400'
  };

  const statusIcons = {
    executing: '⚡',
    queued: '🕐',
    waiting: '⏳',
    completed: '✅',
    failed: '⚠️'
  };

  const duration = item.startedAt && item.completedAt
    ? new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()
    : item.startedAt
    ? Date.now() - new Date(item.startedAt).getTime()
    : 0;

  const handleCopyOutput = () => {
    if (!item.output) return;
    
    const textToCopy = item.output.text || item.output.response || 
                       JSON.stringify(item.output.value) || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const hasDetails = item.output || item.tokenStats || 
                     (item.status === 'completed' || item.status === 'failed');

  return (
    <div className={`rounded-lg border ${statusColors[item.status]} transition-all`}>
      <div 
        className={`p-3 ${hasDetails ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span>{statusIcons[item.status]}</span>
              <span className="font-medium text-sm">{item.nodeName}</span>
              {item.workerId !== undefined && (
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                  Worker {item.workerId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Type: {item.nodeType}</span>
              {item.priority > 0 && <span>Priority: {item.priority}</span>}
              {item.dependencies.length > 0 && (
                <span>Deps: {item.dependencies.length}</span>
              )}
            </div>
            {duration > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>Duration: {formatDuration(duration)}</span>
                {/* Show token generation speed for executing LLM nodes */}
                {item.status === 'executing' && item.nodeType === 'basicLLMChain' && (
                  <span className="text-yellow-400 font-mono animate-pulse">
                    ⚡ Generating... ({(duration / 1000).toFixed(1)}s)
                  </span>
                )}
                {/* Show final token speed for completed LLM nodes */}
                {item.status === 'completed' && item.tokenStats?.completionTokens && (
                  <span className="text-green-400 font-mono">
                    ⚡ {(item.tokenStats.completionTokens / (duration / 1000)).toFixed(1)} tok/s
                  </span>
                )}
              </div>
            )}
            {item.error && (
              <div className="text-xs text-red-400 mt-1">
                Error: {item.error}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {item.status === 'executing' && (
              <div className="animate-pulse">
                <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              </div>
            )}
            {hasDetails && (
              <span className="text-gray-400 text-sm">
                {isExpanded ? '▲' : '▼'}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Expandable Details Section */}
      {isExpanded && hasDetails && (
        <div className="border-t border-gray-700/50 p-3 space-y-3 bg-black/20">
          {/* Timing Information */}
          {(item.startedAt || item.completedAt) && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-400 mb-1">⏱️ Timing</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {item.startedAt && (
                  <div>
                    <span className="text-gray-500">Started:</span>
                    <span className="ml-2 text-gray-300">{formatTime(item.startedAt)}</span>
                  </div>
                )}
                {item.completedAt && (
                  <div>
                    <span className="text-gray-500">Completed:</span>
                    <span className="ml-2 text-gray-300">{formatTime(item.completedAt)}</span>
                  </div>
                )}
                {item.relativeStartTime !== undefined && (
                  <div>
                    <span className="text-gray-500">Relative Start:</span>
                    <span className="ml-2 text-gray-300">{formatDuration(item.relativeStartTime)}</span>
                  </div>
                )}
                {duration > 0 && (
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-2 text-gray-300">{formatDuration(duration)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Token Statistics */}
          {item.tokenStats && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-400 mb-1">🎯 Token Statistics</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {item.tokenStats.promptTokens !== undefined && (
                  <div>
                    <span className="text-gray-500">Input:</span>
                    <span className="ml-2 text-blue-400 font-mono">
                      {item.tokenStats.promptTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {item.tokenStats.completionTokens !== undefined && (
                  <div>
                    <span className="text-gray-500">Output:</span>
                    <span className="ml-2 text-green-400 font-mono">
                      {item.tokenStats.completionTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {item.tokenStats.totalTokens !== undefined && (
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 text-yellow-400 font-mono">
                      {item.tokenStats.totalTokens.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              {item.tokenStats.completionTokens && duration > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Generation Speed: 
                  <span className="ml-1 text-cyan-400 font-mono">
                    {(item.tokenStats.completionTokens / (duration / 1000)).toFixed(1)} tokens/s
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Output */}
          {item.output && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-400">📤 Output</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyOutput();
                  }}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
              <div className="p-2 bg-gray-900/50 rounded text-xs text-gray-300 max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words font-mono">
                  {item.output.text || item.output.response || 
                   (item.output.value ? JSON.stringify(item.output.value, null, 2) : 'No output')}
                </pre>
              </div>
              {item.output.thinking && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                    💭 Show Thinking Process
                  </summary>
                  <div className="mt-1 p-2 bg-gray-900/30 rounded text-xs text-gray-400">
                    <pre className="whitespace-pre-wrap break-words font-mono">
                      {item.output.thinking}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: string | number; color: string }> = ({ 
  label, 
  value, 
  color 
}) => {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-900/20',
    yellow: 'text-yellow-400 bg-yellow-900/20',
    green: 'text-green-400 bg-green-900/20',
    red: 'text-red-400 bg-red-900/20',
    purple: 'text-purple-400 bg-purple-900/20',
    cyan: 'text-cyan-400 bg-cyan-900/20'
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

export default ExecutionManager;
