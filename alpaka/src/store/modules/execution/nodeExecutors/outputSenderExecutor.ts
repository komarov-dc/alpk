/**
 * Executor for Output Sender nodes
 * Sends job results back to backend API or saves to files for batch jobs
 */

import { Node } from '@xyflow/react';
import { NodeExecutor } from '../types';
import { IExecutionContext } from '../executionContext';
import { OutputSenderNodeData } from '@/types/nodeTypes';
import { logger } from '@/utils/logger';

// Dynamic import for fs/path (only available on server-side)
// These will be loaded when running in worker context
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

// Initialize fs/path modules (only works on server)
async function initFsModules() {
  if (typeof window === 'undefined' && !fs) {
    try {
      fs = await import('fs');
      path = await import('path');
    } catch (e) {
      // Running in browser context - fs not available
    }
  }
}

// Retry configuration interface
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterPercent: number;
  transientPatterns: string[];
  permanentPatterns: string[];
}

// Default retry configuration for HTTP requests (faster than LLM)
const DEFAULT_HTTP_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,        // 1 second (faster than LLM)
  maxDelay: 30000,        // 30 seconds
  jitterPercent: 25,      // ±25% jitter
  transientPatterns: [
    // Gateway errors
    '502', '503', '504',
    'bad gateway', 'service unavailable', 'gateway timeout',

    // Network errors
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH',
    'timeout', 'timed out', 'connection reset', 'connection refused',
    'network error', 'socket hang up', 'fetch failed',

    // DNS errors
    'getaddrinfo', 'eai_again',

    // Server overload
    'server overloaded', 'temporarily unavailable', 'try again later'
  ],
  permanentPatterns: [
    // Client errors
    '400', '401', '403', '404', '405',
    'bad request', 'unauthorized', 'forbidden', 'not found',
    'method not allowed',

    // Validation errors
    'validation error', 'invalid', 'missing required'
  ]
};

export class OutputSenderNodeExecutor implements NodeExecutor {
  private retryConfig: RetryConfig = DEFAULT_HTTP_RETRY_CONFIG;

  canExecute(node: Node): boolean {
    return node.type === 'outputSender';
  }

  /**
   * Main execute method with retry logic
   */
  async execute(
    node: Node,
    context: IExecutionContext
  ): Promise<void> {
    return this.executeWithRetry(node, context, 0);
  }

  /**
   * Execute with retry logic for transient HTTP errors
   */
  private async executeWithRetry(
    node: Node,
    context: IExecutionContext,
    attempt: number
  ): Promise<void> {
    try {
      // Execute the core HTTP request logic
      await this.executeCore(node, context);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorType = this.classifyError(errorObj);

      // Check if we should retry
      const shouldRetry = errorType === 'transient' && attempt < this.retryConfig.maxRetries;

      if (shouldRetry) {
        const delay = this.calculateBackoff(attempt);
        const nodeLabel = node.data?.label || node.id;

        logger.warn(
          `🔄 OutputSender node "${nodeLabel}": Transient error detected, retry ${attempt + 1}/${this.retryConfig.maxRetries} ` +
          `after ${delay}ms. Error: ${errorObj.message}`
        );

        // Wait with exponential backoff + jitter
        await this.sleep(delay);

        // Recursive retry
        return this.executeWithRetry(node, context, attempt + 1);
      }

      // Max retries exceeded OR permanent error
      const nodeLabel = node.data?.label || node.id;

      if (attempt >= this.retryConfig.maxRetries) {
        const finalError = new Error(
          `❌ OutputSender node "${nodeLabel}" failed after ${this.retryConfig.maxRetries} retries. Last error: ${errorObj.message}`
        );
        logger.error(finalError.message);
        throw finalError;
      } else {
        logger.error(`❌ OutputSender node "${nodeLabel}" failed permanently: ${errorObj.message}`);
        throw errorObj;
      }
    }
  }

  /**
   * Core execution logic (without retry)
   */
  private async executeCore(
    node: Node,
    context: IExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    const data = node.data as unknown as OutputSenderNodeData;
    
    try {
      // Get configuration from environment variables (centralized in admin settings)
      const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:4000';
      const endpoint = '/api/external/jobs'; // Fixed endpoint path
      const method = data.config?.method || 'PATCH';
      const secretKey = process.env.ALPAKA_SHARED_SECRET || process.env.NEXT_PUBLIC_ALPAKA_SECRET || '';
      const autoSend = data.config?.autoSend !== false;
      
      // Get mapping configuration
      const jobIdVariable = data.mapping?.jobIdVariable || 'job_id';
      const statusVariable = data.mapping?.statusVariable || 'job_status';
      const reportsMapping = data.mapping?.reports || {
        'Adapted Report': 'adapted_report',
        'Professional Report': 'professional_report',
        'Aggregate Score Profile': 'aggregate_score_profile'
      };
      
      // Only send if autoSend is enabled
      if (!autoSend) {
        const result = {
          nodeId: node.id,
          success: true,
          output: {
            type: 'outputSender',
            sent: false,
            message: 'Auto-send disabled - use manual send button'
          },
          duration: Date.now() - startTime
        };
        
        context.setExecutionResults({
          [node.id]: result
        });
        return;
      }
      
      // Get global variables
      const globalVariables = context.getGlobalVariables();
      
      // Get job ID from global variables
      const jobIdVar = globalVariables[jobIdVariable];
      const jobId = typeof jobIdVar === 'string' ? jobIdVar : jobIdVar?.value;
      if (!jobId) {
        throw new Error(`Job ID variable "${jobIdVariable}" not found`);
      }

      // Get session ID from global variables (required by UI)
      const sessionIdVar = globalVariables['job_session_id'];
      const sessionId = typeof sessionIdVar === 'string' ? sessionIdVar : sessionIdVar?.value;

      // Get status (default to "completed")
      const statusVar = globalVariables[statusVariable];
      const status = (typeof statusVar === 'string' ? statusVar : statusVar?.value) || 'completed';

      // Collect reports from global variables
      const reports: Record<string, unknown> = {};
      logger.info('Output Sender: Collecting reports from variables', {
        mapping: reportsMapping,
        availableVariables: Object.keys(globalVariables).length
      });

      for (const [reportKey, variableName] of Object.entries(reportsMapping)) {
        const varData = globalVariables[variableName];
        const value = typeof varData === 'string' ? varData : varData?.value;
        if (value) {
          reports[reportKey] = value;
          logger.info(`Output Sender: Found report "${reportKey}" from variable "${variableName}"`, {
            preview: String(value).substring(0, 100)
          });
        } else {
          logger.warn(`Output Sender: Report "${reportKey}" variable "${variableName}" not found`);
        }
      }

      logger.info(`Output Sender: Collected ${Object.keys(reports).length}/${Object.keys(reportsMapping).length} reports`);

      // Check if this is a batch job (headless mode - save to files instead of HTTP)
      const batchIdVar = globalVariables['batch_id'];
      const batchId = typeof batchIdVar === 'string' ? batchIdVar : batchIdVar?.value;
      const outputDirVar = globalVariables['output_dir'];
      const outputDir = typeof outputDirVar === 'string' ? outputDirVar : outputDirVar?.value;

      if (batchId && outputDir) {
        // BATCH MODE: Save reports to files instead of HTTP
        return this.saveReportsToFiles(node, context, {
          batchId,
          outputDir,
          jobId,
          sessionId,
          reports,
          startTime,
        });
      }

      // NORMAL MODE: Send via HTTP to frontend
      // Build URL
      const url = `${baseUrl}${endpoint}/${jobId}`;

      // Build payload with jobId and sessionId (required by UI)
      const payload: Record<string, unknown> = {
        jobId: jobId,
        sessionId: sessionId || undefined,
        status: status,
        completedAt: new Date().toISOString(),
      };

      // Add reports if configured
      if (data.config?.includeReports !== false && Object.keys(reports).length > 0) {
        payload.reports = reports;
      }
      
      // Add custom fields if configured
      if (data.config?.customFields) {
        for (const [fieldName, variableName] of Object.entries(data.config.customFields)) {
          const varData = globalVariables[variableName];
          const value = typeof varData === 'string' ? varData : varData?.value;
          if (value !== undefined) {
            payload[fieldName] = value;
          }
        }
      }

      logger.info('Output Sender: Sending request', {
        url,
        jobId,
        status,
        reportsCount: Object.keys(reports).length
      });

      // Send request
      const response = await fetch(url, {
        method: method,
        headers: {
          'x-backend-secret': secretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      
      const apiResponse = await response.json();

      logger.info('Output Sender: Successfully sent reports to frontend', {
        jobId,
        reportsCount: Object.keys(reports).length
      });

      // Return success result
      const result = {
        nodeId: node.id,
        success: true,
        output: {
          type: 'outputSender',
          sent: true,
          jobId: jobId,
          status: status,
          reportsCount: Object.keys(reports).length,
          apiResponse: apiResponse
        },
        duration: Date.now() - startTime
      };
      
      context.setExecutionResults({
        [node.id]: result
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Output Sender: Failed to send reports', error instanceof Error ? error : new Error(String(error)));

      const result = {
        nodeId: node.id,
        success: false,
        error: errorMsg,
        output: {
          type: 'outputSender',
          sent: false
        },
        duration: Date.now() - startTime
      };
      
      context.setExecutionResults({
        [node.id]: result
      });
      
      throw error;
    }
  }

  /**
   * Classify error as transient (retryable) or permanent (not retryable)
   */
  private classifyError(error: Error): 'transient' | 'permanent' {
    const errorMessage = error.message.toLowerCase();

    // Check if error matches transient patterns
    const isTransient = this.retryConfig.transientPatterns.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );

    if (isTransient) {
      return 'transient';
    }

    // Check if error matches permanent patterns
    const isPermanent = this.retryConfig.permanentPatterns.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );

    if (isPermanent) {
      return 'permanent';
    }

    // Default to permanent if we can't classify
    // Better to stop than to waste retries on unknown errors
    return 'permanent';
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    // Exponential: 2^attempt * baseDelay
    const exponentialDelay = Math.pow(2, attempt) * this.retryConfig.baseDelay;

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);

    // Add jitter (±jitterPercent%)
    const jitterRange = cappedDelay * (this.retryConfig.jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save reports to files for batch jobs (headless mode)
   */
  private async saveReportsToFiles(
    node: Node,
    context: IExecutionContext,
    params: {
      batchId: string;
      outputDir: string;
      jobId: string;
      sessionId: string | undefined;
      reports: Record<string, unknown>;
      startTime: number;
    }
  ): Promise<void> {
    const { batchId, outputDir, jobId, reports, startTime } = params;

    try {
      // Initialize fs modules (server-side only)
      await initFsModules();

      if (!fs || !path) {
        throw new Error('File system modules not available (running in browser context?)');
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Map report keys to file names
      const fileNameMap: Record<string, string> = {
        'Adapted Report': 'adapted.md',
        'Professional Report': 'professional.md',
        'Aggregate Score Profile': 'scores.md',
      };

      const savedFiles: string[] = [];

      // Save each report to a file
      for (const [reportKey, content] of Object.entries(reports)) {
        if (!content) continue;

        const fileName = fileNameMap[reportKey] || `${reportKey.toLowerCase().replace(/\s+/g, '_')}.md`;
        const filePath = path.join(outputDir, fileName);

        // Write content to file
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        fs.writeFileSync(filePath, contentStr, 'utf-8');
        savedFiles.push(fileName);

        logger.info(`Output Sender (Batch): Saved "${reportKey}" to ${filePath}`);
      }

      logger.info(`Output Sender (Batch): Successfully saved ${savedFiles.length} reports to ${outputDir}`);

      // Return success result
      const result = {
        nodeId: node.id,
        success: true,
        output: {
          type: 'outputSender',
          sent: false, // Not sent via HTTP
          savedToFiles: true,
          batchId: batchId,
          jobId: jobId,
          outputDir: outputDir,
          savedFiles: savedFiles,
          reportsCount: savedFiles.length,
        },
        duration: Date.now() - startTime
      };

      context.setExecutionResults({
        [node.id]: result
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Output Sender (Batch): Failed to save reports to files', error instanceof Error ? error : new Error(String(error)));

      const result = {
        nodeId: node.id,
        success: false,
        error: errorMsg,
        output: {
          type: 'outputSender',
          sent: false,
          savedToFiles: false,
          batchId: batchId,
        },
        duration: Date.now() - startTime
      };

      context.setExecutionResults({
        [node.id]: result
      });

      throw error;
    }
  }
}
