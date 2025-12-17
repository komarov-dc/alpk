'use client';

import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store/useFlowStore';

export const EditableProjectTitle = () => {
  const { currentProject, updateProjectName } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const projectName = currentProject?.name || 'New Project';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setTempName(projectName);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const finalName = tempName.trim() || 'New Project';
    try {
      await updateProjectName(finalName);
      setIsEditing(false);
    } catch {
      // Error handled silently
    }
  };

  const handleCancel = () => {
    setTempName('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <div className="flex-1">
        <input
          ref={inputRef}
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="text-2xl font-bold text-white bg-transparent border-b-2 border-blue-400 focus:outline-none w-full min-w-0"
          placeholder="Enter project name..."
        />
        <p className="text-sm text-gray-400 mt-1">
          Press Enter to save, Escape to cancel
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 cursor-pointer" onClick={handleStartEdit}>
      <h1 className="text-2xl font-bold text-white hover:text-blue-400 transition-colors">
        {projectName}
      </h1>
      <p className="text-sm text-gray-400">
        Your AI workflow project • Click to rename
      </p>
    </div>
  );
};
