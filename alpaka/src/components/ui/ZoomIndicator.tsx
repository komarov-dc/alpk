'use client';

import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

export const ZoomIndicator = () => {
  const { getViewport } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  // Update zoom level periodically and show indicator when zoom changes
  useEffect(() => {
    const updateZoom = () => {
      try {
        const viewport = getViewport();
        const newZoom = viewport.zoom;
        
        if (Math.abs(newZoom - zoomLevel) > 0.01) {
          setZoomLevel(newZoom);
          setIsVisible(true);
          
          // Clear existing timeout
          if (hideTimeout) {
            clearTimeout(hideTimeout);
          }
          
          // Hide after 2 seconds of no zoom changes
          const timeout = setTimeout(() => {
            setIsVisible(false);
          }, 2000);
          
          setHideTimeout(timeout);
        }
      } catch {
        // React Flow might not be ready yet
      }
    };

    // Update immediately and then periodically
    updateZoom();
    const interval = setInterval(updateZoom, 50); // More frequent updates for smooth display
    
    return () => {
      clearInterval(interval);
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [getViewport, zoomLevel, hideTimeout]);

  // Listen for wheel events to show indicator during trackpad zoom
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setIsVisible(true);
        
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
        
        const timeout = setTimeout(() => {
          setIsVisible(false);
        }, 2000);
        
        setHideTimeout(timeout);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [hideTimeout]);

  const percentage = Math.round(zoomLevel * 100);
  
  // Format display for extreme zoom levels
  const getZoomDisplay = () => {
    if (percentage >= 100) {
      return `${percentage}%`;
    } else if (percentage >= 10) {
      return `${percentage}%`;
    } else if (percentage >= 1) {
      return `${percentage}%`;
    } else {
      // For very small zooms, show with decimal
      return `${(zoomLevel * 100).toFixed(1)}%`;
    }
  };

  return (
    <div
      className={`zoom-indicator transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg border border-gray-600">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-mono font-medium">
            🔍 {getZoomDisplay()}
          </span>
          {percentage !== 100 && (
            <span className="text-xs text-gray-400">
              {percentage > 100 ? 'Zoomed In' : percentage < 5 ? 'Bird\'s Eye' : percentage < 10 ? 'Far Out' : 'Zoomed Out'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
