/**
 * Execution Queue Manager
 * Управляет очередями выполнения нод с поддержкой воркеров и проверкой зависимостей
 */

import { Node, Edge } from "@xyflow/react";
import { executeNodeModular } from "./index";
import { logger } from "@/utils/logger";
import { IExecutionContext } from "./executionContext";
import { getFlowStore } from "@/store/storeAccessor";
import { useFlowStore } from "@/store/useFlowStore";
import { ExecutionResult } from "@/types";
import {
  logNodeProgress,
  logExecutionStart,
  logExecutionComplete,
} from "@/utils/progressLogger";

// Maximum number of parallel workers allowed
const MAX_WORKERS_LIMIT = 25;

export interface QueueItem {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  priority: number;
  status: "queued" | "executing" | "completed" | "failed" | "waiting";
  dependencies: string[]; // Node IDs this node depends on
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  workerId?: number;

  // Execution results
  output?: {
    type: string;
    value?: unknown;
    text?: string;
    response?: string;
    thinking?: string;
    [key: string]: unknown;
  };

  // Token statistics
  tokenStats?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  // Timing relative to flow start
  relativeStartTime?: number; // ms from flow start
  relativeEndTime?: number; // ms from flow start
}

export interface QueueStats {
  totalQueued: number;
  executing: number;
  completed: number;
  failed: number;
  waiting: number; // Nodes waiting for dependencies
  activeWorkers: number;
  maxWorkers: number;
  averageExecutionTime: number;
}

export class ExecutionQueueManager {
  private static instance: ExecutionQueueManager | null = null;
  private queue: QueueItem[] = [];
  private activeWorkers: Map<number, QueueItem> = new Map();
  private maxWorkers: number;
  private listeners: Set<(stats: QueueStats) => void> = new Set();
  private isProcessing = false;
  // Flag for USER-REQUESTED stop (via Stop button), NOT for automatic error handling
  // Task failures do NOT set this flag - following best practices (BullMQ, Celery, Temporal)
  private shouldStopFlow = false;
  // Removed maxCompletedItems limit - ExecutionManager should show ALL completed tasks
  // This is important for user to understand the full project progress
  private completedNodeIds: Set<string> = new Set(); // Track completed nodes for dependency checking
  private failedNodeIds: Set<string> = new Set(); // Track failed nodes for cascade failure
  private edges: Edge[] = []; // Store edges for dependency resolution
  private flowStartTime: Date | null = null; // Track when the flow execution started
  private flowEndTime: Date | null = null; // Track when the flow execution finished
  private executionContext: IExecutionContext | null = null; // Execution context for dependency injection
  private progressInterval: NodeJS.Timeout | null = null; // Interval for real-time updates
  private jobId: string | null = null; // Current job ID for logging
  private projectName: string | null = null; // Current project name for logging
  private totalNodesAtStart: number = 0; // Total nodes at execution start (stable counter)
  private abortSignal: AbortSignal | null = null; // AbortSignal for cancelling execution

  constructor(maxWorkers = 1) {
    this.maxWorkers = maxWorkers;
  }

  static getInstance(maxWorkers = 1): ExecutionQueueManager {
    if (!ExecutionQueueManager.instance) {
      // Default to 1 worker for better visibility of queue states
      // Users can adjust via UI based on their setup
      ExecutionQueueManager.instance = new ExecutionQueueManager(maxWorkers);
      logger.dev("[QueueManager] Created new singleton instance");
    } else {
      logger.dev("[QueueManager] Returning existing singleton instance");
    }
    return ExecutionQueueManager.instance;
  }

  /**
   * Get dependencies for a node
   */
  private getNodeDependencies(nodeId: string): string[] {
    // Find all edges where this node is the target
    return this.edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source);
  }

  /**
   * Check if all dependencies are satisfied
   */
  private areDependenciesSatisfied(item: QueueItem): boolean {
    // If no dependencies, it's ready to run
    if (item.dependencies.length === 0) return true;

    // Check if all dependencies are completed successfully
    return item.dependencies.every((depId) => this.completedNodeIds.has(depId));
  }

  /**
   * Check if any dependencies have failed
   * Used for cascade failure pattern
   */
  private hasFailedDependencies(item: QueueItem): boolean {
    // If no dependencies, nothing can fail
    if (item.dependencies.length === 0) return false;

    // Check if any dependency has failed
    return item.dependencies.some((depId) => this.failedNodeIds.has(depId));
  }

  /**
   * Get names of failed dependencies for error messages
   */
  private getFailedDependencyNames(item: QueueItem): string[] {
    const failedDeps: string[] = [];

    item.dependencies.forEach((depId) => {
      if (this.failedNodeIds.has(depId)) {
        const depItem = this.queue.find((i) => i.nodeId === depId);
        failedDeps.push(depItem?.nodeName || depId);
      }
    });

    return failedDeps;
  }

  /**
   * Set the execution context
   */
  setExecutionContext(context: IExecutionContext) {
    this.executionContext = context;
    this.edges = context.getEdges();
  }

  /**
   * Set job info for real-time progress logging
   */
  setJobInfo(jobId: string, projectName: string) {
    this.jobId = jobId;
    this.projectName = projectName;
  }

  /**
   * Set abort signal for cancelling execution
   */
  setAbortSignal(signal: AbortSignal) {
    this.abortSignal = signal;

    // Listen for abort event to stop flow
    signal.addEventListener("abort", () => {
      logger.warn("🛑 [QueueManager] Abort signal received - stopping flow");
      this.stopFlow();
    });
  }

  /**
   * Добавить ноду в очередь
   */
  async addToQueue(
    node: Node,
    priority: number = 0,
    context?: IExecutionContext,
  ): Promise<string> {
    logger.dev(
      `[QueueManager] addToQueue called for node ${node.id} (${node.type})`,
    );

    // Check if node is already in queue (not completed or failed)
    const existingItem = this.queue.find(
      (item) =>
        item.nodeId === node.id &&
        (item.status === "queued" ||
          item.status === "waiting" ||
          item.status === "executing"),
    );

    if (existingItem) {
      logger.dev(
        `⚠️ Node ${node.id} already in queue with status: ${existingItem.status}`,
      );
      return existingItem.id;
    }

    // Use provided context or get from store
    if (context) {
      this.executionContext = context;
      this.edges = context.getEdges();
    } else if (!this.executionContext) {
      // Fallback to store for backward compatibility
      const storeState = getFlowStore();
      this.edges = storeState.edges;
    }

    const dependencies = this.getNodeDependencies(node.id);

    const queueItem: QueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nodeId: node.id,
      nodeName:
        typeof node.data?.label === "string"
          ? node.data.label
          : node.type || node.id,
      nodeType: node.type || "unknown",
      priority,
      status: this.areDependenciesSatisfied({ dependencies } as QueueItem)
        ? "queued"
        : "waiting",
      dependencies,
      addedAt: new Date(),
    };

    // Добавляем в очередь с учетом приоритета
    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority);

    logger.dev(
      `📥 Added to queue: ${queueItem.nodeName} (priority: ${priority}, deps: ${dependencies.length})`,
    );

    // Обновляем статус ноды
    if (this.executionContext) {
      this.executionContext.updateNodeData(node.id, {
        queueStatus: queueItem.status,
      });
    } else {
      // Fallback to store
      const storeState = getFlowStore();
      storeState.updateNodeData(node.id, { queueStatus: queueItem.status });
    }

    this.notifyListeners();

    // Add small delay to let UI update before processing starts
    setTimeout(() => {
      this.processQueue(); // Запускаем обработку
    }, 50);

    return queueItem.id;
  }

  /**
   * Обработка очереди с проверкой зависимостей
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.shouldStopFlow = false; // Reset flag at start

    // Start real-time progress updates
    this.startProgressUpdates();

    while (this.queue.length > 0 || this.activeWorkers.size > 0) {
      // Check if aborted via AbortSignal
      if (this.abortSignal?.aborted) {
        logger.warn("🛑 [QueueManager] Abort signal detected - stopping flow");
        this.shouldStopFlow = true;
      }

      // Check if user requested stop (via Stop button or AbortSignal)
      if (this.shouldStopFlow) {
        logger.error(
          "🛑 STOPPING FLOW: User requested stop. Cancelling all remaining tasks.",
        );

        // Mark all queued and waiting tasks as failed
        this.queue.forEach((item) => {
          if (item.status === "queued" || item.status === "waiting") {
            item.status = "failed";
            item.error = "Flow stopped by user";
            item.completedAt = new Date();

            // Update node UI
            if (this.executionContext) {
              this.executionContext.updateNodeData(item.nodeId, {
                queueStatus: "failed",
                error: "Flow stopped by user",
              });
            } else {
              const store = getFlowStore();
              store.updateNodeData(item.nodeId, {
                queueStatus: "failed",
                error: "Flow stopped by user",
              });
            }
          }
        });

        this.notifyListeners();
        break; // Exit the processing loop immediately
      }

      // First, update waiting nodes to queued if dependencies are met
      this.updateWaitingNodes();

      let tasksStarted = false;

      // Запускаем новые задачи если есть свободные воркеры
      while (
        this.activeWorkers.size < this.maxWorkers &&
        this.queue.some((i) => i.status === "queued")
      ) {
        // Get next ready item (queued and dependencies satisfied)
        const item = this.queue.find(
          (i) => i.status === "queued" && this.areDependenciesSatisfied(i),
        );
        if (!item) break;

        const workerId = this.getAvailableWorkerId();
        if (workerId === -1) break;

        item.status = "executing";
        item.workerId = workerId;
        item.startedAt = new Date();

        // Set flow start time if this is the first item
        if (!this.flowStartTime) {
          this.flowStartTime = new Date();
          // Save total nodes count at start (stable counter for progress tracking)
          this.totalNodesAtStart = this.queue.length;

          // Log execution start (real-time progress)
          if (this.jobId && this.projectName) {
            await logExecutionStart(
              this.jobId,
              this.projectName,
              this.totalNodesAtStart,
            );
          }
        }

        // Calculate relative start time
        item.relativeStartTime =
          item.startedAt.getTime() - this.flowStartTime.getTime();

        this.activeWorkers.set(workerId, item);

        logger.dev(`🔄 Worker ${workerId} started: ${item.nodeName}`);
        logger.info(`🔄 [Worker ${workerId}] Started: ${item.nodeName}`);
        this.notifyListeners();

        // Запускаем выполнение в фоне
        this.executeItem(item, workerId).then(() => {
          // Trigger next iteration when task completes
          this.processNextInQueue();
        });

        tasksStarted = true;
      }

      // Only wait if we have active workers and no new tasks were started
      if (this.activeWorkers.size > 0 && !tasksStarted) {
        // Wait for a task to complete instead of constant polling
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      // Если нет ожидающих/queued задач и нет активных воркеров - выходим
      if (
        this.queue.filter(
          (i) => i.status === "queued" || i.status === "waiting",
        ).length === 0 &&
        this.activeWorkers.size === 0
      ) {
        break;
      }
    }

    this.isProcessing = false;
    this.stopProgressUpdates();

    // Set flow end time when all processing is complete
    if (this.flowStartTime && !this.flowEndTime) {
      this.flowEndTime = new Date();
      const totalTime = this.getTotalFlowTime();
      const stats = this.getStats();
      const total = this.totalNodesAtStart; // Use stable counter from start
      logger.dev(
        `✅ Queue processing completed. Total flow time: ${totalTime}ms`,
      );
      logger.info(
        `✅ [QueueManager] Execution completed | Total: ${total}, Completed: ${stats.completed}, Failed: ${stats.failed}, Duration: ${Math.round(totalTime / 1000)}s`,
      );

      // Log execution complete (real-time progress)
      if (this.jobId && this.projectName) {
        await logExecutionComplete(this.jobId, this.projectName, {
          completed: stats.completed,
          failed: stats.failed,
          total,
          duration: totalTime,
        });
      }
    }
  }

  /**
   * Process next items in queue (called when a task completes)
   */
  private processNextInQueue() {
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Update waiting nodes to queued if dependencies are satisfied
   * Also handles cascade failure: if any dependency failed, fail this node too
   */
  private updateWaitingNodes() {
    let updated = false;

    this.queue.forEach((item) => {
      if (item.status === "waiting") {
        // ✅ Check for failed dependencies first (cascade failure)
        if (this.hasFailedDependencies(item)) {
          const failedDeps = this.getFailedDependencyNames(item);
          item.status = "failed";
          item.error = `Dependency failed: ${failedDeps.join(", ")}`;
          item.completedAt = new Date();

          // Calculate relative end time
          if (this.flowStartTime) {
            item.relativeEndTime =
              item.completedAt.getTime() - this.flowStartTime.getTime();
          }

          // Track this node as failed for cascade
          this.failedNodeIds.add(item.nodeId);
          updated = true;

          logger.warn(
            `⛔ Cascade failure: ${item.nodeName} (dependency failed: ${failedDeps.join(", ")})`,
          );

          // Update node UI status
          if (this.executionContext) {
            this.executionContext.updateNodeData(item.nodeId, {
              queueStatus: "failed",
              error: item.error,
            });
          } else {
            const store = getFlowStore();
            store.updateNodeData(item.nodeId, {
              queueStatus: "failed",
              error: item.error,
            });
          }
        }
        // ✅ Check if dependencies are satisfied (all completed successfully)
        else if (this.areDependenciesSatisfied(item)) {
          item.status = "queued";
          updated = true;
          logger.dev(`✅ Dependencies satisfied for: ${item.nodeName}`);

          // Update node UI status
          if (this.executionContext) {
            this.executionContext.updateNodeData(item.nodeId, {
              queueStatus: "queued",
            });
          } else {
            const store = getFlowStore();
            store.updateNodeData(item.nodeId, { queueStatus: "queued" });
          }
        }
      }
    });

    if (updated) {
      this.notifyListeners();
    }
  }

  /**
   * Выполнить элемент очереди
   */
  private async executeItem(item: QueueItem, workerId: number) {
    try {
      let node: Node | undefined;

      if (this.executionContext) {
        // Use execution context
        node = this.executionContext.getNode(item.nodeId);

        if (!node) {
          throw new Error(`Node ${item.nodeId} not found`);
        }

        // Обновляем статус ноды на "executing"
        this.executionContext.updateNodeData(item.nodeId, {
          queueStatus: "executing",
        });

        // Execute using executeNodeModular directly with the context to avoid recursion
        await executeNodeModular(item.nodeId, this.executionContext);
      } else {
        // Fallback to store for backward compatibility
        const store = getFlowStore();
        node = store.nodes.find((n) => n.id === item.nodeId);

        if (!node) {
          throw new Error(`Node ${item.nodeId} not found`);
        }

        // Обновляем статус ноды на "executing"
        store.updateNodeData(item.nodeId, { queueStatus: "executing" });

        // Выполняем ноду через модульную систему
        await executeNodeModular(
          item.nodeId,
          store.nodes,
          store.edges,
          store.updateNodeData,
          store.executionResults,
          store.globalVariables,
          (results) => {
            // Use state updater function to prevent race conditions
            // This ensures atomic updates when multiple workers update concurrently
            useFlowStore.setState((state) => ({
              executionResults: {
                ...state.executionResults,
                ...results,
              },
            }));
          },
          store.updateEdgeColors,
          store.executeNode,
          store.interpolateTemplate,
          store.addGlobalVariable,
          store.updateGlobalVariable,
        );
      }

      // Get execution result FIRST to check success
      const executionResult = this.executionContext
        ? this.executionContext.getExecutionResult(item.nodeId)
        : getFlowStore().executionResults[item.nodeId];

      logger.dev(
        `[QueueManager] Getting execution result for ${item.nodeId}:`,
        {
          hasContext: !!this.executionContext,
          hasResult: !!executionResult,
          resultSuccess: executionResult?.success,
          hasOutput: !!executionResult?.output,
        },
      );

      // ✅ Check if execution was successful
      if (executionResult && !executionResult.success) {
        // ❌ Execution failed after all retry attempts
        item.status = "failed";
        item.error = executionResult.error || "Unknown error";
        item.completedAt = new Date();

        // Calculate relative end time
        if (this.flowStartTime) {
          item.relativeEndTime =
            item.completedAt.getTime() - this.flowStartTime.getTime();
        }

        // ✅ Track this node as failed for cascade failure
        this.failedNodeIds.add(item.nodeId);

        // 🛑 CRITICAL: Stop entire flow on ANY node failure to prevent wasting tokens/money
        this.shouldStopFlow = true;
        logger.error(
          `🛑 STOPPING FLOW: Node "${item.nodeName}" failed after all retries. Halting execution to prevent token waste.`,
        );
        logger.warn(
          `⚠️ Worker ${workerId} failed after retries: ${item.nodeName} - ${item.error}`,
        );
        logger.info(
          `❌ [Worker ${workerId}] Failed: ${item.nodeName} - ${item.error}`,
        );

        // Update node UI status
        if (this.executionContext) {
          this.executionContext.updateNodeData(item.nodeId, {
            queueStatus: "failed",
            error: item.error,
          });
        } else {
          const store = getFlowStore();
          store.updateNodeData(item.nodeId, {
            queueStatus: "failed",
            error: item.error,
          });
        }

        // Real-time progress logging (failed node)
        if (this.jobId && this.projectName) {
          const stats = this.getStats();
          const total = this.totalNodesAtStart; // Use stable counter
          await logNodeProgress(this.jobId, this.projectName, {
            timestamp: new Date().toISOString(),
            nodeId: item.nodeId,
            nodeLabel: item.nodeName,
            status: "failed",
            duration: item.startedAt
              ? Date.now() - item.startedAt.getTime()
              : undefined,
            error: item.error,
            progress: {
              completed: stats.completed,
              failed: stats.failed,
              total,
              percentage:
                total > 0
                  ? `${Math.round(((stats.completed + stats.failed) / total) * 100)}%`
                  : "0%",
            },
          });
        }

        // ✅ CONTINUE PIPELINE - Don't stop on error (best practice)
        // This allows other independent tasks to complete successfully
        // Dependent tasks will be cascade-failed in updateWaitingNodes()
      } else {
        // ✅ Execution succeeded
        item.status = "completed";
        item.completedAt = new Date();

        // Calculate relative end time
        if (this.flowStartTime) {
          item.relativeEndTime =
            item.completedAt.getTime() - this.flowStartTime.getTime();
        }

        if (executionResult) {
          // Save output
          item.output = executionResult.output;
          logger.dev(`[QueueManager] Saving output for ${item.nodeId}:`, {
            outputType: executionResult.output?.type,
            hasText: !!executionResult.output?.text,
            hasResponse: !!executionResult.output?.response,
            outputKeys: executionResult.output
              ? Object.keys(executionResult.output)
              : [],
          });

          // Extract token stats if available
          if (executionResult.executionStats) {
            item.tokenStats = {
              promptTokens: executionResult.executionStats.promptTokens,
              completionTokens: executionResult.executionStats.completionTokens,
              totalTokens: executionResult.executionStats.totalTokens,
            };
            logger.dev(
              `[QueueManager] Token stats for ${item.nodeId}:`,
              item.tokenStats,
            );
          }
        } else {
          logger.dev(
            `[QueueManager] No execution result found for ${item.nodeId}`,
          );
        }

        // Mark node as completed for dependency checking
        this.completedNodeIds.add(item.nodeId);

        logger.dev(`✅ Worker ${workerId} completed: ${item.nodeName}`);
        const stats = this.getStats();
        const total = this.totalNodesAtStart; // Use stable counter
        logger.info(
          `✅ [Worker ${workerId}] Completed: ${item.nodeName} | Progress: ${stats.completed}/${total} (${total > 0 ? Math.round((stats.completed / total) * 100) : 0}%)`,
        );

        // Update node UI status
        if (this.executionContext) {
          this.executionContext.updateNodeData(item.nodeId, {
            queueStatus: "completed",
          });
        } else {
          const store = getFlowStore();
          store.updateNodeData(item.nodeId, { queueStatus: "completed" });
        }

        // Real-time progress logging (completed node)
        if (this.jobId && this.projectName) {
          const total = this.totalNodesAtStart; // Use stable counter
          await logNodeProgress(this.jobId, this.projectName, {
            timestamp: new Date().toISOString(),
            nodeId: item.nodeId,
            nodeLabel: item.nodeName,
            status: "completed",
            duration: item.startedAt
              ? Date.now() - item.startedAt.getTime()
              : undefined,
            progress: {
              completed: stats.completed,
              failed: stats.failed,
              total,
              percentage:
                total > 0
                  ? `${Math.round(((stats.completed + stats.failed) / total) * 100)}%`
                  : "0%",
            },
          });
        }
      }

      // Check if any waiting nodes can now be queued
      this.updateWaitingNodes();
    } catch (error) {
      // ⚠️ UNEXPECTED ERROR - This should NOT happen in normal operation
      // Indicates a bug in the system (e.g., node not found, context error)
      item.status = "failed";
      item.error = error instanceof Error ? error.message : "Unknown error";
      item.completedAt = new Date();

      // Calculate relative end time even for failed items
      if (this.flowStartTime) {
        item.relativeEndTime =
          item.completedAt.getTime() - this.flowStartTime.getTime();
      }

      // ✅ Track this node as failed for cascade failure
      this.failedNodeIds.add(item.nodeId);

      // 🛑 CRITICAL: Stop entire flow on ANY node failure to prevent wasting tokens/money
      this.shouldStopFlow = true;
      logger.error(
        `🛑 STOPPING FLOW: Node "${item.nodeName}" had unexpected error. Halting execution to prevent token waste.`,
      );

      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        `❌ Worker ${workerId} UNEXPECTED ERROR: ${item.nodeName}`,
        errorObj,
      );

      // ✅ CONTINUE PIPELINE - Following best practices (BullMQ, Celery, Temporal):
      // - Individual task failures should NOT stop the entire pipeline
      // - Only the failed task is marked as failed
      // - Other independent tasks continue to execute
      // - Dependent tasks will be cascade-failed in updateWaitingNodes()
      logger.warn(
        `⚠️ Unexpected system error in ${item.nodeName}, but pipeline continues`,
      );

      // Update node UI status
      if (this.executionContext) {
        this.executionContext.updateNodeData(item.nodeId, {
          queueStatus: "failed",
          error: item.error,
        });
      } else {
        const store = getFlowStore();
        store.updateNodeData(item.nodeId, {
          queueStatus: "failed",
          error: item.error,
        });
      }
    } finally {
      // Освобождаем воркер
      this.activeWorkers.delete(workerId);

      // Не удаляем элемент сразу - оставляем в очереди для статистики
      // Удаление будет происходить через clearQueue или при добавлении новых элементов

      this.notifyListeners();
    }
  }

  /**
   * Получить свободный ID воркера
   */
  private getAvailableWorkerId(): number {
    for (let i = 0; i < this.maxWorkers; i++) {
      if (!this.activeWorkers.has(i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get total flow execution time (wall-clock time from start to finish)
   * Returns time in milliseconds, or 0 if flow hasn't started/finished
   */
  getTotalFlowTime(): number {
    if (!this.flowStartTime) return 0;

    // If flow is still running, calculate time from start to now
    if (!this.flowEndTime && this.isProcessing) {
      return Date.now() - this.flowStartTime.getTime();
    }

    // If flow is finished, return the actual duration
    if (this.flowEndTime) {
      return this.flowEndTime.getTime() - this.flowStartTime.getTime();
    }

    return 0;
  }

  /**
   * Получить статистику очереди
   */
  getStats(): QueueStats {
    const completed = this.queue.filter((i) => i.status === "completed");
    const totalTime = completed.reduce((sum, item) => {
      if (item.startedAt && item.completedAt) {
        return sum + (item.completedAt.getTime() - item.startedAt.getTime());
      }
      return sum;
    }, 0);

    return {
      totalQueued: this.queue.filter((i) => i.status === "queued").length,
      executing: this.activeWorkers.size,
      completed: completed.length,
      failed: this.queue.filter((i) => i.status === "failed").length,
      waiting: this.queue.filter((i) => i.status === "waiting").length,
      activeWorkers: this.activeWorkers.size,
      maxWorkers: this.maxWorkers,
      averageExecutionTime:
        completed.length > 0 ? totalTime / completed.length : 0,
    };
  }

  /**
   * Получить текущую очередь
   */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * Получить активные задачи
   */
  getActiveItems(): QueueItem[] {
    return Array.from(this.activeWorkers.values());
  }

  /**
   * Очистить очередь (удаляет только ожидающие задачи)
   */
  clearQueue() {
    // Удаляем только ожидающие и queued задачи, оставляем выполняющиеся и завершенные для истории
    this.queue = this.queue.filter(
      (i) => i.status !== "queued" && i.status !== "waiting",
    );
    this.notifyListeners();
  }

  /**
   * Clear completed and failed node IDs for new flow execution
   */
  clearCompletedNodeIds() {
    const previousCount = this.completedNodeIds.size;
    this.completedNodeIds.clear();
    this.failedNodeIds.clear();
    this.flowStartTime = null;
    this.flowEndTime = null;
    this.totalNodesAtStart = 0;
    logger.info(
      `🔄 [QueueManager] Cleared ${previousCount} completed nodes for fresh execution`,
    );
  }

  /**
   * CRITICAL: Full reset of QueueManager state for standalone execution
   * Must be called before each new execution to prevent cross-job contamination
   */
  resetForNewExecution() {
    logger.info(`🔄 [QueueManager] FULL RESET for new execution`);
    logger.info(
      `   Previous state: ${this.completedNodeIds.size} completed, ${this.failedNodeIds.size} failed, ${this.queue.length} queued, ${this.activeWorkers.size} active`,
    );

    // Clear all node tracking
    this.completedNodeIds.clear();
    this.failedNodeIds.clear();

    // Clear queue and workers
    this.queue = [];
    this.activeWorkers.clear();

    // Reset timing
    this.flowStartTime = null;
    this.flowEndTime = null;
    this.totalNodesAtStart = 0;

    // Reset flags
    this.isProcessing = false;
    this.shouldStopFlow = false;
    this.abortSignal = null;

    logger.info(`✅ [QueueManager] Reset complete - clean slate for execution`);
  }

  /**
   * Check if a specific node is completed
   */
  isNodeCompleted(nodeId: string): boolean {
    return this.completedNodeIds.has(nodeId);
  }

  /**
   * Restore completed node IDs from execution results
   * This is needed when loading a saved project to continue execution
   */
  restoreCompletedNodesFromExecutionResults(
    executionResults: Record<string, ExecutionResult>,
  ) {
    this.completedNodeIds.clear();

    // Add all nodes that have successful execution results to completedNodeIds
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      if (result && result.success) {
        this.completedNodeIds.add(nodeId);
      }
    });

    const completedCount = this.completedNodeIds.size;
    if (completedCount > 0) {
      logger.dev(
        `✅ Restored ${completedCount} completed nodes from execution results`,
      );
    }

    return completedCount;
  }

  /**
   * Restore queue history from execution results
   * This populates the ExecutionManager with completed items from previous sessions
   * NOTE: No limit on completed items - users need to see the full project progress
   */
  restoreQueueHistoryFromExecutionResults(
    executionResults: Record<string, ExecutionResult>,
    nodes: Node[],
  ): number {
    // Clear existing completed/failed items from queue
    this.queue = this.queue.filter(
      (i) => i.status !== "completed" && i.status !== "failed",
    );

    // Create queue items from execution results
    Object.entries(executionResults).forEach(([nodeId, result]) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const timestamp = result.executionStats?.timestamp
        ? new Date(result.executionStats.timestamp)
        : new Date();

      const queueItem: QueueItem = {
        id: `restored-${nodeId}`,
        nodeId,
        nodeName:
          (typeof node.data?.label === "string"
            ? node.data.label
            : node.type) || nodeId,
        nodeType: node.type || "unknown",
        priority: 0,
        status: result.success ? "completed" : "failed",
        dependencies: [],
        addedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        output: result.output,
        tokenStats: result.executionStats
          ? {
              promptTokens: result.executionStats.promptTokens,
              completionTokens: result.executionStats.completionTokens,
              totalTokens: result.executionStats.totalTokens,
            }
          : undefined,
        error: result.error,
        relativeStartTime: 0,
        relativeEndTime: result.duration || 0,
      };

      this.queue.push(queueItem);
    });

    // No limit on completed items - show all for accurate project progress tracking
    // This is important so users can see exactly how many nodes have been completed
    // Example: 192 out of 197 nodes completed - not just "last 50"

    const restoredCount = Object.keys(executionResults).length;
    if (restoredCount > 0) {
      logger.dev(
        `📜 Restored ${restoredCount} items to ExecutionManager history`,
      );
    }

    this.notifyListeners();
    return restoredCount;
  }

  /**
   * Очистить историю завершенных задач
   */
  clearHistory() {
    // Удаляем только завершенные и failed задачи
    this.queue = this.queue.filter(
      (i) =>
        i.status === "queued" ||
        i.status === "executing" ||
        i.status === "waiting",
    );
    this.notifyListeners();
  }

  /**
   * Полный сброс очереди (для смены проекта)
   */
  /**
   * Очистить очередь полностью
   */
  reset() {
    this.queue = [];
    this.activeWorkers.clear();
    this.completedNodeIds.clear();
    this.isProcessing = false;
    this.flowStartTime = null; // Reset flow start time
    this.flowEndTime = null; // Reset flow end time
    this.totalNodesAtStart = 0; // Reset total nodes counter
    this.notifyListeners();
    logger.dev("🗑️ Queue manager reset");
  }

  /**
   * Изменить количество воркеров
   */
  setMaxWorkers(count: number) {
    this.maxWorkers = Math.max(1, Math.min(MAX_WORKERS_LIMIT, count));
    this.notifyListeners();
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Get max workers count
   */
  getMaxWorkers(): number {
    return this.maxWorkers;
  }

  /**
   * Подписаться на изменения
   */
  subscribe(listener: (stats: QueueStats) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Уведомить слушателей
   */
  private notifyListeners() {
    const stats = this.getStats();
    this.listeners.forEach((listener) => listener(stats));
  }

  /**
   * Отменить элемент в очереди
   */
  cancelItem(itemId: string) {
    const index = this.queue.findIndex(
      (i) =>
        i.id === itemId && (i.status === "queued" || i.status === "waiting"),
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.notifyListeners();
      logger.dev(`🚫 Cancelled queue item: ${itemId}`);
    }
  }

  /**
   * Stop the entire flow execution
   * Cancels all queued/waiting tasks and stops processing
   */
  stopFlow() {
    logger.warn("🛑 STOP FLOW: User requested flow stop");

    // Set stop flag to halt processQueue loop
    this.shouldStopFlow = true;

    // Cancel all queued and waiting tasks
    this.queue.forEach((item) => {
      if (item.status === "queued" || item.status === "waiting") {
        item.status = "failed";
        item.error = "Flow stopped by user";
        item.completedAt = new Date();

        // Update node UI
        if (this.executionContext) {
          this.executionContext.updateNodeData(item.nodeId, {
            queueStatus: "failed",
            error: "Flow stopped by user",
            isExecuting: false,
          });
        }
      }
    });

    // Note: Currently executing tasks will complete, but no new tasks will start
    // To cancel executing tasks, we'd need AbortController support (future enhancement)

    this.notifyListeners();
    logger.warn(
      `🛑 Flow stopped: ${this.activeWorkers.size} tasks still running, ${this.queue.filter((i) => i.status === "queued" || i.status === "waiting").length} tasks cancelled`,
    );
  }

  /**
   * Изменить приоритет элемента
   */
  updatePriority(itemId: string, newPriority: number) {
    const item = this.queue.find(
      (i) =>
        i.id === itemId && (i.status === "queued" || i.status === "waiting"),
    );
    if (item) {
      item.priority = newPriority;
      this.queue.sort((a, b) => b.priority - a.priority);
      this.notifyListeners();
    }
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.filter(
      (i) => i.status === "queued" || i.status === "waiting",
    ).length;
  }

  /**
   * Add task for execution (simplified interface for UnifiedEngine)
   */
  addTask(task: {
    id: string;
    nodeId: string;
    priority: string;
    execute: () => Promise<void>;
  }): void {
    // Convert priority string to number
    let priorityNum = 0;
    switch (task.priority) {
      case "critical":
        priorityNum = 100;
        break;
      case "high":
        priorityNum = 50;
        break;
      case "normal":
        priorityNum = 0;
        break;
      case "low":
        priorityNum = -50;
        break;
    }

    const queueItem: QueueItem = {
      id: task.id,
      nodeId: task.nodeId,
      nodeName: task.nodeId,
      nodeType: "unified",
      priority: priorityNum,
      status: "queued",
      dependencies: [], // UnifiedEngine doesn't track dependencies, so empty array
      addedAt: new Date(),
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.notifyListeners();

    // Start processing
    this.processQueue();
  }

  // Removed cleanOldCompletedItems() method - no longer needed
  // ExecutionManager now shows all completed tasks for full project visibility

  /**
   * Start real-time progress updates
   */
  private startProgressUpdates(): void {
    // Clear any existing interval
    this.stopProgressUpdates();

    // Start new interval for real-time updates every 100ms
    this.progressInterval = setInterval(() => {
      // Only notify if we're still processing
      if (this.isProcessing) {
        this.notifyListeners();
      }
    }, 100);
    logger.dev("▶️ Started progress update interval");
  }

  /**
   * Stop real-time progress updates
   */
  private stopProgressUpdates(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
      logger.dev("⏸️ Stopped progress update interval");
    }
  }
}

// Глобальный экземпляр менеджера очередей - используем getInstance для singleton
export const queueManager = ExecutionQueueManager.getInstance(1);
