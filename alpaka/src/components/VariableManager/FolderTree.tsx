import React, { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { FolderNode } from '@/store/slices/variablesSlice';

interface FolderTreeProps {
  folders: FolderNode[];
  rootVariableCount: number;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  onCreateFolder: (path: string) => void;
  onRenameFolder: (path: string, newName: string) => void;
  onDeleteFolder: (path: string) => void;
  onMoveFolder?: (sourcePath: string, targetPath: string | null) => void;
}

interface TreeNodeProps {
  node: FolderNode;
  level: number;
  selectedFolder: string | null;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedFolder,
  expandedFolders,
  onToggle,
  onSelect,
  onContextMenu
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFolder === node.path;
  const hasChildren = node.children.length > 0;
  
  // Color system based on folder depth for better contrast
  const getFolderColor = (depth: number, isOpen: boolean) => {
    const colors = [
      { open: 'text-blue-400', closed: 'text-blue-500' },      // Level 1 - Blue
      { open: 'text-purple-400', closed: 'text-purple-500' },  // Level 2 - Purple
      { open: 'text-emerald-400', closed: 'text-emerald-500' },// Level 3 - Green
      { open: 'text-orange-400', closed: 'text-orange-500' },  // Level 4 - Orange
      { open: 'text-pink-400', closed: 'text-pink-500' },      // Level 5+ - Pink
    ];
    const colorIndex = Math.max(0, Math.min(depth - 1, colors.length - 1));
    const color = colors[colorIndex];
    if (!color) {
      // Fallback to default color
      return isOpen ? 'text-gray-400' : 'text-gray-500';
    }
    return isOpen ? color.open : color.closed;
  };

  return (
    <>
      <div
        className={`flex items-center px-2 py-1.5 cursor-pointer rounded transition-all duration-200 ${
          isSelected 
            ? 'bg-gradient-to-r from-blue-600/30 to-blue-600/10 border-l-2 border-blue-500 shadow-sm' 
            : 'hover:bg-gray-800/60 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.path)}
        onContextMenu={(e) => onContextMenu(e, node.path)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.path);
          }}
          className={`p-0.5 mr-1 ${!hasChildren ? 'invisible' : ''}`}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-3 h-3 text-gray-400" />
          )}
        </button>
        
        {isExpanded ? (
          <FolderOpenIcon className={`w-4 h-4 ${getFolderColor(level, true)} mr-2`} />
        ) : (
          <FolderIcon className={`w-4 h-4 ${getFolderColor(level, false)} mr-2`} />
        )}
        
        <span className={`text-sm flex-1 font-medium ${
          isSelected ? 'text-white' : 'text-gray-300'
        }`}>{node.name}</span>
        <span className={`text-xs ${
          isSelected ? 'text-blue-400 font-semibold' : 'text-gray-500'
        }`}>({node.variableCount})</span>
      </div>

      {isExpanded && node.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          level={level + 1}
          selectedFolder={selectedFolder}
          expandedFolders={expandedFolders}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  rootVariableCount,
  selectedFolder,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState<string | null>(null);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const parentPath = selectedFolder;
      const fullPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;
      onCreateFolder(fullPath);
      setNewFolderName('');
      setIsCreatingFolder(false);
      
      // Auto-expand parent folder
      if (parentPath) {
        const newExpanded = new Set(expandedFolders);
        newExpanded.add(parentPath);
        setExpandedFolders(newExpanded);
      }
    }
  };

  const handleRename = () => {
    if (renamingPath && renameValue.trim()) {
      onRenameFolder(renamingPath, renameValue);
      setRenamingPath(null);
      setRenameValue('');
    }
  };

  const handleMove = () => {
    if (movingPath && onMoveFolder) {
      // Prevent moving folder into itself or its children
      if (moveTargetPath && moveTargetPath.startsWith(movingPath)) {
        alert('Cannot move folder into itself or its subfolders');
        return;
      }
      onMoveFolder(movingPath, moveTargetPath);
      setMovingPath(null);
      setMoveTargetPath(null);
    }
  };

  // Get all folder paths for move dialog
  const getAllFolderPaths = (): string[] => {
    const paths: string[] = [];
    const collectPaths = (nodes: FolderNode[]) => {
      nodes.forEach(node => {
        paths.push(node.path);
        if (node.children.length > 0) {
          collectPaths(node.children);
        }
      });
    };
    collectPaths(folders);
    return paths;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-400">Folders</h3>
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + New Folder
        </button>
      </div>

      {/* New Folder Input */}
      {isCreatingFolder && (
        <div className="mb-2 p-2 bg-gray-800 rounded">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') {
                setIsCreatingFolder(false);
                setNewFolderName('');
              }
            }}
            placeholder="Folder name..."
            className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleCreateFolder}
              className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName('');
              }}
              className="px-2 py-0.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto">
        {/* Root folder */}
        <div
          className={`flex items-center px-2 py-1.5 cursor-pointer rounded transition-all duration-200 ${
            selectedFolder === null 
              ? 'bg-gradient-to-r from-amber-600/30 to-amber-600/10 border-l-2 border-amber-500 shadow-sm' 
              : 'hover:bg-gray-800/60 border-l-2 border-transparent'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <FolderIcon className="w-4 h-4 text-amber-500 mr-2 ml-5" />
          <span className={`text-sm flex-1 font-medium ${
            selectedFolder === null ? 'text-white' : 'text-gray-300'
          }`}>Root</span>
          <span className={`text-xs ${
            selectedFolder === null ? 'text-amber-400 font-semibold' : 'text-gray-500'
          }`}>({rootVariableCount})</span>
        </div>

        {/* Folder nodes */}
        {folders.map((folder) => (
          <TreeNode
            key={folder.path}
            node={folder}
            level={1}
            selectedFolder={selectedFolder}
            expandedFolders={expandedFolders}
            onToggle={toggleFolder}
            onSelect={onSelectFolder}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded shadow-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
              onClick={() => {
                setRenamingPath(contextMenu.path);
                const folder = folders.find(f => f.path === contextMenu.path);
                setRenameValue(folder?.name || '');
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <button
              className="px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
              onClick={() => {
                onSelectFolder(contextMenu.path);
                setIsCreatingFolder(true);
                setContextMenu(null);
              }}
            >
              New Subfolder
            </button>
            {onMoveFolder && (
              <button
                className="px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
                onClick={() => {
                  setMovingPath(contextMenu.path);
                  // Set current parent as default target
                  const parts = contextMenu.path.split('/');
                  if (parts.length > 1) {
                    parts.pop();
                    setMoveTargetPath(parts.join('/'));
                  } else {
                    setMoveTargetPath(null);
                  }
                  setContextMenu(null);
                }}
              >
                Move to...
              </button>
            )}
            <button
              className="px-3 py-1 text-sm text-red-400 hover:bg-gray-700 w-full text-left"
              onClick={() => {
                if (confirm(`Delete folder "${contextMenu.path}" and all its contents?`)) {
                  onDeleteFolder(contextMenu.path);
                }
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Rename Dialog */}
      {renamingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-white mb-2">Rename Folder</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setRenamingPath(null);
                  setRenameValue('');
                }
              }}
              className="w-full px-2 py-1 bg-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleRename}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setRenamingPath(null);
                  setRenameValue('');
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Folder Dialog */}
      {movingPath && onMoveFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 p-4 rounded-lg w-96">
            <h3 className="text-white mb-3">Move Folder</h3>
            <p className="text-sm text-gray-400 mb-3">
              Moving: <span className="text-blue-400 font-mono">{movingPath}</span>
            </p>
            
            <label className="block text-sm text-gray-300 mb-2">Select destination:</label>
            <select
              value={moveTargetPath || ''}
              onChange={(e) => setMoveTargetPath(e.target.value || null)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
            >
              <option value="">Root (no parent folder)</option>
              {getAllFolderPaths()
                .filter(path => {
                  // Don't show the moving folder itself or its children as targets
                  return path !== movingPath && !path.startsWith(movingPath + '/');
                })
                .map(path => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))
              }
            </select>
            
            <div className="flex gap-2">
              <button
                onClick={handleMove}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Move
              </button>
              <button
                onClick={() => {
                  setMovingPath(null);
                  setMoveTargetPath(null);
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
