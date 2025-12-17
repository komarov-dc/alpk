/**
 * Log File Helper Utilities
 * Functions for finding and reading progress log files
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Find progress log file by job ID
 * Returns null if not found
 */
export async function findProgressLogFile(jobId: string): Promise<string | null> {
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'executions');
    const files = await fs.readdir(logsDir);

    // Find file matching pattern: *_<jobId>_progress.log
    const logFile = files.find(file =>
      file.includes(jobId) && file.endsWith('_progress.log')
    );

    return logFile ? path.join(logsDir, logFile) : null;
  } catch (error) {
    console.error('[LogFileHelper] Error finding log file:', error);
    return null;
  }
}

/**
 * Read progress log file with optional offset
 * Returns array of lines starting from offset
 */
export async function readProgressLog(
  jobId: string,
  offset: number = 0
): Promise<{ lines: string[]; total: number }> {
  try {
    const logFilePath = await findProgressLogFile(jobId);

    if (!logFilePath) {
      return { lines: [], total: 0 };
    }

    const content = await fs.readFile(logFilePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim() !== '');

    // Return only new lines from offset
    const newLines = offset > 0 ? allLines.slice(offset) : allLines;

    return {
      lines: newLines,
      total: allLines.length
    };
  } catch (error) {
    console.error('[LogFileHelper] Error reading log file:', error);
    return { lines: [], total: 0 };
  }
}

/**
 * Parse progress log line into structured data
 * Format: "2025-11-19T14:22:19.443Z | ✅ COMPLETED | node_label (node_id) | Duration: 10.5s | Progress: 50/88 (57%)"
 */
export interface ParsedLogLine {
  timestamp: string;
  status: 'completed' | 'failed';
  nodeLabel: string;
  nodeId?: string;
  duration?: string;
  completed?: number;
  total?: number;
  percentage?: string;
  error?: string;
  raw: string;
}

export function parseProgressLine(line: string): ParsedLogLine | null {
  try {
    // Try to parse structured format
    const regex = /^(.+?) \| (✅|❌) (\w+) \| (.+?)(?: \((.+?)\))? \| Duration: (.+?) \| Progress: (\d+)\/(\d+) \((.+?)\)(.*)$/;
    const match = line.match(regex);

    if (match) {
      return {
        timestamp: match[1] || '',
        status: (match[3]?.toLowerCase() as 'completed' | 'failed') || 'completed',
        nodeLabel: match[4] || '',
        nodeId: match[5],
        duration: match[6],
        completed: parseInt(match[7] || '0'),
        total: parseInt(match[8] || '0'),
        percentage: match[9] || '0%',
        error: match[10]?.trim() || undefined,
        raw: line
      };
    }

    // Fallback: return raw line
    return {
      timestamp: new Date().toISOString(),
      status: 'completed',
      nodeLabel: line,
      raw: line
    };
  } catch (error) {
    console.error('[LogFileHelper] Error parsing line:', error);
    return null;
  }
}
