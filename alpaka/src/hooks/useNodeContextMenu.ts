'use client';

import { useState, useCallback, useEffect } from 'react';

interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
}

export const useNodeContextMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [nodeId, setNodeId] = useState<string | null>(null);

  const openContextMenu = useCallback((event: React.MouseEvent, targetNodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setPosition({ x: event.clientX, y: event.clientY });
    setNodeId(targetNodeId);
    setIsOpen(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    setIsOpen(false);
    setNodeId(null);
  }, []);

  // Close context menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeContextMenu]);

  return {
    isOpen,
    position,
    nodeId,
    openContextMenu,
    closeContextMenu
  };
};
