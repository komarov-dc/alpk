/**
 * Message Editor Component
 * Handles message creation, editing, and management for LLM nodes
 */

import React, { memo, useState, useCallback } from 'react';
import { VariableAutocompleteEnhanced } from '@/components/ui/VariableAutocompleteEnhanced';
import { VariableHighlightedText } from '@/components/ui/VariableHighlightedText';
import { motion, AnimatePresence } from 'framer-motion';

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MessageEditorProps {
  messages: Message[];
  onUpdateMessage: (index: number, updates: Partial<Message>) => void;
  onAddMessage: (role: Message['role']) => void;
  onDeleteMessage: (index: number) => void;
  onMoveMessage: (index: number, direction: 'up' | 'down') => void;
  nodeId?: string; // Pass through to VariableAutocompleteEnhanced
}

export const MessageEditor = memo(({
  messages,
  onUpdateMessage,
  onAddMessage,
  onDeleteMessage,
  onMoveMessage,
  nodeId
}: MessageEditorProps) => {
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  
  const getRoleColor = useCallback((role: Message['role']) => {
    switch (role) {
      case 'system': return 'text-purple-400';
      case 'assistant': return 'text-green-400';
      case 'user': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  }, []);
  
  const handleEditToggle = useCallback((index: number) => {
    setEditingMessageIndex(editingMessageIndex === index ? null : index);
  }, [editingMessageIndex]);
  
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="group"
          >
            {/* Message Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold ${getRoleColor(message.role)}`}>
                {message.role.toUpperCase()}
              </span>
              
              {/* Action Buttons */}
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => onMoveMessage(index, 'up')}
                  disabled={index === 0}
                  className="p-0.5 text-xs hover:bg-gray-600 rounded disabled:opacity-50 text-gray-300"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => onMoveMessage(index, 'down')}
                  disabled={index === messages.length - 1}
                  className="p-0.5 text-xs hover:bg-gray-600 rounded disabled:opacity-50 text-gray-300"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleEditToggle(index)}
                  className="p-0.5 text-xs hover:bg-gray-600 rounded text-gray-300"
                  title="Edit"
                >
                  ✏️
                </button>
                {messages.length > 1 && (
                  <button
                    onClick={() => onDeleteMessage(index)}
                    className="p-0.5 text-xs hover:bg-red-700 text-red-400 rounded"
                    title="Delete"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            
            {/* Message Content */}
            {editingMessageIndex === index ? (
              <div className="relative">
                <VariableAutocompleteEnhanced
                  value={message.content}
                  onChange={(content) => onUpdateMessage(index, { content })}
                  placeholder="Enter message content... Use @ for variables"
                  rows={4}
                  className="px-2 py-1 text-sm rounded resize-none max-h-32"
                  nodeId={nodeId}
                />
                <button
                  onClick={() => setEditingMessageIndex(null)}
                  className="absolute top-1 right-1 text-gray-400 hover:text-gray-200 text-xs px-1 py-0.5 bg-gray-700 rounded"
                >
                  ✓ Done
                </button>
              </div>
            ) : (
              <div 
                className="px-2 py-1 text-sm bg-gray-700 rounded cursor-text hover:bg-gray-600 text-gray-200 whitespace-pre-wrap break-words overflow-auto max-h-24 transition-colors"
                onClick={() => handleEditToggle(index)}
              >
                {message.content ? (
                  <VariableHighlightedText 
                    text={message.content}
                    showValues={false}
                    nodeId={nodeId}
                  />
                ) : (
                  <span className="text-gray-500 italic">Click to add content...</span>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Add Message Buttons */}
      <div className="flex gap-1 mt-3 pt-2 border-t border-gray-700">
        {(['system', 'user', 'assistant'] as const).map(role => (
          <button
            key={role}
            onClick={() => onAddMessage(role)}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors flex items-center gap-1"
          >
            <span className="text-[10px]">+</span>
            <span>{role}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

MessageEditor.displayName = 'MessageEditor';
