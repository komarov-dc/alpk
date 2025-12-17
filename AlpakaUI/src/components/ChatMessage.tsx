'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/types/chat';
import { formatTimestamp } from '@/utils/formatters';
import { UserCircleIcon, CpuChipIcon } from '@heroicons/react/24/solid';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-4 p-6 ${isUser ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <UserCircleIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <CpuChipIcon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 dark:text-white">
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimestamp(message.timestamp)}
          </span>
          {message.metadata?.model && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
              {message.metadata.model}
            </span>
          )}
        </div>
        
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              pre: ({ children }) => (
                <div className="relative group">
                  <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto text-gray-900 dark:text-gray-100">
                    {children}
                  </pre>
                  <button
                    onClick={() => {
                      const extractText = (node: React.ReactNode): string => {
                        if (typeof node === 'string') return node;
                        if (React.isValidElement(node) && node.props.children) {
                          if (typeof node.props.children === 'string') {
                            return node.props.children;
                          }
                          if (Array.isArray(node.props.children)) {
                            return node.props.children.map(extractText).join('');
                          }
                          return extractText(node.props.children);
                        }
                        return '';
                      };
                      const text = extractText(children);
                      if (text) {
                        navigator.clipboard.writeText(text);
                      }
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              ),
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                return match ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm text-gray-900 dark:text-gray-100" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3 h-3" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
          {message.metadata?.processingTime && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {message.metadata.processingTime}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}