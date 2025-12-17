import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowStore } from '@/store/useFlowStore';
import { FolderTree } from './FolderTree';
import type { GlobalVariable } from '@/store/slices/variablesSlice';
import { 
  isImportedVariable,
  isWorkflowVariable,
  getPendingVariables,
  findMissingVariables,
  getTypeIndicator
} from '@/utils/variableCategories';

interface VariableManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Variable list item component - memoized for performance
const VariableListItem = memo(function VariableListItem({ 
  name, 
  variable, 
  isSelected,
  isFromInput,
  isChecked,
  onSelect, 
  onCopyReference,
  onMoveToFolder,
  onCheckChange,
  hideCheckbox = false,
  variableCategory = 'default'
}: {
  name: string;
  variable: { value: string; type?: string; description?: string; folder?: string };
  isSelected: boolean;
  isFromInput: boolean;
  isChecked: boolean;
  onSelect: (name: string) => void;
  onCopyReference: (name: string) => void;
  onMoveToFolder: (name: string) => void;
  onCheckChange: (name: string, checked: boolean) => void;
  hideCheckbox?: boolean;
  variableCategory?: 'imported' | 'created' | 'completed' | 'pending' | 'missing' | 'default';
}) {
  const typeInfo = getTypeIndicator(variable.type);
  
  // Determine the color scheme based on category
  let categoryColor = {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-700',
    icon: ''
  };
  
  switch (variableCategory) {
    case 'imported':
      categoryColor = { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-900', icon: '📥' };
      break;
    case 'created':
      categoryColor = { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-900', icon: '✏️' };
      break;
    case 'completed':
      categoryColor = { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-900', icon: '✅' };
      break;
    case 'pending':
      categoryColor = { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-900', icon: '⏳' };
      break;
    case 'missing':
      categoryColor = { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-900', icon: '⚠️' };
      break;
  }
  
  return (
    <div
      className={`p-3 rounded transition-colors mb-2 ${
        isSelected
          ? 'bg-blue-600/20 border border-blue-500'
          : `${categoryColor.bg} hover:opacity-80 border ${categoryColor.border}`
      }`}
    >
      <div className="flex items-start gap-3">
        {!hideCheckbox && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCheckChange(name, e.target.checked);
            }}
            className="mt-1 cursor-pointer"
          />
        )}
        <div
          className="flex-1 flex justify-between items-start cursor-pointer"
          onClick={() => onSelect(name)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
            {categoryColor.icon && (
              <span className={categoryColor.text}>{categoryColor.icon}</span>
            )}
            <div className="font-medium text-white truncate">{name}</div>
            <span className={`text-xs px-1.5 py-0.5 ${typeInfo.bg} ${typeInfo.color} rounded font-mono`} title={`Type: ${variable.type || 'string'}`}>
              {typeInfo.icon}
            </span>
            {isFromInput && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded" title="From Input Node">
                Input
              </span>
            )}
            {variable.folder && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded" title={variable.folder}>
                📁 {variable.folder.split('/').pop()}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-1 truncate">
            {variable.description || 'No description'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {variable.value.length} characters
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveToFolder(name);
            }}
            className="text-gray-400 hover:text-white p-1"
            title="Move to folder"
          >
            📁
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopyReference(name);
            }}
            className="text-gray-400 hover:text-white p-1"
            title="Copy variable reference"
          >
            📋
          </button>
        </div>
      </div>
    </div>
  </div>
  );
});

export const VariableManager: React.FC<VariableManagerProps> = ({ isOpen, onClose }) => {
  const { 
    globalVariables, 
    addGlobalVariable, 
    updateGlobalVariable, 
    deleteGlobalVariable,
    moveVariableToFolder,
    getVariablesByFolder,
    getFolderStructure,
    clearWorkflowVariables,
    resetAllLLMNodes,
    nodes,
    edges,
    executionResults,
    setExecutionResults,
    updateNodeData,
  } = useFlowStore();
  
  
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingVariable, setMovingVariable] = useState<string | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'global' | 'workflow' | 'missing'>('all');
  const [globalSubTab, setGlobalSubTab] = useState<'all' | 'imported' | 'created'>('all');
  const [workflowSubTab, setWorkflowSubTab] = useState<'all' | 'completed' | 'pending'>('all');
  
  // Get folder structure (recompute when variables change)
  const folderStructure = useMemo(() => {
    return getFolderStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalVariables, getFolderStructure]);
  
  // Get all folder paths for move dialog
  const getAllFolderPaths = useCallback(() => {
    const paths = new Set<string>();
    // Use Object.keys iteration instead of Object.values due to Zustand proxy
    Object.keys(globalVariables).forEach(key => {
      const v = globalVariables[key];
      if (v && v.folder) {
        // Add this folder and all parent folders
        const parts = v.folder.split('/');
        let currentPath = '';
        parts.forEach((part, index) => {
          currentPath = index === 0 ? part : `${currentPath}/${part}`;
          paths.add(currentPath);
        });
      }
    });
    return Array.from(paths).sort();
  }, [globalVariables]);
  

  // Get workflow/session variables using unified categorization
  const workflowVariables = useMemo(() => {
    const completed: GlobalVariable[] = [];
    const pending: GlobalVariable[] = [];
    
    // Get completed workflow variables
    Object.keys(globalVariables).forEach(key => {
      const variable = globalVariables[key];
      if (!variable) return;
      
      if (isWorkflowVariable(key, variable)) {
        completed.push({
          ...variable,
          name: key.startsWith('workflow:') ? key.replace('workflow:', '') : key
        });
      }
    });
    
    // Get pending variables (nodes connected but not executed)
    nodes.forEach(node => {
      const pendingVars = getPendingVariables(node.id, edges, nodes, executionResults);
      pendingVars.forEach(varName => {
        // Check if this variable doesn't already exist
        if (!globalVariables[varName] && !globalVariables[`workflow:${varName}`]) {
          pending.push({
            name: varName,
            value: '[Pending execution]',
            type: 'string',
            description: '⏳ Will be available after node execution'
          });
        }
      });
    });
    
    return { completed, pending, all: [...completed, ...pending] };
  }, [globalVariables, nodes, edges, executionResults]);
  
  // Get global variables using unified categorization
  const globalVariablesByType = useMemo(() => {
    const imported: GlobalVariable[] = [];
    const created: GlobalVariable[] = [];
    
    Object.keys(globalVariables).forEach(key => {
      const variable = globalVariables[key];
      if (!variable) return;
      
      // Skip workflow variables
      if (isWorkflowVariable(key, variable)) return;
      
      // Skip empty folder placeholders
      if (variable.description?.includes('Empty folder placeholder')) return;
      
      if (isImportedVariable(variable)) {
        imported.push({ ...variable, name: key });
      } else {
        created.push({ ...variable, name: key });
      }
    });
    
    return { 
      imported, 
      created, 
      all: [...imported, ...created] 
    };
  }, [globalVariables]);
  
  // Get missing variables using unified categorization
  const missingVariables = useMemo(() => {
    const missingVars = findMissingVariables(nodes, globalVariables);
    const result: GlobalVariable[] = [];
    
    missingVars.forEach((referencingNodes, varName) => {
      result.push({
        name: varName,
        value: '[Variable not found]',
        type: 'string',
        description: `⚠️ Referenced in: ${referencingNodes.join(', ')}`
      });
    });
    
    return result;
  }, [globalVariables, nodes]);

  // Get variables for current folder and tab
  const folderVariables = useMemo(() => {
    let vars: GlobalVariable[] = [];
    
    if (activeTab === 'workflow') {
      // Show workflow/session variables based on sub-tab (ignore folder)
      if (workflowSubTab === 'completed') {
        vars = workflowVariables.completed;
      } else if (workflowSubTab === 'pending') {
        vars = workflowVariables.pending;
      } else {
        vars = workflowVariables.all;
      }
    } else if (activeTab === 'global') {
      // Show global variables based on sub-tab (ignore folder)
      if (globalSubTab === 'imported') {
        vars = globalVariablesByType.imported;
      } else if (globalSubTab === 'created') {
        vars = globalVariablesByType.created;
      } else {
        vars = globalVariablesByType.all;
      }
    } else if (activeTab === 'missing') {
      // Show missing variables (ignore folder)
      vars = missingVariables;
    } else {
      // 'all' tab - Show all variables filtered by selected folder
      vars = getVariablesByFolder(selectedFolder);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return vars.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.value.toLowerCase().includes(query) ||
        (v.description?.toLowerCase().includes(query) ?? false)
      );
    }
    return vars;
  }, [selectedFolder, searchQuery, getVariablesByFolder, activeTab, globalSubTab, workflowSubTab, workflowVariables, missingVariables, globalVariablesByType]);
  
  // Clear selection when folder, search or tab changes
  useEffect(() => {
    setSelectedVariables(new Set());
  }, [selectedFolder, searchQuery, activeTab]);
  
  // Get input node variables for comparison
  const inputNodeVariables = useMemo(() => {
    const inputVars: Record<string, string> = {};
    nodes.filter(n => n.type === 'input').forEach(node => {
      if (node.data?.value && typeof node.data.value === 'string') {
        const varName = (node.data.label as string) || `input_${node.id.slice(-6)}`;
        inputVars[varName] = node.data.value;
      }
    });
    return inputVars;
  }, [nodes]);
  
  // Count variables in root folder
  const rootVariableCount = useMemo(() => {
    // Use Object.keys iteration instead of Object.values due to Zustand proxy
    let count = 0;
    Object.keys(globalVariables).forEach(key => {
      const v = globalVariables[key];
      if (v && !v.folder && !key.startsWith('workflow:')) {
        count++;
      }
    });
    return count;
  }, [globalVariables]);
  
  // Get variable statistics
  const variableStats = useMemo(() => {
    const total = Object.keys(globalVariables).length;
    const imported = globalVariablesByType.imported.length;
    const created = globalVariablesByType.created.length;
    const workflow = workflowVariables.all.length;
    const pending = workflowVariables.pending.length;
    const missing = missingVariables.length;
    
    return { total, imported, created, workflow, pending, missing };
  }, [globalVariables, globalVariablesByType, workflowVariables, missingVariables]);
  
  // Handle folder operations
  const handleCreateFolder = useCallback((path: string) => {
    // Create a minimal placeholder variable to make folder visible
    // Using . prefix to make it sort to the top and be less intrusive
    const placeholderName = `.folder_${path.replace(/\//g, '_')}`;
    addGlobalVariable(
      placeholderName, 
      '', 
      '📁 Empty folder placeholder - safe to delete after adding real variables', 
      path
    );
    // Select the new folder
    setSelectedFolder(path);
  }, [addGlobalVariable]);
  
  const handleRenameFolder = useCallback((oldPath: string, newName: string) => {
    // Update all variables in this folder and subfolders
    Object.entries(globalVariables).forEach(([name, variable]) => {
      if (variable.folder?.startsWith(oldPath)) {
        const newPath = variable.folder.replace(oldPath, newName);
        updateGlobalVariable(name, variable.value, variable.description, newPath);
      }
    });
  }, [globalVariables, updateGlobalVariable]);
  
  const handleDeleteFolder = useCallback((path: string) => {
    // Move all variables from this folder to root
    Object.entries(globalVariables).forEach(([name, variable]) => {
      if (variable.folder?.startsWith(path)) {
        updateGlobalVariable(name, variable.value, variable.description, undefined);
      }
    });
    if (selectedFolder?.startsWith(path)) {
      setSelectedFolder(null);
    }
  }, [globalVariables, updateGlobalVariable, selectedFolder]);
  
  const handleMoveFolder = useCallback((sourcePath: string, targetPath: string | null) => {
    // Build new path for the folder
    const folderName = sourcePath.split('/').pop();
    const newPath = targetPath ? `${targetPath}/${folderName}` : folderName;
    
    // Update all variables in this folder and subfolders
    Object.entries(globalVariables).forEach(([name, variable]) => {
      if (variable.folder === sourcePath) {
        // Variables directly in the moving folder
        updateGlobalVariable(name, variable.value, variable.description, newPath);
      } else if (variable.folder?.startsWith(sourcePath + '/')) {
        // Variables in subfolders
        const relativePath = variable.folder.substring(sourcePath.length);
        const newFullPath = newPath + relativePath;
        updateGlobalVariable(name, variable.value, variable.description, newFullPath);
      }
    });
    
    // Update selected folder if it was moved
    if (selectedFolder === sourcePath) {
      setSelectedFolder(newPath || null);
    } else if (selectedFolder?.startsWith(sourcePath + '/')) {
      const relativePath = selectedFolder.substring(sourcePath.length);
      setSelectedFolder(newPath + relativePath);
    }
  }, [globalVariables, updateGlobalVariable, selectedFolder]);
  
  // Move variable to folder
  const handleMoveVariable = useCallback((variableName: string) => {
    setMovingVariable(variableName);
    const variable = globalVariables[variableName];
    setMoveTargetFolder(variable?.folder || null);
    setShowMoveDialog(true);
  }, [globalVariables]);
  
  const confirmMove = useCallback(() => {
    if (movingVariable) {
      moveVariableToFolder(movingVariable, moveTargetFolder);
      setShowMoveDialog(false);
      setMovingVariable(null);
    }
  }, [movingVariable, moveTargetFolder, moveVariableToFolder]);
  
  // Toggle variable selection
  const toggleVariableSelection = useCallback((name: string, checked: boolean) => {
    const newSelection = new Set(selectedVariables);
    if (checked) {
      newSelection.add(name);
    } else {
      newSelection.delete(name);
    }
    setSelectedVariables(newSelection);
  }, [selectedVariables]);
  
  // Select/deselect all visible variables
  const toggleSelectAll = useCallback(() => {
    if (selectedVariables.size === folderVariables.length) {
      setSelectedVariables(new Set());
    } else {
      setSelectedVariables(new Set(folderVariables.map(v => v.name)));
    }
  }, [selectedVariables, folderVariables]);
  
  // Bulk move operation
  const bulkMoveVariables = useCallback(() => {
    selectedVariables.forEach(varName => {
      moveVariableToFolder(varName, moveTargetFolder);
    });
    setSelectedVariables(new Set());
    setShowBulkMoveDialog(false);
  }, [selectedVariables, moveTargetFolder, moveVariableToFolder]);
  
  // Handle session variable deletion with node cleanup
  const deleteSessionVariable = useCallback((varName: string) => {
    // Find the node that created this variable
    const workflowVarName = varName.startsWith('workflow:') ? varName : `workflow:${varName}`;
    
    // Try to clear the workflow variable if it exists
    if (globalVariables[workflowVarName]) {
      deleteGlobalVariable(workflowVarName);
    }
    
    // Find and reset the node that generated this variable
    nodes.forEach(node => {
      // Check if this node's output matches the variable name
      const nodeLabel = node.data?.label || node.id;
      const shouldReset = nodeLabel === varName || 
                          node.id === varName ||
                          node.data?.outputVariable === varName;
      
      if (shouldReset) {
        // Create a clean copy of node data without execution results
        const cleanData: Record<string, unknown> = { ...node.data };
        
        // Remove execution-related fields based on node type
        if (node.data?.type === 'basicLLMChain' || node.type === 'basicLLMChain') {
          // For LLM nodes
          delete cleanData.response;
          delete cleanData.lastExecutionResult;
          delete cleanData.thinking;
        }
        
        // Clear common execution fields
        delete cleanData.result;
        delete cleanData.lastResult;
        delete cleanData.lastError;
        delete cleanData.executionStats;
        
        // Reset loading and error states
        cleanData.isLoading = false;
        cleanData.error = undefined;
        cleanData.isExecuting = false;
        
        // Update the node with cleaned data
        updateNodeData(node.id, cleanData as Partial<typeof node.data>);
      }
    });
  }, [deleteGlobalVariable, nodes, updateNodeData, globalVariables]);

  // Bulk delete operation
  const bulkDeleteVariables = useCallback(() => {
    if (confirm(`Delete ${selectedVariables.size} selected variables?`)) {
      selectedVariables.forEach(varName => {
        // Check if it's a workflow variable
        if (activeTab === 'workflow') {
          deleteSessionVariable(varName);
        } else if (activeTab !== 'missing') {
          // For global and all tabs, check if the variable exists with or without workflow: prefix
          const workflowVarName = `workflow:${varName}`;
          
          // Try to delete both the regular name and workflow: prefixed name
          if (globalVariables[varName]) {
            deleteGlobalVariable(varName);
          }
          if (globalVariables[workflowVarName]) {
            deleteGlobalVariable(workflowVarName);
          }
        }
      });
      setSelectedVariables(new Set());
    }
  }, [selectedVariables, deleteGlobalVariable, deleteSessionVariable, activeTab, globalVariables]);
  
  // Copy variable reference
  const copyVariableReference = useCallback((name: string) => {
    navigator.clipboard.writeText(`{{${name}}}`);
  }, []);
  
  // Select variable for editing
  const selectVariable = useCallback((name: string) => {
    // For workflow variables, need to check with workflow: prefix
    const isWorkflowVar = activeTab === 'workflow';
    const actualVarName = isWorkflowVar && !name.startsWith('workflow:') 
      ? `workflow:${name}` 
      : name;
    
    const variable = globalVariables[actualVarName];
    if (!variable) {
      // Handle pending/missing variables that don't exist yet
      if (activeTab === 'workflow' || activeTab === 'missing') {
        setSelectedVariable(name);
        setEditingName(name);
        setEditingValue('[Not available]');
        setEditingDescription('Variable does not exist yet');
        return;
      }
      return;
    }
    
    // Store the display name (without workflow: prefix for workflow vars)
    const displayName = isWorkflowVar && actualVarName.startsWith('workflow:') 
      ? actualVarName.replace('workflow:', '')
      : name;
    
    setSelectedVariable(displayName);
    setEditingName(displayName);
    setEditingValue(variable.value);
    setEditingDescription(variable.description || '');
  }, [globalVariables, activeTab]);
  
  // Save changes to selected variable
  const saveVariable = useCallback(() => {
    if (!selectedVariable || !editingName) return;
    
    // Handle workflow variables differently
    const isWorkflowVar = selectedVariable.startsWith('workflow:') || activeTab === 'workflow';
    const actualVarName = isWorkflowVar && !selectedVariable.startsWith('workflow:') 
      ? `workflow:${selectedVariable}` 
      : selectedVariable;
    
    const variable = globalVariables[actualVarName];
    if (!variable && activeTab !== 'missing') return;
    
    const folder = variable?.folder;
    
    // If name changed, we need to delete old and create new
    if (selectedVariable !== editingName) {
      if (isWorkflowVar) {
        deleteSessionVariable(selectedVariable);
        const newName = editingName.startsWith('workflow:') ? editingName : `workflow:${editingName}`;
        addGlobalVariable(newName, editingValue, editingDescription, folder);
        setSelectedVariable(editingName);
      } else {
        deleteGlobalVariable(selectedVariable);
        addGlobalVariable(editingName, editingValue, editingDescription, folder);
        setSelectedVariable(editingName);
      }
    } else {
      if (isWorkflowVar) {
        const workflowName = actualVarName;
        updateGlobalVariable(workflowName, editingValue, editingDescription, folder);
      } else {
        updateGlobalVariable(editingName, editingValue, editingDescription, folder);
      }
    }
  }, [selectedVariable, editingName, editingValue, editingDescription, 
      addGlobalVariable, updateGlobalVariable, deleteGlobalVariable, deleteSessionVariable, 
      globalVariables, activeTab]);
  
  // Create new variable
  const createNewVariable = useCallback(() => {
    const newName = `new_variable_${Date.now()}`;
    addGlobalVariable(newName, '', 'New variable', selectedFolder || undefined);
    selectVariable(newName);
  }, [addGlobalVariable, selectVariable, selectedFolder]);
  
  // Import files with folder support
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Track imported names to avoid duplicates
    const importedNames = new Set<string>();
    let processedCount = 0;
    
    // Ask user to select target folder
    const targetFolder = files.length > 1
      ? prompt(
          `Importing ${files.length} files\n\n` +
          'Enter folder path (optional):\n' +
          '• Leave empty to import into root\n' +
          '• Use "/" to create folders (e.g., "prompts/characters")'
        )
      : prompt(
          `Importing "${files[0]?.name || 'file'}"\n\n` +
          'Enter folder path (optional):\n' +
          '• Leave empty to import into root\n' +
          '• Use "/" to create folders (e.g., "prompts/characters")'
        );
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        // Skip empty or too large files
        if (!content || content.length > 1000000) {
          return;
        }
        
        // Generate unique variable name
        const baseVarName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        let varName = baseVarName;
        let counter = 1;
        
        // Check for duplicates
        const fullPath = targetFolder ? `${targetFolder}/${varName}` : varName;
        while (importedNames.has(fullPath) || globalVariables[varName]) {
          varName = `${baseVarName}_${counter}`;
          const newFullPath = targetFolder ? `${targetFolder}/${varName}` : varName;
          if (!importedNames.has(newFullPath)) {
            break;
          }
          counter++;
        }
        
        importedNames.add(targetFolder ? `${targetFolder}/${varName}` : varName);
        
        addGlobalVariable(
          varName,
          content,
          `Imported from: ${file.name}`,
          targetFolder || undefined
        );
        
        processedCount++;
      };
      
      reader.readAsText(file);
    });
    
    // Clear the input
    e.target.value = '';
    
    // Show feedback
    setTimeout(() => {
      const message = files.length === 1
        ? `File "${files[0]?.name || 'file'}" imported successfully!`
        : `${processedCount} files imported successfully!`;
      alert(message);
    }, 300);
  }, [addGlobalVariable, globalVariables]);
  
  // Import folder with structure preservation
  const handleFolderImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Track imported files for better naming
    const importedNames = new Set<string>();
    let skippedCount = 0;
    
    // Get the common root folder from the first file
    const firstFile = files[0] as File & { webkitRelativePath?: string };
    const firstPath = firstFile.webkitRelativePath || firstFile.name;
    const rootFolder = firstPath.split('/')[0];
    
    // Ask if user wants to import into a specific folder
    const targetFolder = prompt(
      `Importing folder "${rootFolder}"\n\n` +
      'Enter target folder name (optional):\n' +
      '• Leave empty to import into root\n' +
      '• Enter name (e.g., "prompts") to import under that folder'
    );
    
    // Supported text file extensions
    const textExtensions = [
      '.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv', 
      '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.html', 
      '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.sql',
      '.sh', '.bash', '.zsh', '.env', '.gitignore', '.toml', '.ini'
    ];
    
    // Process each file
    Array.from(files).forEach(file => {
      const fileWithPath = file as File & { webkitRelativePath?: string };
      const relativePath = fileWithPath.webkitRelativePath || file.name;
      
      // Check if file has a supported extension
      const hasTextExtension = textExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      ) || file.type.startsWith('text/');
      
      if (!hasTextExtension) {
        skippedCount++;
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        // Skip empty or too large files
        if (!content || content.length > 1000000) { // 1MB limit
          skippedCount++;
          return;
        }
        
        // Extract path components
        const pathParts = relativePath.split('/');
        const fileName = pathParts.pop() || 'unknown';
        const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        
        // Remove the root folder from path if it matches
        if (pathParts[0] === rootFolder) {
          pathParts.shift();
        }
        
        // Build folder path
        let folderPath: string | undefined;
        if (targetFolder && pathParts.length > 0) {
          folderPath = `${targetFolder}/${pathParts.join('/')}`;
        } else if (targetFolder) {
          folderPath = targetFolder;
        } else if (pathParts.length > 0) {
          folderPath = pathParts.join('/');
        }
        
        // Generate unique variable name
        const varName = fileNameWithoutExt;
        let counter = 1;
        let finalName = varName;
        
        // Check for duplicates considering the folder
        const fullPath = folderPath ? `${folderPath}/${varName}` : varName;
        while (importedNames.has(fullPath) || globalVariables[finalName]) {
          finalName = `${varName}_${counter}`;
          const newFullPath = folderPath ? `${folderPath}/${finalName}` : finalName;
          if (!importedNames.has(newFullPath)) {
            break;
          }
          counter++;
        }
        
        importedNames.add(folderPath ? `${folderPath}/${finalName}` : finalName);
        
        // Add the variable
        addGlobalVariable(
          finalName,
          content,
          `Imported from: ${relativePath}`,
          folderPath
        );
      };
      
      reader.onerror = () => {
        skippedCount++;
      };
      
      reader.readAsText(file);
    });
    
    // Clear the input
    e.target.value = '';
    
    // Show feedback after a short delay
    setTimeout(() => {
      const totalFiles = files.length;
      const message = `Import complete!\n\n` +
        `📁 Folder: ${rootFolder}\n` +
        `✅ Files to process: ${totalFiles - skippedCount}\n` +
        `⏭️ Skipped (non-text): ${skippedCount}\n\n` +
        `Files are being imported with preserved folder structure.`;
      alert(message);
    }, 500);
  }, [addGlobalVariable, globalVariables]);
  
  // Export variables
  const exportVariables = useCallback(() => {
    const dataStr = JSON.stringify(globalVariables, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alpaka_variables_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [globalVariables]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-900 rounded-lg shadow-2xl w-[98vw] h-[95vh] flex flex-col border border-gray-800"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '98vw', maxHeight: '95vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Variable Manager</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">
                  {variableStats.total} total
                </span>
                {variableStats.imported > 0 && (
                  <span className="text-purple-400">
                    📦 {variableStats.imported} imported
                  </span>
                )}
                {variableStats.created > 0 && (
                  <span className="text-purple-400">
                    ✏️ {variableStats.created} created
                  </span>
                )}
                {variableStats.workflow > 0 && (
                  <span className="text-green-400">
                    ✅ {variableStats.workflow} workflow
                  </span>
                )}
                {variableStats.pending > 0 && (
                  <span className="text-cyan-400">
                    ⏳ {variableStats.pending} pending
                  </span>
                )}
                {variableStats.missing > 0 && (
                  <span className="text-red-400">
                    ⚠️ {variableStats.missing} missing
                  </span>
                )}
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">
                  {folderStructure.length + 1} folders
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Folder Tree */}
            <div className={`${isLeftPanelCollapsed ? 'w-12' : 'w-64'} transition-all duration-300 border-r border-gray-700 ${isLeftPanelCollapsed ? 'p-2' : 'p-4'} flex flex-col relative`}>
              {/* Collapse/Expand Button */}
              <button
                onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
                className="absolute -right-3 top-4 z-10 bg-gray-800 border border-gray-700 rounded-full p-1 hover:bg-gray-700 transition-colors"
                title={isLeftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isLeftPanelCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {!isLeftPanelCollapsed && (
                <>
                  <FolderTree
                    folders={folderStructure}
                    rootVariableCount={rootVariableCount}
                    selectedFolder={selectedFolder}
                    onSelectFolder={setSelectedFolder}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onMoveFolder={handleMoveFolder}
                  />
              
                  <div className="mt-auto space-y-2 pt-4 border-t border-gray-700">
                    <label className="block">
                      <input
                        type="file"
                        multiple
                        accept=".txt,.md,.json,.yaml,.yml,.xml,.csv,.js,.ts,.jsx,.tsx,.css,.html,.py,.java,.cpp,.c,.h,.go,.rs,.sql"
                        onChange={handleFileImport}
                        className="hidden"
                        id="file-import"
                      />
                      <span className="block w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-500 text-sm text-center cursor-pointer">
                        📄 Import Files
                      </span>
                    </label>
                    
                    <label className="block">
                      <input
                        type="file"
                        onChange={handleFolderImport}
                        className="hidden"
                        id="folder-import"
                        {...{ webkitdirectory: '', directory: '' } as React.HTMLAttributes<HTMLInputElement>}
                      />
                      <span className="block w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 text-sm text-center cursor-pointer">
                        📁 Import Folder
                      </span>
                    </label>
                    
                    <button
                      onClick={exportVariables}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                    >
                      💾 Export All
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Center Panel - Variable List */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'all'
                      ? 'text-blue-400 border-blue-400'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  All Variables
                </button>
                <button
                  onClick={() => setActiveTab('global')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'global'
                      ? 'text-purple-400 border-purple-400'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  📦 Global ({globalVariablesByType.all.length})
                </button>
                <button
                  onClick={() => setActiveTab('workflow')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'workflow'
                      ? 'text-green-400 border-green-400'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  ✅ Workflow ({workflowVariables.all.length})
                </button>
                <button
                  onClick={() => setActiveTab('missing')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'missing'
                      ? 'text-red-400 border-red-400'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  ⚠️ Missing ({missingVariables.length})
                </button>
                
                {/* Delete/Clear All buttons for each tab */}
                {activeTab === 'global' && globalVariablesByType.all.length > 0 && (
                  <button
                    onClick={() => {
                      const varsToDelete = globalSubTab === 'imported' 
                        ? globalVariablesByType.imported 
                        : globalSubTab === 'created'
                        ? globalVariablesByType.created
                        : globalVariablesByType.all;
                      
                      const typeLabel = globalSubTab === 'all' ? 'all global' : globalSubTab;
                      if (confirm(`Delete ${varsToDelete.length} ${typeLabel} variables? This cannot be undone.`)) {
                        varsToDelete.forEach(v => deleteGlobalVariable(v.name));
                      }
                    }}
                    className="ml-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                  >
                    Delete All {globalSubTab === 'all' ? '' : globalSubTab}
                  </button>
                )}
                
                {activeTab === 'workflow' && workflowVariables.all.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all workflow/session variables? This will reset execution state and clear all LLM node responses.')) {
                        // Use the same function as sidebar's "Reset LLM Nodes" button
                        resetAllLLMNodes();
                        
                        // Also clear all workflow variables
                        clearWorkflowVariables();
                        
                        // Clear execution results for ALL nodes (not just LLM)
                        setExecutionResults({});
                        
                        // Clear execution data for all other node types too
                        nodes.forEach(node => {
                          if (node.type !== 'basicLLMChain' && node.type !== 'llmChain') {
                            const cleanData: Record<string, unknown> = { ...node.data };
                            
                            // Remove execution-related fields
                            delete cleanData.output;
                            delete cleanData.lastOutput;
                            delete cleanData.result;
                            delete cleanData.lastResult;
                            delete cleanData.lastError;
                            delete cleanData.executionStats;
                            delete cleanData.queueStatus;
                            
                            // Reset states
                            cleanData.isLoading = false;
                            cleanData.error = undefined;
                            cleanData.isExecuting = false;
                            cleanData.lastExecuted = undefined;
                            
                            updateNodeData(node.id, cleanData as Partial<typeof node.data>);
                          }
                        });
                      }
                    }}
                    className="ml-auto px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500"
                  >
                    Clear All
                  </button>
                )}
                
                {activeTab === 'all' && Object.keys(globalVariables).length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete ALL ${Object.keys(globalVariables).length} variables? This action cannot be undone!`)) {
                        // Delete all variables
                        Object.keys(globalVariables).forEach(key => {
                          deleteGlobalVariable(key);
                        });
                      }
                    }}
                    className="ml-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete All Variables
                  </button>
                )}
              </div>
              
              {/* Sub-tabs for Global */}
              {activeTab === 'global' && (
                <div className="flex gap-2 mb-4 pl-4">
                  <button
                    onClick={() => setGlobalSubTab('all')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      globalSubTab === 'all'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    All ({globalVariablesByType.all.length})
                  </button>
                  <button
                    onClick={() => setGlobalSubTab('imported')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      globalSubTab === 'imported'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Imported ({globalVariablesByType.imported.length})
                  </button>
                  <button
                    onClick={() => setGlobalSubTab('created')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      globalSubTab === 'created'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Created ({globalVariablesByType.created.length})
                  </button>
                </div>
              )}
              
              {/* Sub-tabs for Workflow */}
              {activeTab === 'workflow' && (
                <div className="flex gap-2 mb-4 pl-4">
                  <button
                    onClick={() => setWorkflowSubTab('all')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      workflowSubTab === 'all'
                        ? 'text-green-400 border-b-2 border-green-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    All ({workflowVariables.all.length})
                  </button>
                  <button
                    onClick={() => setWorkflowSubTab('completed')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      workflowSubTab === 'completed'
                        ? 'text-green-400 border-b-2 border-green-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    ✅ Completed ({workflowVariables.completed.length})
                  </button>
                  <button
                    onClick={() => setWorkflowSubTab('pending')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      workflowSubTab === 'pending'
                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    ⏳ Pending ({workflowVariables.pending.length})
                  </button>
                </div>
              )}
              
              {/* Search and Actions */}
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="🔍 Search by name, value, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={createNewVariable}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                >
                  + New Variable
                </button>
              </div>
              
              {/* Bulk Actions Bar - not for Missing tab */}
              {folderVariables.length > 0 && activeTab !== 'missing' && (
                <div className="mb-3 flex items-center justify-between p-2 bg-gray-800 rounded">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedVariables.size === folderVariables.length && folderVariables.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                    <span className="text-sm text-gray-400">
                      {selectedVariables.size > 0 
                        ? `${selectedVariables.size} selected` 
                        : 'Select all'}
                    </span>
                  </div>
                  {selectedVariables.size > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBulkMoveDialog(true)}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-500"
                      >
                        📁 Move ({selectedVariables.size})
                      </button>
                      <button
                        onClick={bulkDeleteVariables}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                      >
                        🗑 Delete ({selectedVariables.size})
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Current Folder Path */}
              <div className="mb-2 text-sm text-gray-400">
                {activeTab === 'workflow' ? (
                  <>✅ Workflow Variables ({folderVariables.length})</>
                ) : activeTab === 'global' ? (
                  <>📦 Global Variables ({folderVariables.length})</>
                ) : activeTab === 'missing' ? (
                  <>⚠️ Missing Variables ({folderVariables.length})</>
                ) : (
                  <>📁 {selectedFolder || 'Root'} ({folderVariables.length} variables)</>
                )}
              </div>
              
              {/* Variables List */}
              <div className="flex-1 overflow-y-auto">
                {folderVariables.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? 'No variables found' : 'No variables in this folder'}
                  </div>
                ) : (
                  <div>
                    {folderVariables.map((variable, index) => {
                      const isFromInput = (inputNodeVariables[variable.name] && 
                                         inputNodeVariables[variable.name] === variable.value) ||
                                        (variable.description?.includes('Imported from Input node') ?? false);
                      
                      // Determine variable category for coloring
                      let variableCategory: 'imported' | 'created' | 'completed' | 'pending' | 'missing' | 'default' = 'default';
                      
                      if (activeTab === 'missing') {
                        variableCategory = 'missing';
                      } else if (activeTab === 'workflow') {
                        // Check if this is a pending variable
                        const isPending = variable.description?.includes('⏳') || variable.value === '[Pending execution]';
                        variableCategory = isPending ? 'pending' : 'completed';
                      } else if (activeTab === 'global') {
                        // Check if imported or created
                        variableCategory = isImportedVariable(variable as GlobalVariable) ? 'imported' : 'created';
                      } else if (activeTab === 'all') {
                        // In 'all' tab, determine the category based on variable properties
                        if (variable.description?.includes('⚠️') || variable.value === '[Variable not found]') {
                          variableCategory = 'missing';
                        } else if (variable.description?.includes('⏳') || variable.value === '[Pending execution]') {
                          variableCategory = 'pending';
                        } else if (isWorkflowVariable(variable.name, variable as GlobalVariable)) {
                          variableCategory = 'completed';
                        } else if (isImportedVariable(variable as GlobalVariable)) {
                          variableCategory = 'imported';
                        } else {
                          variableCategory = 'created';
                        }
                      }
                      
                      return (
                        <VariableListItem
                          key={`${variable.name}-${index}`}
                          name={variable.name}
                          variable={variable}
                          isSelected={selectedVariable === variable.name}
                          isFromInput={isFromInput}
                          isChecked={selectedVariables.has(variable.name)}
                          onSelect={selectVariable}
                          onCopyReference={copyVariableReference}
                          onMoveToFolder={handleMoveVariable}
                          onCheckChange={toggleVariableSelection}
                          hideCheckbox={activeTab === 'missing'}
                          variableCategory={variableCategory}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Panel - Variable Editor */}
            {selectedVariable && (
              (() => {
                const isWorkflowVar = activeTab === 'workflow' || selectedVariable.startsWith('workflow:');
                const actualVarName = isWorkflowVar && !selectedVariable.startsWith('workflow:') 
                  ? `workflow:${selectedVariable}` 
                  : selectedVariable;
                const variable = globalVariables[actualVarName];
                
                if (!variable) return null;
                
                return (
              <div className="w-96 border-l border-gray-700 p-4 flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4">Edit Variable</h3>
                
                <div className="space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Value ({editingValue.length} characters)
                    </label>
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="w-full h-64 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none font-mono text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveVariable}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete variable "${selectedVariable}"?`)) {
                        // Check if it's a workflow variable
                        if (activeTab === 'workflow' || selectedVariable.startsWith('workflow:')) {
                          deleteSessionVariable(selectedVariable);
                        } else if (activeTab !== 'missing') {
                          deleteGlobalVariable(selectedVariable);
                        }
                        setSelectedVariable(null);
                      }
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-500"
                    disabled={activeTab === 'missing'}
                  >
                    Delete
                  </button>
                </div>
                  </div>
                );
              })()
            )}
          </div>
          
          {/* Bulk Move Dialog */}
          {showBulkMoveDialog && selectedVariables.size > 0 && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
              <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                <h3 className="text-white text-lg mb-4">Move {selectedVariables.size} variables to folder</h3>
                
                <select
                  value={moveTargetFolder || ''}
                  onChange={(e) => setMoveTargetFolder(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
                >
                  <option value="">Root (no folder)</option>
                  {getAllFolderPaths().map(path => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
                
                <div className="flex gap-2">
                  <button
                    onClick={bulkMoveVariables}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                  >
                    Move All
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkMoveDialog(false);
                      setMoveTargetFolder(null);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Single Move Variable Dialog */}
          {showMoveDialog && movingVariable && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
              <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                <h3 className="text-white text-lg mb-4">Move &quot;{movingVariable}&quot; to folder</h3>
                
                <select
                  value={moveTargetFolder || ''}
                  onChange={(e) => setMoveTargetFolder(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
                >
                  <option value="">Root (no folder)</option>
                  {getAllFolderPaths().map(path => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
                
                <div className="flex gap-2">
                  <button
                    onClick={confirmMove}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => {
                      setShowMoveDialog(false);
                      setMovingVariable(null);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
