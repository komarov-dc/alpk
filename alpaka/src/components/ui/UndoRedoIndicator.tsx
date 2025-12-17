'use client';

import { useFlowStore } from '@/store/useFlowStore';

export const UndoRedoIndicator = () => {
  const { canUndo, canRedo, undo, redo } = useFlowStore();

  return (
    <div className="flex items-center space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-1 rounded text-xs transition-colors ${
          canUndo 
            ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
        title="Undo (Cmd+Z)"
      >
        ↶
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-1 rounded text-xs transition-colors ${
          canRedo 
            ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
        title="Redo (Cmd+Shift+Z)"
      >
        ↷
      </button>
    </div>
  );
};
