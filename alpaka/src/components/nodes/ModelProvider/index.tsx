// Modular Model Provider Node

'use client';

import React, { memo, useState, useCallback } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { useOllamaModels } from '@/hooks/useOllamaModels';
import { usePreventCanvasScroll } from '@/hooks/usePreventCanvasScroll';
import { useNodeContextMenu } from '@/hooks/useNodeContextMenu';
import { NodeContextMenu } from '@/components/ui/NodeContextMenu';
import { EditableNodeTitle } from '@/components/ui/EditableNodeTitle';

// Import modular components
import { ProviderSelector } from './ProviderSelector';
import { ModelSelector } from './ModelSelector';
import { GroupIdSelector } from './GroupIdSelector';
import { ParameterEditor } from './ParameterEditor';
import { 
  ModelProviderData, 
  ModelProvider,
  BaseModelProviderData 
} from './types';
import { getDefaultParameters } from './parameterSets';

interface ModelProviderNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ModelProviderNode = memo(({ id, data, selected }: ModelProviderNodeProps) => {
  const { updateNodeData, deleteNode, renameNode, duplicateNodes, nodes } = useFlowStore();
  const { models: ollamaModels, loading: modelsLoading, error: modelsError, refetch } = useOllamaModels();
  const preventCanvasScroll = usePreventCanvasScroll();
  const contextMenu = useNodeContextMenu();

  // Local state for UI
  const [activeTab, setActiveTab] = useState<'config' | 'parameters'>('config');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Merge data with defaults based on provider
  const getNodeData = (): ModelProviderData => {
    const provider = (data.provider || 'ollama') as ModelProvider;
    const baseData: BaseModelProviderData = {
      label: (data.label as string) || 'Model Provider',
      provider,
      model: (data.model as string) || '',
      groupId: (data.groupId as number) || 1,
      isCollapsed: (data.isCollapsed as boolean) ?? false
    };

    const defaultParams = getDefaultParameters(provider);
    
    // Merge with existing data, preserving user settings
    const mergedData = { ...defaultParams, ...data, ...baseData };
    
    return mergedData as ModelProviderData;
  };

  const nodeData = getNodeData();
  const isExpanded = !nodeData.isCollapsed;

  // Get existing group IDs from other ModelProvider nodes
  const getExistingGroups = useCallback((): number[] => {
    return nodes
      .filter(node => node.type === 'modelProvider' && node.id !== id)
      .map(node => node.data.groupId)
      .filter((groupId): groupId is number => typeof groupId === 'number');
  }, [nodes, id]);

  // Update field helper
  const updateField = useCallback((field: string, value: unknown) => {
    updateNodeData(id, { [field]: value });
  }, [id, updateNodeData]);

  // Handle provider change - reset parameters to defaults
  const handleProviderChange = useCallback((newProvider: ModelProvider) => {
    const defaultParams = getDefaultParameters(newProvider);
    updateNodeData(id, {
      provider: newProvider,
      model: '', // Reset model selection
      ...defaultParams
    });
  }, [id, updateNodeData]);

  // Handle parameter changes
  const handleParameterChange = useCallback((key: string, value: unknown) => {
    updateField(key, value);
  }, [updateField]);

  // Toggle collapsed state
  const toggleCollapsed = useCallback(() => {
    updateField('isCollapsed', !nodeData.isCollapsed);
  }, [nodeData.isCollapsed, updateField]);

  // Context menu actions
  const handleTitleChange = useCallback((newTitle: string) => {
    renameNode(id, newTitle);
  }, [id, renameNode]);

  const contextMenuActions = [
    {
      id: 'rename',
      label: 'Rename',
      onClick: () => setIsEditingTitle(true)
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      onClick: () => duplicateNodes([id])
    },
    {
      id: 'delete',
      label: 'Delete',
      onClick: () => deleteNode(id)
    }
  ];



  return (
    <div 
      className={`bg-gray-800 rounded-lg shadow-lg border-2 transition-all duration-200 ${
        selected ? 'border-purple-500 shadow-purple-200' : 'border-gray-200'
      }`}
      style={{ minWidth: '320px', maxWidth: '480px' }}
      onContextMenu={(e) => contextMenu.openContextMenu(e, id)}
      {...preventCanvasScroll}
    >
      {/* Header */}
      <div className="bg-gray-800 text-white p-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1">
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
            <EditableNodeTitle
              title={nodeData.label}
              onTitleChange={handleTitleChange}
              className="text-sm font-semibold text-white"
              isEditing={isEditingTitle}
              onEditingChange={setIsEditingTitle}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-purple-600 px-2 py-1 rounded font-medium">
              Group {nodeData.groupId}
            </span>
            <button
              onClick={toggleCollapsed}
              className="text-gray-300 hover:text-white transition-colors"
              title={isExpanded ? 'Collapse node' : 'Expand node'}
            >
              {isExpanded ? '⌃' : '⌄'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'config'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('parameters')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'parameters'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Parameters
            </button>
          </div>

          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <ProviderSelector
                value={nodeData.provider}
                onChange={handleProviderChange}
              />

              <ModelSelector
                provider={nodeData.provider}
                value={nodeData.model}
                onChange={(model) => updateField('model', model)}
                loading={modelsLoading}
                error={modelsError || undefined}
                onRetry={refetch}
                availableModels={ollamaModels}
              />

              <GroupIdSelector
                value={nodeData.groupId}
                onChange={(groupId) => updateField('groupId', groupId)}
                existingGroups={getExistingGroups()}
              />
            </div>
          )}

          {/* Parameters Tab */}
          {activeTab === 'parameters' && (
            <div className="max-h-96 overflow-y-auto">
              <ParameterEditor
                provider={nodeData.provider}
                parameters={nodeData as unknown as Record<string, unknown>}
                onParameterChange={handleParameterChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      <NodeContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={contextMenu.closeContextMenu}
        actions={contextMenuActions}
      />
    </div>
  );
});

ModelProviderNode.displayName = 'ModelProviderNode';
