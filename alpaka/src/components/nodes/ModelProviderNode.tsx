/**
 * Model Provider Node Component
 * Centralized configuration for LLM models
 */

"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { BaseNode } from "./BaseNode";
import { ModelProviderData } from "@/types";
import { useFlowStore } from "@/store/useFlowStore";

import { useModelProviders } from "@/hooks/useModelProviders";

interface ModelProviderNodeProps {
  id: string;
  data: ModelProviderData;
  selected?: boolean;
}

const PROVIDERS = [
  { value: "ollama", label: "Ollama", icon: "🦙" },
  { value: "yandex", label: "Yandex Cloud", icon: "☁️" },
] as const;

const PRESETS = {
  creative: { temperature: 0.9, topP: 0.95 },
  balanced: { temperature: 0.7, topP: 0.9 },
  precise: { temperature: 0.3, topP: 0.85 },
};

const ModelProviderNodeComponent: React.FC<ModelProviderNodeProps> = ({
  id,
  data,
  selected,
}) => {
  const { updateNodeData, deleteNode } = useFlowStore();
  const { getModels, loading } = useModelProviders();

  // Only local UI state, not data state
  const [activeTab, setActiveTab] = useState<"model" | "parameters">("model");
  const [availableModels, setAvailableModels] = useState<
    Array<{ id: string; name: string; size?: string }>
  >([]);

  useEffect(() => {
    if (data.provider) {
      // Prepare config for providers that need it (OAuth token managed centrally in .env)
      const config = {
        baseURL: data.baseURL,
      };

      getModels(data.provider as "ollama" | "yandex", config)
        .then((models) => {
          setAvailableModels(models);
        })
        .catch(() => {
          setAvailableModels([]);
        });
    }
  }, [data.provider, data.baseURL, getModels]);

  const handleDataChange = useCallback(
    (updates: Partial<ModelProviderData>) => {
      // Directly update store, no local state
      updateNodeData(id, updates);
    },
    [id, updateNodeData],
  );

  // No need for syncing - we use props directly (controlled component pattern)

  // Tabs slot
  const tabsContent = (
    <div className="flex gap-1 px-3 pb-1">
      {(["model", "parameters"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-2 py-1 text-xs font-medium capitalize ${
            activeTab === tab
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  // Main content slot
  const mainContent = (
    <div className="p-3">
      {activeTab === "model" ? (
        <div className="space-y-3">
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    handleDataChange({
                      provider: p.value as ModelProviderData["provider"],
                      model: undefined,
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    data.provider === p.value
                      ? "border-blue-400 bg-blue-900/50 text-blue-400"
                      : "border-gray-600 bg-gray-700 text-gray-200"
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Model
            </label>
            {loading[data.provider as "ollama" | "yandex"] ? (
              <div className="text-xs text-gray-400">Loading...</div>
            ) : availableModels.length > 0 ? (
              <select
                value={data.model || ""}
                onChange={(e) => handleDataChange({ model: e.target.value })}
                className="w-full px-2 py-1 text-xs border rounded"
              >
                <option value="">Select model...</option>
                {availableModels.map((m, index) => (
                  <option key={m.id || `model-${index}`} value={m.id || m.name}>
                    {m.name} {m.size && `(${m.size})`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={data.model || ""}
                onChange={(e) => handleDataChange({ model: e.target.value })}
                placeholder="Enter model name..."
                className="w-full px-2 py-1 text-xs border border-gray-600 bg-gray-700 text-white rounded focus:ring-1 focus:ring-blue-400"
              />
            )}
          </div>

          {/* Group ID */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Group ID
            </label>
            <select
              value={data.groupId}
              onChange={(e) =>
                handleDataChange({ groupId: parseInt(e.target.value) })
              }
              className="w-full px-2 py-1 text-xs border border-gray-600 bg-gray-700 text-white rounded focus:ring-1 focus:ring-blue-400"
            >
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Presets */}
          <div className="flex gap-1">
            {Object.entries(PRESETS).map(([name, values]) => (
              <button
                key={name}
                onClick={() => handleDataChange(values)}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded capitalize"
              >
                {name}
              </button>
            ))}
          </div>

          {/* Temperature */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Temperature: {data.temperature || 0.7}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={data.temperature || 0.7}
              onChange={(e) =>
                handleDataChange({ temperature: parseFloat(e.target.value) })
              }
              className="w-full nodrag"
            />
          </div>

          {/* Top P */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Top P: {data.topP || 1}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={data.topP || 1}
              onChange={(e) =>
                handleDataChange({ topP: parseFloat(e.target.value) })
              }
              className="w-full nodrag"
            />
          </div>

          {/* Max Tokens */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              value={data.maxTokens || ""}
              onChange={(e) =>
                handleDataChange({
                  maxTokens: parseInt(e.target.value) || undefined,
                })
              }
              placeholder="No limit"
              className="w-full px-2 py-1 text-xs border border-gray-600 bg-gray-700 text-white rounded focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Footer slot
  const footerContent = data.model ? (
    <div className="text-xs text-gray-400 flex justify-between">
      <span>✓ {data.provider}</span>
      <span>Group {data.groupId}</span>
    </div>
  ) : undefined;

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      config={{
        title: "Model Provider",
        icon: <span className="text-purple-400">🎛️</span>,
        minWidth: 280,
        minHeight: 250,
        resizable: true,
        renamable: true,
        deletable: true,
      }}
      slots={{
        tabs: tabsContent,
        main: mainContent,
        footer: footerContent,
      }}
      onDataChange={(data) =>
        handleDataChange(data as Partial<ModelProviderData>)
      }
      onDelete={() => deleteNode(id)}
      onRename={(newName) => handleDataChange({ label: newName })}
    />
  );
};

export const ModelProviderNode = memo(ModelProviderNodeComponent);
