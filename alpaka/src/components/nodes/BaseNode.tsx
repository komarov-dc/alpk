/**
 * Base Node Component
 * Advanced base component for all nodes with slot-based architecture
 */

import React, {
  memo,
  ReactNode,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { EditableNodeTitle } from "@/components/ui/EditableNodeTitle";
import { UnifiedNodeData } from "@/types";

export interface NodeSlots {
  header?: ReactNode;
  tabs?: ReactNode;
  main: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}

export interface NodeConfig {
  // Appearance
  title: string;
  icon?: ReactNode;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;

  // Handles
  inputs?: Array<{
    id?: string;
    label?: string;
    position?: Position;
    type?: string;
  }>;
  outputs?: Array<{
    id?: string;
    label?: string;
    position?: Position;
    type?: string;
  }>;

  // Features
  collapsible?: boolean;
  deletable?: boolean;
  renamable?: boolean;

  // Layout options
  hasSidebar?: boolean;
  sidebarPosition?: "left" | "right";
  sidebarWidth?: number;

  // Style customization
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  customOverflow?: string; // Allow custom overflow behavior like in old version
}

interface BaseNodeProps {
  id: string;
  data: UnifiedNodeData;
  selected?: boolean;
  config: NodeConfig;
  slots: NodeSlots;
  onDataChange?: (data: Partial<UnifiedNodeData>) => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
}

const BaseNodeComponent: React.FC<BaseNodeProps> = ({
  id,
  data,
  selected,
  config,
  slots,
  onDataChange,
  onDelete,
  onRename,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(data.isCollapsed || false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  // Sync collapsed state with node data
  useEffect(() => {
    if (data.isCollapsed !== undefined && data.isCollapsed !== isCollapsed) {
      setIsCollapsed(data.isCollapsed);
    }
  }, [data.isCollapsed, isCollapsed]);

  const handleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onDataChange?.({ isCollapsed: newCollapsed });

    // Update node internals multiple times during animation
    // This ensures smooth edge transitions
    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });

    // Update during animation
    setTimeout(() => updateNodeInternals(id), 50);
    setTimeout(() => updateNodeInternals(id), 100);
    setTimeout(() => updateNodeInternals(id), 150);
    setTimeout(() => updateNodeInternals(id), 200);
    setTimeout(() => updateNodeInternals(id), 250);
  }, [isCollapsed, onDataChange, id, updateNodeInternals]);

  const handleRename = useCallback(
    (newName: string) => {
      onRename?.(newName);
      onDataChange?.({ label: newName });
      setIsEditingTitle(false);
    },
    [onRename, onDataChange],
  );

  const getNodeColor = useCallback(() => {
    if (data.error) return "border-red-400 bg-gray-800";
    if (data.lastExecuted && !data.isExecuting)
      return "border-green-400 bg-gray-800";
    if (data.isExecuting)
      return "border-blue-400 bg-gray-800 animate-executing-glow";
    return "border-gray-600 bg-gray-800";
  }, [data.isExecuting, data.error, data.lastExecuted]);

  const getStatusIcon = useCallback(() => {
    if (data.isExecuting) {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"
        />
      );
    }
    if (data.error) {
      return <span className="text-red-400">⚠</span>;
    }
    if (data.lastExecuted) {
      return <span className="text-green-400">✓</span>;
    }
    return config.icon;
  }, [data.isExecuting, data.error, data.lastExecuted, config.icon]);

  return (
    <motion.div
      data-node-id={id}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        relative flex flex-col rounded-lg shadow-lg border-2 transition-all duration-200 text-white
        ${getNodeColor()}
        ${selected ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-black" : ""}
        ${isCollapsed ? "max-h-14 overflow-hidden" : ""}
        ${config.className || ""}
      `}
      style={{
        width: data.width || config.minWidth || 200,
        height: isCollapsed ? 56 : data.height || config.minHeight || 100,
        minWidth: config.minWidth || 200,
        minHeight: isCollapsed ? 56 : config.minHeight || 100,
        maxWidth: config.maxWidth,
        maxHeight: config.maxHeight,
      }}
    >
      {/* Resizer */}
      {config.resizable && !isCollapsed && (
        <NodeResizer
          minWidth={config.minWidth || 200}
          minHeight={config.minHeight || 100}
          maxWidth={config.maxWidth}
          maxHeight={config.maxHeight}
          isVisible={selected}
          handleClassName="react-flow__resize-control"
          lineClassName="react-flow__resize-control"
          color="#60a5fa"
          handleStyle={{
            width: "10px",
            height: "10px",
            borderRadius: "2px",
          }}
          onResize={(_, params) => {
            onDataChange?.({
              width: params.width,
              height: params.height,
            });
          }}
        />
      )}

      {/* Input Handles */}
      {config.inputs?.map((input, index) => {
        const totalInputs = config.inputs!.length;
        // Simple centered positioning
        const top =
          totalInputs === 1
            ? "50%"
            : `${((index + 1) / (totalInputs + 1)) * 100}%`;

        return (
          <Handle
            key={input.id || `input-${index}`}
            type="target"
            position={input.position || Position.Left}
            id={input.id}
            style={{
              top,
              transform: "translateY(-50%)",
            }}
            className="react-flow__handle-left"
          />
        );
      })}

      {/* Output Handles */}
      {config.outputs?.map((output, index) => {
        const totalOutputs = config.outputs!.length;
        // Simple centered positioning
        const top =
          totalOutputs === 1
            ? "50%"
            : `${((index + 1) / (totalOutputs + 1)) * 100}%`;

        return (
          <Handle
            key={output.id || `output-${index}`}
            type="source"
            position={output.position || Position.Right}
            id={output.id}
            style={{
              top,
              transform: "translateY(-50%)",
            }}
            className="react-flow__handle-right"
          />
        );
      })}

      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-gray-600 bg-gray-700/50 rounded-t-lg ${config.headerClassName || ""}`}
      >
        <div className="flex items-center gap-2 flex-1">
          {getStatusIcon()}

          {config.renamable !== false ? (
            <EditableNodeTitle
              title={data.label || config.title}
              onTitleChange={handleRename}
              isEditing={isEditingTitle}
              onEditingChange={setIsEditingTitle}
              className="font-semibold text-sm"
            />
          ) : (
            <span className="font-semibold text-sm">
              {data.label || config.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Custom header slot */}
          {slots.header}

          {/* Collapse Button */}
          {config.collapsible !== false && (
            <button
              onClick={handleCollapse}
              className="p-1 hover:bg-gray-600 rounded transition-colors text-gray-300"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? "▼" : "▲"}
            </button>
          )}

          {/* Protected indicator */}
          {data.protected && (
            <span
              className="p-1 text-yellow-500 text-xs"
              title="Защищённая нода - нельзя удалить"
            >
              🔒
            </span>
          )}

          {/* Delete Button - hidden for protected nodes */}
          {config.deletable !== false && !data.protected && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-red-700 text-red-400 rounded transition-colors"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs (if provided) */}
      {!isCollapsed && slots.tabs && (
        <div className="border-b border-gray-600">{slots.tabs}</div>
      )}

      {/* Body */}
      {!isCollapsed && (
        <div
          className={`flex-1 flex ${config.hasSidebar ? "flex-row" : "flex-col"} ${config.customOverflow || "overflow-hidden"} ${config.bodyClassName || ""}`}
        >
          {/* Sidebar (left) */}
          {config.hasSidebar &&
            config.sidebarPosition === "left" &&
            slots.sidebar && (
              <div
                className="border-r border-gray-600 overflow-auto"
                style={{ width: config.sidebarWidth || 200 }}
              >
                {slots.sidebar}
              </div>
            )}

          {/* Main Content */}
          <div
            className={`flex-1 ${config.customOverflow ? `${config.customOverflow} scrollbar-custom` : "overflow-hidden"} flex flex-col`}
          >
            {slots.main}
          </div>

          {/* Sidebar (right) */}
          {config.hasSidebar &&
            config.sidebarPosition === "right" &&
            slots.sidebar && (
              <div
                className="border-l border-gray-600 overflow-auto"
                style={{ width: config.sidebarWidth || 200 }}
              >
                {slots.sidebar}
              </div>
            )}
        </div>
      )}

      {/* Actions (if provided) */}
      {!isCollapsed && slots.actions && (
        <div className="px-3 py-2 border-t border-gray-600">
          {slots.actions}
        </div>
      )}

      {/* Footer */}
      {!isCollapsed && slots.footer && (
        <div
          className={`px-3 py-2 border-t border-gray-600 bg-gray-700/50 rounded-b-lg ${config.footerClassName || ""}`}
        >
          {slots.footer}
        </div>
      )}

      {/* Execution Stats */}
      {!isCollapsed && data.executionStats && (
        <div className="px-3 py-1 text-xs text-gray-400 border-t border-gray-600">
          <div className="flex justify-between">
            <span>Duration: {data.executionStats.duration}ms</span>
            {data.executionStats.tokens && (
              <span>Tokens: {data.executionStats.tokens}</span>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {!isCollapsed && data.error && (
        <div className="px-3 py-2 text-xs text-red-300 bg-red-900/50 border-t border-red-700">
          Error: {data.error}
        </div>
      )}
    </motion.div>
  );
};

// Export as memo for performance
export const BaseNode = memo(BaseNodeComponent);
