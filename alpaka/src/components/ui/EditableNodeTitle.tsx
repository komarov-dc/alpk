'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableNodeTitleProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  className?: string;
  placeholder?: string;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export const EditableNodeTitle = ({
  title,
  onTitleChange,
  className = '',
  placeholder = 'Enter title...',
  isEditing,
  onEditingChange
}: EditableNodeTitleProps) => {
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update temp title when title prop changes
  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmedTitle = tempTitle.trim();
    if (trimmedTitle && trimmedTitle !== title) {
      onTitleChange(trimmedTitle);
    } else if (!trimmedTitle) {
      // Revert to original title if empty
      setTempTitle(title);
    }
    onEditingChange(false);
  }, [tempTitle, title, onTitleChange, onEditingChange]);

  const handleCancel = useCallback(() => {
    setTempTitle(title);
    onEditingChange(false);
  }, [title, onEditingChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEditingChange(true);
  }, [onEditingChange]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={tempTitle}
        onChange={(e) => setTempTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`bg-white border border-gray-300 rounded px-2 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <h3
      className={`font-semibold text-white text-base cursor-pointer hover:text-gray-200 transition-colors ${className}`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {title || placeholder}
    </h3>
  );
};
