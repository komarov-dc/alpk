'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  actions,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Adjust position to keep menu within viewport
  const adjustedPosition = React.useMemo(() => {
    if (!isOpen) return position;

    const menuWidth = 240;
    const menuHeight = actions.length * 40 + 16; // Approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Adjust vertical position
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    return { x: Math.max(10, x), y: Math.max(10, y) };
  }, [isOpen, position, actions.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[240px]"
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
          }}
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {action.divider && index > 0 && (
                <div className="my-1 border-t border-gray-100" />
              )}
              <button
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                    onClose();
                  }
                }}
                disabled={action.disabled}
                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                  action.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {action.icon && (
                    <span className="text-gray-500 text-base">{action.icon}</span>
                  )}
                  <span>{action.label}</span>
                </div>
                {action.shortcut && (
                  <span className="text-xs text-gray-400 font-mono">
                    {action.shortcut}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
