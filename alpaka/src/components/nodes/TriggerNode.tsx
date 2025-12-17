/**
 * Trigger Node Component
 * Polls API for new jobs and triggers workflow execution
 */

'use client';

import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Position } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { TriggerNodeData } from '@/types/nodeTypes';
import { useFlowStore } from '@/store/useFlowStore';

interface TriggerNodeProps {
  id: string;
  data: TriggerNodeData;
  selected?: boolean;
}

const TriggerNodeComponent: React.FC<TriggerNodeProps> = ({ id, data, selected }) => {
  const updateNodeData = useFlowStore(state => state.updateNodeData);
  const deleteNode = useFlowStore(state => state.deleteNode);
  const updateGlobalVariable = useFlowStore(state => state.updateGlobalVariable);
  const executeFlow = useFlowStore(state => state.executeFlow);
  
  // Local state
  const [isPolling, setIsPolling] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [foundJobs, setFoundJobs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Get config from environment variables (centralized in admin settings)
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:4000';
  const apiUrl = `${baseUrl}/api/external/jobs?status=queued`;
  const pollInterval = 10000; // 10 seconds
  const secretKey = process.env.NEXT_PUBLIC_ALPAKA_SECRET || '';
  
  // Poll for new jobs
  const checkForJobs = useCallback(async () => {
    try {
      setLastCheck(new Date());
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-Alpaka-Secret': secretKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      const jobs = result.jobs || [];
      
      if (jobs.length > 0) {
        // Found new job!
        const job = jobs[0];
        setFoundJobs(prev => prev + 1);
        setLastError(null);
        
        const jobId = job.jobId || job.id; // Support both formats
        console.log('✅ Trigger Node: Found new job', jobId);
        
        // Save job data to variables
        const responsesJson = JSON.stringify(job.responses || {}, null, 2);
        
        // Create/update variables (ensure values are strings)
        updateGlobalVariable('job_id', String(jobId || ''), 'Current processing job ID');
        updateGlobalVariable('job_session_id', String(job.sessionId || ''), 'Session ID from frontend');
        updateGlobalVariable('questionnaire_responses', responsesJson, 'Raw questionnaire responses as JSON');
        
        // Mark job as processing on frontend (if job has ID)
        if (jobId) {
          await fetch(`${baseUrl}/api/external/jobs/${jobId}`, {
            method: 'PATCH',
            headers: {
              'X-Alpaka-Secret': secretKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'processing' })
          });
        }
        
        // Trigger full flow execution (same as "Execute Flow" button in sidebar)
        // Pass false to keep existing variables (job_id, questionnaire_responses, etc.)
        await executeFlow(false);

        console.log('🚀 Trigger Node: Variables loaded, full flow execution started');
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMsg);
      console.error('❌ Trigger Node polling error:', error);
    }
  }, [apiUrl, baseUrl, secretKey, updateGlobalVariable, executeFlow]);
  
  // Start/stop polling
  const togglePolling = useCallback(() => {
    if (isPolling) {
      // Stop polling
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      setIsPolling(false);
    } else {
      // Start polling
      setIsPolling(true);
      setLastError(null);
      
      // Check immediately
      checkForJobs();
      
      // Then check every N seconds
      pollingInterval.current = setInterval(checkForJobs, pollInterval);
    }
  }, [isPolling, checkForJobs, pollInterval]);
  
  // Manual check
  const manualCheck = useCallback(() => {
    if (!isPolling) {
      checkForJobs();
    }
  }, [isPolling, checkForJobs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Main content
  const mainContent = (
    <div className="flex flex-col h-full space-y-3 p-3">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-gray-300">
            {isPolling ? 'Polling...' : 'Stopped'}
          </span>
        </div>
        
        {lastCheck && (
          <span className="text-xs text-gray-500">
            {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {/* API URL - Centralized Config Info */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">API Endpoint</label>
        <div className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-400 font-mono">
          {apiUrl}
        </div>
        <p className="text-xs text-gray-500">
          ℹ️ Configured in Admin Settings panel
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Jobs Found</div>
          <div className="text-lg font-bold text-green-400">{foundJobs}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Interval</div>
          <div className="text-lg font-bold text-blue-400">{pollInterval / 1000}s</div>
        </div>
      </div>
      
      {/* Error */}
      {lastError && (
        <div className="bg-red-900/30 border border-red-700 rounded p-2">
          <div className="text-xs text-red-300">{lastError}</div>
        </div>
      )}
      
      {/* Controls */}
      <div className="flex space-x-2">
        <button
          onClick={togglePolling}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
            isPolling
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isPolling ? '⏸ Stop' : '▶️ Start'} Polling
        </button>
        
        <button
          onClick={manualCheck}
          disabled={isPolling}
          className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔄 Check Now
        </button>
      </div>
      
      {/* Info */}
      <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
        <div>✓ Loads responses → <code className="bg-gray-800 px-1 rounded">questionnaire_responses</code></div>
        <div>✓ Saves job ID → <code className="bg-gray-800 px-1 rounded">job_id</code></div>
        <div>✓ Triggers downstream nodes</div>
      </div>
    </div>
  );
  
  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      config={{
        title: 'API Trigger',
        icon: <span className="text-yellow-400">⚡</span>,
        minWidth: 320,
        minHeight: 320,
        resizable: true,
        outputs: [
          { position: Position.Right, label: 'On Job Found' }
        ],
        renamable: true,
        deletable: true
      }}
      slots={{
        main: mainContent
      }}
      onDataChange={(updates) => updateNodeData(id, updates as Partial<TriggerNodeData>)}
      onDelete={() => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
        deleteNode(id);
      }}
      onRename={(newName) => updateNodeData(id, { label: newName })}
    />
  );
};

export const TriggerNode = memo(TriggerNodeComponent);
