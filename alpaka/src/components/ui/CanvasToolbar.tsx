'use client';

import { useReactFlow } from '@xyflow/react';

export type CursorMode = 'grab' | 'selection';

interface CanvasToolbarProps {
  cursorMode: CursorMode;
  onCursorModeChange: (mode: CursorMode) => void;
}

export const CanvasToolbar = ({ 
  cursorMode, 
  onCursorModeChange
}: CanvasToolbarProps) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-gray-800/90 border border-gray-700 rounded-lg shadow-xl p-2 flex items-center space-x-2">
        <div className="text-xs text-gray-400 px-2">Cursor Mode:</div>
        
        {/* Selection Mode - default */}
        <button
          onClick={() => onCursorModeChange('selection')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            cursorMode === 'selection'
              ? 'bg-blue-600 text-white border border-blue-500'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
          title="Select and move nodes (default mode)"
        >
          <span className="text-lg">🖱️</span>
          <span>Select</span>
        </button>

        {/* Grab/Pan Mode */}
        <button
          onClick={() => onCursorModeChange('grab')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            cursorMode === 'grab'
              ? 'bg-blue-600 text-white border border-blue-500'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
          title="Pan/Move canvas (grab mode)"
        >
          <span className="text-lg">✋</span>
          <span>Pan</span>
        </button>
        
        {/* Divider */}
        <div className="w-px h-8 bg-gray-600" />
        
        {/* Zoom Controls */}
        <button
          onClick={() => zoomOut()}
          className="px-2 py-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded-md transition-colors"
          title="Zoom out (Cmd + Scroll down)"
        >
          <span className="text-lg">➖</span>
        </button>
        
        <button
          onClick={() => zoomIn()}
          className="px-2 py-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded-md transition-colors"
          title="Zoom in (Cmd + Scroll up)"
        >
          <span className="text-lg">➕</span>
        </button>
        
        <button
          onClick={() => fitView({ padding: 0.2, duration: 200 })}
          className="px-2 py-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded-md transition-colors"
          title="Fit to view"
        >
          <span className="text-lg">🔍</span>
        </button>
      </div>
    </div>
  );
};
