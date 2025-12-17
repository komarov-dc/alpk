// Group ID Selector Component

import React from 'react';

interface GroupIdSelectorProps {
  value: number;
  onChange: (groupId: number) => void;
  disabled?: boolean;
  existingGroups?: number[]; // Show which groups are already in use
}

export const GroupIdSelector: React.FC<GroupIdSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  existingGroups = []
}) => {
  const isGroupInUse = (groupId: number): boolean => {
    return existingGroups.includes(groupId) && groupId !== value;
  };

  const getGroupStatus = (groupId: number): string => {
    if (groupId === value) return 'current';
    if (isGroupInUse(groupId)) return 'used';
    return 'available';
  };

  const getGroupStatusColor = (status: string): string => {
    switch (status) {
      case 'current': return 'text-blue-400';
      case 'used': return 'text-amber-400';
      case 'available': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getGroupStatusIcon = (status: string): string => {
    switch (status) {
      case 'current': return '🎯';
      case 'used': return '⚠️';
      case 'available': return '✅';
      default: return '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-2">
        Group ID
      </label>
      
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="1"
          max="9999"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-800"
          placeholder="1-9999"
        />
        
        <div className={`text-sm ${getGroupStatusColor(getGroupStatus(value))}`}>
          {getGroupStatusIcon(getGroupStatus(value))} 
          {getGroupStatus(value) === 'current' && 'Current'}
          {getGroupStatus(value) === 'used' && 'In Use'}
          {getGroupStatus(value) === 'available' && 'Available'}
        </div>
      </div>

      <div className="text-xs text-gray-400 mt-1">
        LLM nodes can reference this group to use these settings
      </div>

      {/* Show existing groups */}
      {existingGroups.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          <div>Existing groups: {existingGroups.filter(g => g !== value).join(', ')}</div>
        </div>
      )}

      {/* Quick group selection */}
      <div className="mt-2 flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map(groupId => (
          <button
            key={groupId}
            onClick={() => onChange(groupId)}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              groupId === value
                ? 'bg-purple-600 text-white border border-purple-500'
                : isGroupInUse(groupId)
                ? 'bg-amber-600 text-amber-100 border border-amber-500 hover:bg-amber-500'
                : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {groupId}
            {groupId === value && ' (current)'}
            {isGroupInUse(groupId) && ' (used)'}
          </button>
        ))}
      </div>
    </div>
  );
};
