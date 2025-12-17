'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '@/store/useFlowStore';
import { BaseNodeData } from '@/types';

interface NoteNodeData extends BaseNodeData {
  content?: string;
  text?: string;
  backgroundColor?: string;
  textColor?: string;
}

interface NoteNodeProps {
  id: string;
  data: NoteNodeData;
  selected?: boolean;
}

const NoteNodeComponent = memo(({ id, data, selected }: NoteNodeProps) => {
  const { updateNodeData, deleteNode } = useFlowStore();
  const [isEditingContent, setIsEditingContent] = useState(false);
  // Initialize from content field, fall back to text or empty string
  const [text, setText] = useState(data.content || data.text || '');

  // Update local state when data changes
  useEffect(() => {
    const newText = data.content || data.text || '';
    setText(newText);
  }, [data.content, data.text]);

  const handleDataChange = useCallback((updates: Partial<NoteNodeData>) => {
    updateNodeData(id, updates);
  }, [id, updateNodeData]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    // Save to content field
    handleDataChange({ content: value });
  }, [handleDataChange]);

  const handleDoubleClick = useCallback(() => {
    setIsEditingContent(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditingContent(false);
    // Save when exiting edit mode
    if (text.trim()) {
      handleDataChange({ content: text });
    }
  }, [text, handleDataChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditingContent(false);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enter to save and exit edit mode
      setIsEditingContent(false);
      if (text.trim()) {
        handleDataChange({ content: text });
      }
    }
    // Stop propagation for text editing keys
    if (isEditingContent) {
      e.stopPropagation();
    }
  }, [text, isEditingContent, handleDataChange]);

  // Main content slot
  const mainContent = (
    <div className="p-3">
      {/* Editing hint */}
      {isEditingContent && (
        <div className="text-xs text-yellow-600 mb-2">
          Ctrl+Enter to save
        </div>
      )}
      
      {/* Content */}
      <div 
        className="min-h-[60px] cursor-text"
        onDoubleClick={handleDoubleClick}
      >
        {isEditingContent ? (
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Write your note here..."
            className="w-full h-full min-h-[80px] bg-transparent border border-yellow-400 rounded px-2 py-1 outline-none resize-none text-sm font-mono"
            style={{ 
              color: data.textColor || '#92400e',
              borderStyle: 'dashed'
            }}
            autoFocus
          />
        ) : (
          <div 
            className="text-sm whitespace-pre-wrap break-words cursor-text min-h-[60px]"
            title="Double-click to edit"
          >
            {text || (
              <span className="opacity-50 italic">
                Double-click to add a note...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
  
  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      config={{
        title: 'Note',
        icon: <span className="text-yellow-600">📝</span>,
        minWidth: 200,
        minHeight: 100,
        maxWidth: 400,
        resizable: true,
        inputs: [
          { position: Position.Left }
        ],
        outputs: [
          { position: Position.Right }
        ],
        renamable: true,
        deletable: true,
        // Custom styles for note node
        className: 'note-node',
        headerClassName: 'bg-yellow-100 border-b-yellow-300',
        bodyClassName: 'bg-yellow-50'
      }}
      slots={{
        main: mainContent
      }}
      onDataChange={handleDataChange}
      onDelete={() => deleteNode(id)}
      onRename={(newName) => handleDataChange({ label: newName })}
    />
  );
});

NoteNodeComponent.displayName = 'NoteNode';
export const NoteNode = NoteNodeComponent;
