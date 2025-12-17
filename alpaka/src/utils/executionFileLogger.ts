/**
 * Execution File Logger
 * Saves execution logs to JSON files for each questionnaire (job)
 *
 * Each file contains:
 * - Execution metadata (jobId, sessionId, projectId, duration, status)
 * - Questionnaire responses
 * - Per-node logs (input, output, duration, status)
 * - Final results
 */

import { promises as fs } from 'fs';
import path from 'path';

// Directory where execution logs are stored
const LOGS_DIR = path.join(process.cwd(), 'logs', 'executions');

export interface ExecutionFileLogData {
  // Metadata
  executionInstanceId: string;
  projectId: string;
  projectName: string;
  jobId: string | null;
  sessionId: string | null;

  // Execution info
  status: string;
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds

  // Stats
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  skippedNodes: number;

  // Questionnaire responses (from global variables)
  questionnaireResponses: Record<string, unknown> | null;

  // Global variables snapshot
  globalVariables: Record<string, { name: string; value: string; description?: string; folder?: string | null }>;

  // Per-node execution logs
  nodeLogs: Array<{
    nodeId: string;
    nodeLabel?: string;
    status: 'completed' | 'failed';
    duration: number | null;
    input: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
    error: string | null;
  }>;

  // Final execution results (raw)
  executionResults: Record<string, unknown>;
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
    throw error;
  }
}

/**
 * Generate filename for execution log
 * Format: {projectName}_{jobId}_{timestamp}.json
 */
function generateLogFilename(data: ExecutionFileLogData): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectName = data.projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const jobId = data.jobId || 'unknown';

  return `${projectName}_${jobId}_${timestamp}.json`;
}

/**
 * Save execution log to file
 * @returns Full path to the saved log file
 */
export async function saveExecutionLogToFile(data: ExecutionFileLogData): Promise<string> {
  try {
    // Ensure directory exists
    await ensureLogsDir();

    // Generate filename
    const filename = generateLogFilename(data);
    const filePath = path.join(LOGS_DIR, filename);

    // Prepare log data with readable formatting
    const logData = {
      metadata: {
        executionInstanceId: data.executionInstanceId,
        projectId: data.projectId,
        projectName: data.projectName,
        jobId: data.jobId,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      },
      execution: {
        status: data.status,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        durationMs: data.duration,
        durationMinutes: (data.duration / 1000 / 60).toFixed(2)
      },
      stats: {
        totalNodes: data.totalNodes,
        executedNodes: data.executedNodes,
        failedNodes: data.failedNodes,
        skippedNodes: data.skippedNodes,
        successRate: data.totalNodes > 0 ?
          ((data.executedNodes / data.totalNodes) * 100).toFixed(1) + '%' :
          'N/A'
      },
      questionnaireResponses: data.questionnaireResponses,
      globalVariables: data.globalVariables,
      nodeLogs: data.nodeLogs,
      executionResults: data.executionResults
    };

    // Write to file with pretty formatting
    await fs.writeFile(filePath, JSON.stringify(logData, null, 2), 'utf-8');

    console.log(`📝 [FileLogger] Saved execution log: ${filename}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Size: ${(JSON.stringify(logData).length / 1024).toFixed(2)} KB`);

    return filePath;

  } catch (error) {
    console.error('❌ [FileLogger] Failed to save execution log:', error);
    throw error;
  }
}

/**
 * List all execution log files
 */
export async function listExecutionLogFiles(): Promise<string[]> {
  try {
    await ensureLogsDir();
    const files = await fs.readdir(LOGS_DIR);
    return files.filter(f => f.endsWith('.json')).sort().reverse(); // newest first
  } catch (error) {
    console.error('Failed to list execution log files:', error);
    return [];
  }
}

/**
 * Read execution log file
 */
export async function readExecutionLogFile(filename: string): Promise<ExecutionFileLogData | null> {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read execution log file: ${filename}`, error);
    return null;
  }
}
