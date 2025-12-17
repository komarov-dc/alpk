/**
 * Real-Time Progress Logger
 * Appends node execution logs to file in real-time (after each node completes)
 * Also updates database with progress for admin panel display
 */

// Conditional imports for Node.js-only modules (not available in browser)
let fs: typeof import("fs").promises | null = null;
let path: typeof import("path") | null = null;
let prismaModule: typeof import("@/lib/prisma") | null = null;

// Only import fs and path on server-side (Node.js), not in browser
if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fs = require("fs").promises;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  prismaModule = require("@/lib/prisma");
}

// Get logs directory (only works on server-side)
function getLogsDir(): string {
  if (!path) {
    throw new Error("[ProgressLogger] path module not available (client-side)");
  }
  return path.join(process.cwd(), "logs", "executions");
}

export interface NodeProgressLog {
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  status: "completed" | "failed";
  duration?: number; // milliseconds
  error?: string;
  progress: {
    completed: number;
    failed: number;
    total: number;
    percentage: string;
  };
}

/**
 * Get or create log file path for job
 */
function getLogFilePath(jobId: string, projectName: string): string {
  if (!path) {
    throw new Error("[ProgressLogger] path module not available");
  }
  const cleanProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `${cleanProjectName}_${jobId}_progress.log`;
  return path.join(getLogsDir(), filename);
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  if (!fs) {
    return; // Skip on client-side
  }
  try {
    await fs.mkdir(getLogsDir(), { recursive: true });
  } catch (error) {
    console.error("[ProgressLogger] Failed to create logs directory:", error);
  }
}

/**
 * Append node completion log to file (real-time)
 * @param jobId - Job ID for this execution
 * @param projectName - Project name
 * @param log - Node progress log data
 */
export async function logNodeProgress(
  jobId: string,
  projectName: string,
  log: NodeProgressLog,
): Promise<void> {
  // Always enable file logging
  const enableFileLogging = true;

  if (!enableFileLogging || !fs || !path) {
    return;
  }

  try {
    await ensureLogsDir();

    const logFilePath = getLogFilePath(jobId, projectName);

    // Format log entry (one line per node)
    const statusEmoji = log.status === "completed" ? "✅" : "❌";
    const durationStr = log.duration
      ? `${(log.duration / 1000).toFixed(2)}s`
      : "N/A";
    const errorStr = log.error ? ` | Error: ${log.error}` : "";

    const logLine = `${log.timestamp} | ${statusEmoji} ${log.status.toUpperCase()} | ${log.nodeLabel} (${log.nodeId}) | Duration: ${durationStr} | Progress: ${log.progress.completed}/${log.progress.total} (${log.progress.percentage})${errorStr}\n`;

    // Append to file (creates file if doesn't exist)
    await fs.appendFile(logFilePath, logLine, "utf-8");

    console.log(
      `📝 [ProgressLogger] Logged node: ${log.nodeLabel} (${log.progress.completed}/${log.progress.total})`,
    );

    // Update database with progress (for admin panel real-time display)
    if (prismaModule) {
      try {
        await prismaModule.prisma.executionInstance.updateMany({
          where: { jobId },
          data: {
            executedNodes: log.progress.completed,
            failedNodes: log.progress.failed,
            currentNodeId: log.nodeId,
          },
        });
      } catch (dbError) {
        // Non-critical - don't fail the execution if DB update fails
        console.error(
          "[ProgressLogger] Failed to update DB progress (non-critical):",
          dbError,
        );
      }
    }
  } catch (error) {
    console.error(
      "[ProgressLogger] Failed to log node progress (non-critical):",
      error,
    );
  }
}

/**
 * Write execution start header to log file
 */
export async function logExecutionStart(
  jobId: string,
  projectName: string,
  totalNodes: number,
): Promise<void> {
  const enableFileLogging = true;

  if (!enableFileLogging || !fs || !path) {
    return;
  }

  try {
    await ensureLogsDir();

    const logFilePath = getLogFilePath(jobId, projectName);

    const header = `
================================================================================
📊 EXECUTION STARTED
================================================================================
Timestamp: ${new Date().toISOString()}
Project: ${projectName}
Job ID: ${jobId}
Total Nodes: ${totalNodes}
================================================================================

`;

    await fs.writeFile(logFilePath, header, "utf-8");
    console.log(
      `📝 [ProgressLogger] Created log file: ${path.basename(logFilePath)}`,
    );
  } catch (error) {
    console.error(
      "[ProgressLogger] Failed to create log file (non-critical):",
      error,
    );
  }
}

/**
 * Write execution completion footer to log file
 */
export async function logExecutionComplete(
  jobId: string,
  projectName: string,
  stats: { completed: number; failed: number; total: number; duration: number },
): Promise<void> {
  const enableFileLogging = true;

  if (!enableFileLogging || !fs || !path) {
    return;
  }

  try {
    const logFilePath = getLogFilePath(jobId, projectName);

    const successRate =
      stats.total > 0
        ? ((stats.completed / stats.total) * 100).toFixed(1)
        : "0.0";
    const durationMinutes = (stats.duration / 1000 / 60).toFixed(2);

    const footer = `
================================================================================
📊 EXECUTION COMPLETED
================================================================================
Timestamp: ${new Date().toISOString()}
Duration: ${durationMinutes} minutes (${stats.duration}ms)
Total Nodes: ${stats.total}
Completed: ${stats.completed}
Failed: ${stats.failed}
Success Rate: ${successRate}%
Status: ${stats.failed === 0 ? "✅ SUCCESS" : "⚠️ PARTIAL FAILURE"}
================================================================================
`;

    await fs.appendFile(logFilePath, footer, "utf-8");
    console.log(
      `📝 [ProgressLogger] Execution completed: ${stats.completed}/${stats.total} nodes`,
    );
  } catch (error) {
    console.error(
      "[ProgressLogger] Failed to log execution complete (non-critical):",
      error,
    );
  }
}
