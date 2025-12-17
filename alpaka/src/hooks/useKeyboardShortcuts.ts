'use client';

import { useEffect } from 'react';

interface KeyboardShortcutConfig {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcutConfig[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true' ||
                          target.getAttribute('role') === 'textbox';
      
      if (isInputField) return;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = !!shortcut.metaKey === !!e.metaKey;
        const ctrlMatch = !!shortcut.ctrlKey === !!e.ctrlKey;
        const shiftMatch = !!shortcut.shiftKey === !!e.shiftKey;
        const altMatch = !!shortcut.altKey === !!e.altKey;

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Utility function to detect Mac
export const isMac = typeof window !== 'undefined' && 
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
