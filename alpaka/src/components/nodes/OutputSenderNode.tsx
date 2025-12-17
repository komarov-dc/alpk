/**
 * Output Sender Node Component
 * Sends processed job results back to the backend API
 */

'use client';

import React, { useState, useCallback, memo, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { OutputSenderNodeData } from '@/types/nodeTypes';
import { useFlowStore } from '@/store/useFlowStore';

interface OutputSenderNodeProps {
  id: string;
  data: OutputSenderNodeData;
  selected?: boolean;
}

const OutputSenderNodeComponent: React.FC<OutputSenderNodeProps> = ({ id, data, selected }) => {
  const updateNodeData = useFlowStore(state => state.updateNodeData);
  const deleteNode = useFlowStore(state => state.deleteNode);
  const globalVariables = useFlowStore(state => state.globalVariables);
  
  // Local state
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  
  // Get config from environment variables (centralized in admin settings)
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:4000';
  const endpoint = '/api/external/jobs'; // Fixed endpoint path
  const secretKey = process.env.NEXT_PUBLIC_ALPAKA_SECRET || '';
  const method = data.config?.method || 'PATCH';
  
  // Get mapping configuration
  const jobIdVariable = data.mapping?.jobIdVariable || 'job_id';
  const statusVariable = data.mapping?.statusVariable || 'job_status';
  const reportsMapping = useMemo(() => data.mapping?.reports || {
    'Adapted Report': 'adapted_report',
    'Professional Report': 'professional_report',
    'Aggregate Score Profile': 'aggregate_score_profile'
  }, [data.mapping?.reports]);
  
  // Send results to backend
  const sendResults = useCallback(async () => {
    try {
      setIsSending(true);
      setLastError(null);
      
      // Get job ID from global variables
      const jobIdVar = globalVariables[jobIdVariable];
      const jobId = typeof jobIdVar === 'string' ? jobIdVar : jobIdVar?.value;
      if (!jobId) {
        throw new Error(`Job ID variable "${jobIdVariable}" not found`);
      }

      // Get session ID from global variables (required by UI)
      const sessionIdVar = globalVariables['job_session_id'];
      const sessionId = typeof sessionIdVar === 'string' ? sessionIdVar : sessionIdVar?.value;

      // Get status (default to "completed")
      const statusVar = globalVariables[statusVariable];
      const status = (typeof statusVar === 'string' ? statusVar : statusVar?.value) || 'completed';

      // Collect reports from global variables
      // Map to backend expected format with proper keys
      const reports: Record<string, unknown> = {};

      // Map from camelCase (UI) to "Title Case" (backend expected format)
      const reportMappings = [
        { backendKey: 'Adapted Report', variableName: reportsMapping.adaptedReport || reportsMapping['Adapted Report'] },
        { backendKey: 'Professional Report', variableName: reportsMapping.professionalReport || reportsMapping['Professional Report'] },
        { backendKey: 'Aggregate Score Profile', variableName: reportsMapping.aggregateScoreProfile || reportsMapping['Aggregate Score Profile'] }
      ];

      for (const mapping of reportMappings) {
        if (mapping.variableName) {
          const varData = globalVariables[mapping.variableName];
          const value = typeof varData === 'string' ? varData : varData?.value;
          if (value) {
            reports[mapping.backendKey] = value;
          }
        }
      }

      // Build URL
      const url = `${baseUrl}${endpoint}/${jobId}`;

      // Build payload with jobId and sessionId (required by UI)
      const payload: Record<string, unknown> = {
        jobId: jobId,
        sessionId: sessionId || undefined,
        status: status,
        completedAt: new Date().toISOString(),
      };

      // Add reports if configured - as nested object
      if (data.config?.includeReports !== false && Object.keys(reports).length > 0) {
        payload.reports = reports;
      }
      
      // Add custom fields if configured
      if (data.config?.customFields) {
        for (const [fieldName, variableName] of Object.entries(data.config.customFields)) {
          const varData = globalVariables[variableName];
          const value = typeof varData === 'string' ? varData : varData?.value;
          if (value !== undefined) {
            payload[fieldName] = value;
          }
        }
      }
      
      console.log('📤 Output Sender: Sending to', url, payload);
      
      // Send request
      const response = await fetch(url, {
        method: method,
        headers: {
          'X-Alpaka-Secret': secretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      setLastSent(new Date());
      setLastResponse(result);
      setLastError(null);
      
      // Update node data
      updateNodeData(id, {
        lastSent: new Date(),
        lastResponse: result,
        error: undefined
      });
      
      console.log('✅ Output Sender: Successfully sent', result);
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMsg);
      updateNodeData(id, {
        error: errorMsg
      });
      console.error('❌ Output Sender error:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [
    baseUrl, 
    endpoint, 
    secretKey, 
    method,
    jobIdVariable,
    statusVariable,
    reportsMapping,
    data.config,
    id,
    globalVariables,
    updateNodeData
  ]);
  
  // Manual send (for testing)
  const handleManualSend = useCallback(() => {
    sendResults().catch(console.error);
  }, [sendResults]);
  
  // Update config
  const handleConfigChange = useCallback((updates: Partial<OutputSenderNodeData['config']>) => {
    updateNodeData(id, {
      config: {
        ...data.config,
        ...updates
      }
    });
  }, [id, data.config, updateNodeData]);
  
  // Update mapping
  const handleMappingChange = useCallback((updates: Partial<OutputSenderNodeData['mapping']>) => {
    updateNodeData(id, {
      mapping: {
        ...data.mapping,
        ...updates
      }
    });
  }, [id, data.mapping, updateNodeData]);
  
  // Main content
  const mainContent = (
    <div className="flex flex-col h-full space-y-3 p-3">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isSending ? 'bg-blue-400 animate-pulse' : 
            lastError ? 'bg-red-400' : 
            lastSent ? 'bg-green-400' : 'bg-gray-500'
          }`} />
          <span className="text-xs text-gray-300">
            {isSending ? 'Sending...' : 
             lastError ? 'Error' :
             lastSent ? 'Sent' : 'Ready'}
          </span>
        </div>
        
        {lastSent && (
          <span className="text-xs text-gray-500">
            {lastSent.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {/* API Configuration - Centralized */}
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">API Endpoint</label>
          <div className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-400 font-mono">
            {baseUrl}{endpoint}
          </div>
          <p className="text-xs text-gray-500">
            ℹ️ Configured in Admin Settings panel
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Method</label>
            <select
              value={data.config?.method || 'PATCH'}
              onChange={(e) => handleConfigChange({ method: e.target.value as 'POST' | 'PATCH' | 'PUT' })}
              className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={data.config?.includeReports !== false}
                onChange={(e) => handleConfigChange({ includeReports: e.target.checked })}
                className="rounded"
              />
              <span>Include Reports</span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Variable Mapping */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <div className="text-xs font-semibold text-gray-300">Variable Mapping</div>
        
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Job ID Variable</label>
          <input
            type="text"
            value={data.mapping?.jobIdVariable || ''}
            onChange={(e) => handleMappingChange({ jobIdVariable: e.target.value })}
            placeholder="job_id"
            className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        
        {data.config?.includeReports !== false && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Report Variables</label>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <input
                type="text"
                value={data.mapping?.reports?.adaptedReport || ''}
                onChange={(e) => handleMappingChange({ 
                  reports: { ...data.mapping?.reports, adaptedReport: e.target.value } 
                })}
                placeholder="adapted_report"
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={data.mapping?.reports?.professionalReport || ''}
                onChange={(e) => handleMappingChange({ 
                  reports: { ...data.mapping?.reports, professionalReport: e.target.value } 
                })}
                placeholder="professional_report"
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={data.mapping?.reports?.aggregateScoreProfile || ''}
                onChange={(e) => handleMappingChange({ 
                  reports: { ...data.mapping?.reports, aggregateScoreProfile: e.target.value } 
                })}
                placeholder="aggregate_score_profile"
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 col-span-2"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Error */}
      {lastError && (
        <div className="bg-red-900/30 border border-red-700 rounded p-2">
          <div className="text-xs text-red-300 break-words">{lastError}</div>
        </div>
      )}
      
      {/* Success */}
      {lastSent && !lastError && (
        <div className="bg-green-900/30 border border-green-700 rounded p-2">
          <div className="text-xs text-green-300">Successfully sent to backend</div>
          {lastResponse && (
            <div className="text-xs text-gray-400 mt-1">
              Job: {(lastResponse as { job?: { id?: string } }).job?.id || 'N/A'}
            </div>
          )}
        </div>
      )}
      
      {/* Manual Send Button (for testing) */}
      <button
        onClick={handleManualSend}
        disabled={isSending}
        className="w-full px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
      >
        {isSending ? 'Sending...' : 'Send Now (Test)'}
      </button>
    </div>
  );
  
  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      config={{
        title: 'Output Sender',
        icon: <span className="text-blue-400">📤</span>,
        minWidth: 380,
        minHeight: 420,
        resizable: true,
        inputs: [
          { position: Position.Left, label: 'Data' }
        ],
        outputs: [],
        renamable: true,
        deletable: true
      }}
      slots={{
        main: mainContent
      }}
      onDataChange={(updates) => updateNodeData(id, updates as Partial<OutputSenderNodeData>)}
      onDelete={() => deleteNode(id)}
      onRename={(newName) => updateNodeData(id, { label: newName })}
    />
  );
};

export const OutputSenderNode = memo(OutputSenderNodeComponent);
