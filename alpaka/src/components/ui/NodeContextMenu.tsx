'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuAction } from '@/hooks/useNodeContextMenu';

interface NodeContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const NodeContextMenu = ({ isOpen, position, actions, onClose }: NodeContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      
      // Adjust position if menu would go off screen
      let adjustedX = position.x;
      let adjustedY = position.y;
      
      if (position.x + rect.width > window.innerWidth) {
        adjustedX = window.innerWidth - rect.width - 10;
      }
      
      if (position.y + rect.height > window.innerHeight) {
        adjustedY = window.innerHeight - rect.height - 10;
      }
      
      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [isOpen, position]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg py-1"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center space-x-2 transition-colors"
        >
          {action.icon && <span className="text-lg">{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
};
