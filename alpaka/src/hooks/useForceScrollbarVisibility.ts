/**
 * Hook to force scrollbar visibility on macOS
 * Works around the system preference that hides scrollbars
 */

import { useEffect, useRef } from 'react';

export const useForceScrollbarVisibility = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if we're on macOS
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (!isMac) return;

    // Force the container to always show scrollbars by adding a style tag
    const styleId = `force-scrollbar-${Math.random().toString(36).substr(2, 9)}`;
    const style = document.createElement('style');
    style.id = styleId;
    
    // Add aggressive CSS to force scrollbar visibility
    style.textContent = `
      #${container.id || 'node-content'}::-webkit-scrollbar {
        -webkit-appearance: none !important;
        width: 14px !important;
        height: 14px !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      #${container.id || 'node-content'}::-webkit-scrollbar-track {
        -webkit-appearance: none !important;
        background: rgba(17, 24, 39, 0.95) !important;
        border-radius: 7px !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      #${container.id || 'node-content'}::-webkit-scrollbar-thumb {
        -webkit-appearance: none !important;
        background: rgba(209, 213, 219, 0.9) !important;
        border-radius: 7px !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        opacity: 1 !important;
        visibility: visible !important;
        min-height: 50px !important;
      }
      
      #${container.id || 'node-content'}::-webkit-scrollbar-thumb:hover {
        background: rgba(229, 231, 235, 1) !important;
      }
    `;
    
    document.head.appendChild(style);
    
    // Also force a repaint to ensure scrollbar shows
    container.style.display = 'none';
    // Force reflow by reading offsetHeight
    void container.offsetHeight;
    container.style.display = '';
    
    // Clean up on unmount
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  return containerRef;
};