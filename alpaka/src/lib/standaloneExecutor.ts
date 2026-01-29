/**
 * Standalone Pipeline Executor
 * Executes Alpaka pipelines without Zustand store - for use in background workers and API routes
 */

import { Node, Edge } from "@xyflow/react";
import { ExecutionResult, UnifiedNodeData } from "@/types";
import {
  ExecutionContext,
  ExecutionContextConfig,
} from "@/store/modules/execution/executionContext";
import { ExecutionQueueManager } from "@/store/modules/execution/queueManager";
import { logger } from "@/utils/logger";
import { buildVariableContext } from "@/store/modules/variableSystem";

export interface StandaloneExecutionConfig {
  nodes: Node[];
  edges: Edge[];
  globalVariables: Record<
    string,
    {
      name: string;
      value: string;
      description?: string;
      folder?: string | null;
    }
  >;
  clearResults?: boolean;
  projectId: string;
  projectName: string;
  /** AbortSignal for cancelling execution */
  abortSignal?: AbortSignal;
}

export interface StandaloneExecutionResult {
  success: boolean;
  executionId: string;
  executed: number;
  failed: number;
  skipped: number;
  duration: number;
  executionResults: Record<string, ExecutionResult>;
}

/**
 * Simple template interpolation for standalone execution
 * Replaces {{variable}} with values from context
 */
function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  if (!template || typeof template !== "string") {
    return template;
  }

  return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedVarName = varName.trim();
    return variables[trimmedVarName] || match;
  });
}

/**
 * Execute pipeline standalone (without Zustand store)
 */
export async function executeFlowStandalone(
  config: StandaloneExecutionConfig,
): Promise<StandaloneExecutionResult> {
  const startTime = Date.now();
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const jobId = config.globalVariables["job_id"]?.value || "unknown";
  const sessionId =
    config.globalVariables["job_session_id"]?.value || "unknown";

  logger.info(`🚀 [Standalone] Starting execution: ${executionId}`);
  logger.info(`   Project: ${config.projectName} (${config.projectId})`);
  logger.info(`   Job ID: ${jobId}`);
  logger.info(`   Session ID: ${sessionId}`);
  logger.info(`   Clear Results: ${config.clearResults}`);
  logger.info(`   AbortSignal: ${config.abortSignal ? "provided" : "none"}`);

  // Check if already aborted before starting
  if (config.abortSignal?.aborted) {
    logger.warn(
      `⚠️ [Standalone] Execution aborted before start: ${executionId}`,
    );
    return {
      success: false,
      executionId,
      executed: 0,
      failed: 0,
      skipped: 0,
      duration: Date.now() - startTime,
      executionResults: {},
    };
  }

  // In-memory storage for execution
  let nodes = [...config.nodes];
  const edges = [...config.edges];
  let executionResults: Record<string, ExecutionResult> = {};
  // Normalize globalVariables: convert null to undefined for folder field
  const globalVariables: Record<
    string,
    { name: string; value: string; description?: string; folder?: string }
  > = {};
  Object.entries(config.globalVariables).forEach(([key, value]) => {
    globalVariables[key] = {
      ...value,
      folder: value.folder === null ? undefined : value.folder,
    };
  });
  let isExecuting = true;

  // Build variable context for template interpolation
  const buildVarContext = (): Record<string, string> => {
    return buildVariableContext(nodes, executionResults, globalVariables);
  };

  // Create ExecutionContext config with in-memory storage
  const contextConfig: ExecutionContextConfig = {
    // Lazy data access
    getNodes: () => nodes,
    getEdges: () => edges,
    getExecutionResults: () => executionResults,
    getGlobalVariables: () => globalVariables,

    // Action callbacks - update in-memory storage
    updateNodeData: (nodeId: string, data: Partial<UnifiedNodeData>) => {
      nodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
      );
    },

    setExecutionResults: (results: Record<string, ExecutionResult>) => {
      executionResults = {
        ...executionResults,
        ...results,
      };
    },

    addGlobalVariable: (
      name: string,
      value: string,
      description?: string,
      folder?: string,
    ) => {
      globalVariables[name] = {
        name,
        value,
        description,
        folder,
      };
    },

    updateGlobalVariable: (
      name: string,
      value: string,
      description?: string,
      folder?: string,
    ) => {
      if (globalVariables[name]) {
        globalVariables[name].value = value;
        if (description) globalVariables[name].description = description;
        if (folder !== undefined) globalVariables[name].folder = folder;
      } else {
        globalVariables[name] = {
          name,
          value,
          description,
          folder,
        };
      }
    },

    interpolateTemplate: (template: string) => {
      const varContext = buildVarContext();
      return interpolateTemplate(template, varContext);
    },

    executeNode: async (nodeId: string) => {
      // Not used in standalone mode - queue manager handles execution
      logger.warn(
        `[Standalone] executeNode called for ${nodeId} - not implemented in standalone mode`,
      );
    },

    updateEdgeColors: () => {
      // No-op in standalone mode (no UI)
    },

    isExecuting: isExecuting,
    setExecuting: (value: boolean) => {
      isExecuting = value;
    },
  };

  try {
    // Create ExecutionContext
    const context = new ExecutionContext(contextConfig);

    // CRITICAL: Create NEW instance for each job to prevent cross-job contamination
    // DO NOT use singleton when running parallel jobs!
    const queueManager = new ExecutionQueueManager(1);

    logger.info(
      `🧹 [Standalone] Created NEW QueueManager instance for job ${jobId}`,
    );

    // Set context AFTER reset
    queueManager.setExecutionContext(context);

    // Set job info for real-time progress logging
    queueManager.setJobInfo(jobId, config.projectName);

    // Set abort signal if provided
    if (config.abortSignal) {
      queueManager.setAbortSignal(config.abortSignal);
    }

    // Optionally restore from previous execution results
    if (!config.clearResults && executionResults) {
      logger.info(
        `📥 [Standalone] Restoring ${Object.keys(executionResults).length} previous execution results`,
      );
      queueManager.restoreCompletedNodesFromExecutionResults(executionResults);
    }

    // Find executable nodes using topological sort
    const executableTypes = [
      "input",
      "trigger",
      "basicLLMChain",
      "code",
      "output",
      "note",
      "modelProvider",
      "executionBarrier",
      "outputSender",
    ];

    // Build dependency graph
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    const originalInDegree = new Map<string, number>();

    nodes.forEach((node) => {
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
      originalInDegree.set(node.id, 0);
    });

    edges.forEach((edge) => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
      const deg = (inDegree.get(edge.target) || 0) + 1;
      inDegree.set(edge.target, deg);
      originalInDegree.set(edge.target, deg);
    });

    // Discover nodes connected to start nodes (nodes with no incoming edges) via BFS
    const connectedToInputs = new Set<string>();
    // Find start nodes: nodes with no incoming edges (inDegree === 0)
    const startNodeIds = Array.from(inDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([nodeId]) => nodeId);
    const startNodes = nodes.filter((n) => startNodeIds.includes(n.id));

    logger.info(
      `🎯 [Standalone] Detected ${startNodes.length} start nodes (inDegree=0):`,
    );
    startNodes.forEach((n) => {
      logger.info(`   - ${n.data?.label || n.id} (${n.type})`);
    });

    const bfs = (starts: string[]) => {
      const q = [...starts];
      const visited = new Set<string>();
      while (q.length) {
        const id = q.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        connectedToInputs.add(id);
        const outs = adjacencyList.get(id) || [];
        outs.forEach((t) => {
          if (!visited.has(t)) q.push(t);
        });
      }
    };
    bfs(startNodes.map((n) => n.id));

    // Topological sort
    const queue: string[] = [];
    const topologicalOrder: string[] = [];

    // Find nodes with no dependencies
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);

      const neighbors = adjacencyList.get(current) || [];
      neighbors.forEach((neighbor) => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Separate connected vs isolated executable nodes
    const execNodes = topologicalOrder
      .map((id) => nodes.find((n) => n.id === id))
      .filter(
        (n): n is NonNullable<typeof n> =>
          !!n && executableTypes.includes(n.type || ""),
      );

    const connectedNodes = execNodes.filter((n) => connectedToInputs.has(n.id));
    const isolatedNodes = execNodes.filter(
      (n) =>
        !connectedToInputs.has(n.id) &&
        ((originalInDegree.get(n.id) || 0) > 0 ||
          (adjacencyList.get(n.id) || []).length > 0),
    );

    console.log(`📊 [Standalone] Execution plan:`);
    console.log(`   Connected nodes: ${connectedNodes.length}`);
    console.log(`   Isolated nodes: ${isolatedNodes.length}`);

    // Phase 1: connected nodes get higher priority
    for (let i = 0; i < connectedNodes.length; i++) {
      const node = connectedNodes[i];
      if (!node) continue;

      // Skip nodes that are already completed (unless we're clearing results)
      if (!config.clearResults && queueManager.isNodeCompleted(node.id)) {
        logger.dev(
          `⏭️ Skipping already completed node: ${node.data?.label || node.id}`,
        );
        continue;
      }

      const base =
        node.type === "trigger" ? 2000 : node.type === "input" ? 1800 : 1200;
      const priority = base + (connectedNodes.length - i);
      await queueManager.addToQueue(node, priority, context);
    }

    // Phase 2: isolated nodes with lower priority
    for (let i = 0; i < isolatedNodes.length; i++) {
      const node = isolatedNodes[i];
      if (!node) continue;

      // Skip nodes that are already completed (unless we're clearing results)
      if (!config.clearResults && queueManager.isNodeCompleted(node.id)) {
        logger.dev(
          `⏭️ Skipping already completed node: ${node.data?.label || node.id}`,
        );
        continue;
      }

      const base =
        node.type === "trigger" ? 900 : node.type === "input" ? 800 : 400;
      const priority = base + (isolatedNodes.length - i);
      await queueManager.addToQueue(node, priority, context);
    }

    // Wait for queue to finish processing
    logger.info(`⏳ [Standalone] Waiting for queue to complete...`);
    await queueManager.processQueue();

    // Get final stats
    const stats = queueManager.getStats();
    const duration = Date.now() - startTime;

    logger.info(`✅ [Standalone] Execution completed: ${executionId}`);
    logger.info(`   Job ID: ${jobId}`);
    logger.info(
      `   Duration: ${(duration / 1000 / 60).toFixed(1)} minutes (${duration}ms)`,
    );
    logger.info(
      `   Executed: ${stats.completed}, Failed: ${stats.failed}, Skipped: ${stats.waiting}`,
    );

    return {
      success: stats.failed === 0,
      executionId,
      executed: stats.completed,
      failed: stats.failed,
      skipped: stats.waiting,
      duration,
      executionResults,
    };
  } catch (error) {
    console.error(`❌ [Standalone] Execution failed: ${executionId}`, error);

    throw error;
  } finally {
    isExecuting = false;
  }
}
