#!/usr/bin/env ts-node
/**
 * Alpaka Background Worker - Trigger Polling
 * Polls external API for new jobs and triggers pipeline execution
 *
 * Environment Variables:
 * - PROJECT_ID: Project ID to execute (required)
 * - PROJECT_NAME: Project name for logging (required)
 * - MODE_FILTER: Job mode to filter (PSYCHODIAGNOSTICS or CAREER_GUIDANCE)
 * - POLL_INTERVAL: Polling interval in ms (default: 10000)
 * - API_BASE_URL: Base URL for API calls (default: http://localhost:3000)
 * - ALPAKA_SECRET: Shared secret for external API
 * - ALPAKA_INTERNAL_SECRET: Internal secret for internal API
 */

// Environment variables are provided by PM2 via ecosystem.config.js
// import 'dotenv/config';
import { Agent } from "undici";
import { PrismaClient } from "@prisma/client";
import { logger } from "../src/utils/logger";
import type { LoggableError } from "../src/types/logger";

// Convert unknown error to LoggableError type
function normalizeError(error: unknown): LoggableError {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return error as LoggableError;
  }
  return String(error);
}

/**
 * Sanitize error messages to remove sensitive data (tokens, secrets, API keys)
 */
function sanitizeErrorMessage(message: string): string {
  // Patterns for common sensitive data
  const patterns = [
    // API keys and tokens (common formats)
    /([a-zA-Z0-9_-]{20,})/g, // Long alphanumeric strings (potential tokens)
    /Bearer\s+[a-zA-Z0-9._-]+/gi, // Bearer tokens
    /api[_-]?key[=:]\s*["']?[a-zA-Z0-9_-]+["']?/gi, // API keys
    /secret[=:]\s*["']?[a-zA-Z0-9_/+=]+["']?/gi, // Secrets
    /password[=:]\s*["']?[^\s"']+["']?/gi, // Passwords
    /token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, // Generic tokens
    // Email addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ];

  let sanitized = message;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

/**
 * Retry wrapper for critical database operations
 * Uses exponential backoff: 1s, 2s, 4s
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = "operation",
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        logger.warn(
          `⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// Job status types and valid transitions
type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

const VALID_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["processing", "cancelled"],
  processing: ["completed", "failed", "queued"], // queued = reset for retry
  completed: [], // terminal state
  failed: ["queued"], // can retry
  cancelled: ["queued"], // can retry
};

/**
 * Validate job status transition
 * Returns true if transition is valid, false otherwise
 */
function isValidStatusTransition(from: JobStatus, to: JobStatus): boolean {
  const validNextStates = VALID_STATUS_TRANSITIONS[from];
  return validNextStates?.includes(to) ?? false;
}

/**
 * Validate and log status transition
 * Logs warning if transition is invalid but doesn't throw
 */
function validateStatusTransition(
  jobId: string,
  from: string | null,
  to: string,
): boolean {
  // If no previous status, allow any initial state
  if (!from) {
    return true;
  }

  const fromStatus = from as JobStatus;
  const toStatus = to as JobStatus;

  if (!isValidStatusTransition(fromStatus, toStatus)) {
    logger.warn(
      `⚠️ Invalid status transition for job ${jobId}: ${from} -> ${to}`,
    );
    return false;
  }

  return true;
}

// Create dedicated PrismaClient for this worker
// Singleton pattern not needed - workers do cold restarts (no HMR like Next.js)
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

// HTTP agent timeout will be set after CONFIG is loaded
let httpAgent: Agent;

// Job type from external API
interface ExternalJob {
  jobId?: string;
  id?: string;
  sessionId: string;
  mode: "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE";
  responses: Record<string, unknown>;
  userData?: Record<string, unknown>;
  createdAt?: string;
}

// Configuration from environment (all timeouts configurable)
const CONFIG = {
  projectId: process.env.PROJECT_ID,
  projectName: process.env.PROJECT_NAME,
  modeFilter: process.env.MODE_FILTER as
    | "PSYCHODIAGNOSTICS"
    | "CAREER_GUIDANCE"
    | undefined,
  pollInterval: parseInt(process.env.POLL_INTERVAL || "10000"),
  externalApiBaseUrl:
    process.env.EXTERNAL_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:3000",
  internalApiBaseUrl:
    process.env.INTERNAL_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:3000",
  externalSecret: process.env.ALPAKA_SECRET || process.env.ALPAKA_SHARED_SECRET,
  internalSecret:
    process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET,
  // Configurable timeouts (in milliseconds)
  externalApiTimeoutMs: parseInt(
    process.env.EXTERNAL_API_TIMEOUT_MS || "30000",
  ), // 30s default
  pipelineTimeoutMs: parseInt(process.env.PIPELINE_TIMEOUT_MS || "5400000"), // 90min default
  maxJobRuntimeMs: parseInt(process.env.MAX_JOB_RUNTIME_MS || "5400000"), // 90min default
  recoveryIntervalMs: parseInt(process.env.RECOVERY_INTERVAL_MS || "3600000"), // 1h default
  maxConcurrentJobs: Math.max(
    1,
    Math.min(100, parseInt(process.env.MAX_CONCURRENT_JOBS || "1")),
  ),
};

// Validate required config
if (!CONFIG.projectId) {
  logger.error("❌ PROJECT_ID environment variable is required");
  process.exit(1);
}

if (!CONFIG.projectName) {
  logger.error("❌ PROJECT_NAME environment variable is required");
  process.exit(1);
}

if (!CONFIG.externalSecret || CONFIG.externalSecret.trim() === "") {
  logger.error(
    "❌ ALPAKA_SECRET environment variable must be a non-empty value",
  );
  process.exit(1);
}

if (!CONFIG.internalSecret || CONFIG.internalSecret.trim() === "") {
  logger.error(
    "❌ ALPAKA_INTERNAL_SECRET environment variable must be a non-empty value",
  );
  process.exit(1);
}

// Security check: Require explicit API URLs in production (no default http://localhost)
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  if (!process.env.EXTERNAL_API_BASE_URL && !process.env.API_BASE_URL) {
    logger.error("❌ EXTERNAL_API_BASE_URL must be set in production");
    process.exit(1);
  }
  if (!process.env.INTERNAL_API_BASE_URL && !process.env.API_BASE_URL) {
    logger.error("❌ INTERNAL_API_BASE_URL must be set in production");
    process.exit(1);
  }
  // Warn if using HTTP instead of HTTPS in production
  if (
    CONFIG.externalApiBaseUrl.startsWith("http://") &&
    !CONFIG.externalApiBaseUrl.includes("localhost")
  ) {
    logger.warn(
      "⚠️ SECURITY WARNING: Using HTTP instead of HTTPS for external API in production!",
    );
  }
  if (
    CONFIG.internalApiBaseUrl.startsWith("http://") &&
    !CONFIG.internalApiBaseUrl.includes("localhost")
  ) {
    logger.warn(
      "⚠️ SECURITY WARNING: Using HTTP instead of HTTPS for internal API in production!",
    );
  }
}

// Initialize HTTP agent with configurable timeouts for long-running pipeline execution
httpAgent = new Agent({
  headersTimeout: CONFIG.pipelineTimeoutMs,
  bodyTimeout: CONFIG.pipelineTimeoutMs,
  connectTimeout: 60 * 1000, // 1 minute for initial connection
});

// Generate unique worker ID for atomic job claiming
// PM2 sets NODE_APP_INSTANCE (0, 1, 2, ...) when running in cluster mode
const WORKER_ID = `worker-${CONFIG.projectName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}-${process.env.NODE_APP_INSTANCE || 0}-${process.pid}`;

logger.info(`🚀 Starting Alpaka Worker`);
logger.info(`   Project: ${CONFIG.projectName} (${CONFIG.projectId})`);
logger.info(`   Mode Filter: ${CONFIG.modeFilter || "ALL"}`);
logger.info(`   Poll Interval: ${CONFIG.pollInterval}ms`);
logger.info(`   Worker ID: ${WORKER_ID}`);
logger.info(`   External API (polling): ${CONFIG.externalApiBaseUrl}`);
logger.info(`   Internal API (pipeline): ${CONFIG.internalApiBaseUrl}`);
logger.info("");

// Statistics
const stats = {
  pollingCount: 0,
  jobsFound: 0,
  jobsProcessed: 0,
  jobsFailed: 0,
  lastPollTime: null as Date | null,
  lastJobTime: null as Date | null,
};

// Timeout for external API calls (configurable, default 30 seconds)
const EXTERNAL_API_TIMEOUT_MS = CONFIG.externalApiTimeoutMs;

/**
 * Fetch jobs from external API (front-end)
 */
async function fetchJobs(): Promise<ExternalJob[]> {
  // Fetch only jobs with status 'queued' from frontend
  const url = `${CONFIG.externalApiBaseUrl}/api/external/jobs?status=queued`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    EXTERNAL_API_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Backend-Secret": CONFIG.externalSecret!,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage =
      error instanceof Error && error.name === "AbortError"
        ? "Request timeout (30s)"
        : normalizeError(error);
    logger.error(
      `❌ [${new Date().toISOString()}] Error fetching jobs:`,
      errorMessage,
    );
    return [];
  }
}

/**
 * Fetch batch jobs from local database (headless mode - no frontend needed)
 * These are jobs created via /admin/batch with batchId set
 */
async function fetchBatchJobs(): Promise<ExternalJob[]> {
  try {
    // Find queued jobs that have batchId (batch jobs)
    const batchJobs = await prisma.processingJob.findMany({
      where: {
        status: "queued",
        batchId: { not: null },
        // Filter by mode if configured
        ...(CONFIG.modeFilter ? { mode: CONFIG.modeFilter } : {}),
      },
      take: 50, // Limit to prevent memory issues
      orderBy: { createdAt: "asc" }, // FIFO order
    });

    // Convert to ExternalJob format
    return batchJobs.map((job) => ({
      jobId: job.id,
      id: job.id,
      sessionId: job.sessionId,
      mode: job.mode as "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE",
      responses: job.responses as Record<string, unknown>,
      // Mark as batch job for special handling
      userData: {
        isBatch: true,
        batchId: job.batchId,
        fileName: job.fileName,
        outputDir: (job.responses as Record<string, unknown>)?.output_dir,
      },
    }));
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Error fetching batch jobs:`,
      normalizeError(error),
    );
    return [];
  }
}

/**
 * Atomic claim: Mark job as processing (using local DB for coordination)
 * This prevents multiple workers from processing the same job
 * Uses $transaction with interactive mode for atomicity
 */
async function claimJob(jobId: string, job: ExternalJob): Promise<boolean> {
  try {
    // Use interactive transaction for atomic claim
    const claimed = await prisma.$transaction(async (tx) => {
      // First, check if job exists
      const existingJob = await tx.processingJob.findUnique({
        where: { id: jobId },
        select: { status: true, workerId: true },
      });

      if (!existingJob) {
        // Job doesn't exist - create and claim in one atomic operation
        await tx.processingJob.create({
          data: {
            id: jobId,
            sessionId: job.sessionId,
            mode: job.mode,
            status: "processing",
            workerId: WORKER_ID,
            responses: job.responses as any,
          },
        });
        logger.info(
          `✅ [${new Date().toISOString()}] Created and claimed job ${jobId}`,
        );
        return true;
      }

      // Job exists - try to claim it atomically
      if (existingJob.status !== "queued" || existingJob.workerId !== null) {
        // Already processing or claimed by another worker
        return false;
      }

      // Atomic update with condition check
      const result = await tx.processingJob.updateMany({
        where: {
          id: jobId,
          status: "queued",
          workerId: null,
        },
        data: {
          status: "processing",
          workerId: WORKER_ID,
          updatedAt: new Date(),
        },
      });

      return result.count > 0;
    });

    if (!claimed) {
      return false;
    }

    // Also mark as processing in external API (front-end) - non-blocking
    const url = `${CONFIG.externalApiBaseUrl}/api/external/jobs/${jobId}`;
    fetch(url, {
      method: "PATCH",
      headers: {
        "X-Backend-Secret": CONFIG.externalSecret!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "processing" }),
    }).catch((err) => {
      logger.warn(
        `⚠️ Failed to sync status to external API (non-critical):`,
        normalizeError(err),
      );
    });

    return true;
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Error claiming job:`,
      normalizeError(error),
    );
    return false;
  }
}

/**
 * Mark job as completed or failed (front-end)
 */
async function markJobComplete(
  jobId: string,
  success: boolean,
  error?: string,
): Promise<boolean> {
  const url = `${CONFIG.externalApiBaseUrl}/api/external/jobs/${jobId}`;
  const newStatus = success ? "completed" : "failed";
  const completedAt = new Date();

  try {
    // Get current status for validation
    const currentJob = await prisma.processingJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    // Validate status transition
    validateStatusTransition(jobId, currentJob?.status ?? null, newStatus);

    // 1. Update local database (Alpaka backend) with retry for resilience
    await withRetry(
      () =>
        prisma.processingJob.update({
          where: { id: jobId },
          data: {
            status: newStatus,
            error: error ? sanitizeErrorMessage(error) : null,
            completedAt,
          },
        }),
      3,
      `markJobComplete(${jobId})`,
    );

    // 2. Update external API (AlpakaUI frontend) with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      EXTERNAL_API_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "X-Backend-Secret": CONFIG.externalSecret!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          error: error || undefined,
          completedAt: completedAt.toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          `⚠️ [${new Date().toISOString()}] Failed to sync status to external API (non-critical): ${response.status}`,
        );
        // Don't throw - local DB is already updated, external sync is non-critical
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMessage =
        fetchError instanceof Error && fetchError.name === "AbortError"
          ? "External API timeout (30s)"
          : normalizeError(fetchError);
      logger.warn(
        `⚠️ [${new Date().toISOString()}] Failed to sync status to external API (non-critical):`,
        errorMessage,
      );
      // Don't throw - local DB is already updated, external sync is non-critical
    }

    return true;
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Error marking job complete:`,
      normalizeError(error),
    );
    return false;
  }
}

/**
 * Execute pipeline via Internal API (local Alpaka backend)
 */
async function executePipeline(
  job: ExternalJob,
  externalAbortSignal?: AbortSignal,
): Promise<boolean> {
  const url = `${CONFIG.internalApiBaseUrl}/api/internal/execute-flow`;

  try {
    const jobId = job.jobId || job.id;
    if (!jobId) {
      throw new Error("Job must have either jobId or id");
    }

    // Check if already aborted before starting
    if (externalAbortSignal?.aborted) {
      logger.info(
        `⚠️ [${new Date().toISOString()}] Job ${jobId} aborted before pipeline start`,
      );
      return false;
    }

    const globalVariables: Record<string, string> = {
      job_id: jobId,
      job_session_id: job.sessionId,
      questionnaire_responses: JSON.stringify(job.responses),
    };

    // Add any additional user data
    if (job.userData) {
      Object.entries(job.userData).forEach(([key, value]) => {
        globalVariables[key] = String(value);
      });
    }

    // For batch jobs, also pass batch-specific variables at top level
    // These are needed by OutputSender to save files instead of HTTP
    const responses = job.responses as Record<string, unknown>;
    if (responses?.batch_id) {
      globalVariables.batch_id = String(responses.batch_id);
    }
    if (responses?.output_dir) {
      globalVariables.output_dir = String(responses.output_dir);
    }
    if (responses?.file_name) {
      globalVariables.file_name = String(responses.file_name);
    }
    // For batch jobs, use raw_text as the main input (replaces questionnaire format)
    if (responses?.raw_text) {
      globalVariables.raw_text = String(responses.raw_text);
    }

    // Set configurable timeout for long-running pipeline execution
    // BigFive can take 50-60 minutes, Prof takes 12-17 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONFIG.pipelineTimeoutMs,
    );

    // Listen to external abort signal and propagate to our controller
    // Store handler reference for cleanup to prevent memory leak
    let externalAbortHandler: (() => void) | null = null;
    if (externalAbortSignal && !externalAbortSignal.aborted) {
      externalAbortHandler = () => {
        logger.info(
          `🛑 [${new Date().toISOString()}] External abort signal received for job ${jobId}`,
        );
        controller.abort();
      };
      externalAbortSignal.addEventListener("abort", externalAbortHandler);
    }

    // Cleanup function to remove event listener
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (externalAbortSignal && externalAbortHandler) {
        externalAbortSignal.removeEventListener("abort", externalAbortHandler);
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Alpaka-Internal-Secret": CONFIG.internalSecret!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: CONFIG.projectId,
          globalVariables,
          clearResults: true, // Always execute from scratch to generate fresh reports
        }),
        signal: controller.signal,
        // @ts-ignore - dispatcher is valid option for Node.js fetch (undici)
        dispatcher: httpAgent, // Use custom agent with extended timeouts
      });

      cleanup();

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "(unable to read error)");
        throw new Error(
          `Internal API error ${response.status}: ${sanitizeErrorMessage(errorText)}`,
        );
      }

      const result = await response.json();
      logger.info(
        `✅ [${new Date().toISOString()}] Pipeline executed successfully`,
      );
      logger.info(`   Execution ID: ${result.executionId}`);
      logger.info(
        `   Stats: Executed ${result.stats.executed}, Failed ${result.stats.failed}, Duration ${result.stats.duration}ms`,
      );

      return result.success;
    } catch (fetchError) {
      cleanup();
      throw fetchError;
    }
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Error executing pipeline:`,
      normalizeError(error),
    );
    return false;
  }
}

// Maximum concurrent jobs to process (from CONFIG, validated 1-100)
const MAX_CONCURRENT_JOBS = CONFIG.maxConcurrentJobs;

// Maximum time a job can run before being considered stuck (configurable, default 90min)
const MAX_JOB_RUNTIME_MS = CONFIG.maxJobRuntimeMs;

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Track currently processing jobs with metadata
interface ActiveJob {
  startedAt: number;
  heartbeatInterval: NodeJS.Timeout;
  abortController: AbortController;
}
const activeJobs = new Map<string, ActiveJob>();

// Track completed jobs with LRU-like behavior (max 1000 entries)
const MAX_COMPLETED_CACHE_SIZE = 1000;
const completedJobsCache = new Map<string, number>(); // jobId -> timestamp

/**
 * Add job to completed cache with LRU eviction
 */
function addToCompletedCache(jobId: string): void {
  // If at capacity, remove oldest entry
  if (completedJobsCache.size >= MAX_COMPLETED_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, time] of completedJobsCache) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      completedJobsCache.delete(oldestKey);
    }
  }
  completedJobsCache.set(jobId, Date.now());
}

/**
 * Check if job is in completed cache
 */
function isInCompletedCache(jobId: string): boolean {
  return completedJobsCache.has(jobId);
}

// Legacy Set for backwards compatibility during transition
const processingJobs = new Set<string>();

/**
 * Update heartbeat for a job (shows it's still being processed)
 */
async function updateJobHeartbeat(jobId: string): Promise<void> {
  try {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { updatedAt: new Date() },
    });
  } catch (error) {
    // Non-critical - just log warning
    logger.warn(`⚠️ Failed to update heartbeat for job ${jobId}`);
  }
}

/**
 * Start heartbeat for a job
 */
function startJobHeartbeat(jobId: string): NodeJS.Timeout {
  return setInterval(() => {
    updateJobHeartbeat(jobId);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Recover stuck jobs at worker startup
 * Jobs that were being processed by this worker but didn't complete
 */
async function recoverStuckJobs(): Promise<void> {
  try {
    logger.info(`🔍 Checking for stuck jobs from previous worker instance...`);

    // Find jobs that are stuck in "processing" state for this worker
    // or any jobs that haven't been updated in MAX_JOB_RUNTIME_MS
    const stuckThreshold = new Date(Date.now() - MAX_JOB_RUNTIME_MS);

    const stuckJobs = await prisma.processingJob.findMany({
      where: {
        status: "processing",
        updatedAt: {
          lt: stuckThreshold,
        },
      },
    });

    if (stuckJobs.length === 0) {
      logger.info(`✅ No stuck jobs found`);
      return;
    }

    logger.info(
      `⚠️ Found ${stuckJobs.length} stuck job(s), resetting to queued...`,
    );

    for (const job of stuckJobs) {
      try {
        // Reset job to queued in local DB
        await prisma.processingJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            workerId: null,
            updatedAt: new Date(),
          },
        });

        // Also reset in external API
        const url = `${CONFIG.externalApiBaseUrl}/api/external/jobs/${job.id}`;
        await fetch(url, {
          method: "PATCH",
          headers: {
            "X-Backend-Secret": CONFIG.externalSecret!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "queued" }),
        }).catch(() => {
          // Non-critical
        });

        logger.info(`   ↩️ Reset job ${job.id} to queued`);
      } catch (error) {
        logger.error(
          `   ❌ Failed to reset job ${job.id}:`,
          normalizeError(error),
        );
      }
    }

    logger.info(`✅ Recovery complete`);
  } catch (error) {
    logger.error(`❌ Error during job recovery:`, normalizeError(error));
  }
}

/**
 * Check if job already has a successful execution in database
 */
async function isJobAlreadyProcessed(jobId: string): Promise<boolean> {
  try {
    const execution = await prisma.executionInstance.findFirst({
      where: {
        jobId: jobId,
        status: "completed",
        failedNodes: 0,
      },
      select: { id: true },
    });
    return !!execution;
  } catch (error) {
    logger.error(
      `⚠️ Error checking job status in database:`,
      normalizeError(error),
    );
    return false;
  }
}

/**
 * Check if restart is pending and perform it if no active jobs remain
 */
async function checkAndPerformRestartIfNeeded(): Promise<void> {
  try {
    // Check if restart flag is set
    const restartFlag = await prisma.systemFlag.findUnique({
      where: { key: "workers:restart_pending" },
    });

    if (!restartFlag || restartFlag.value !== "true") {
      return; // No restart pending
    }

    // Count active jobs (queued or processing)
    const activeJobs = await prisma.processingJob.count({
      where: {
        status: { in: ["queued", "processing"] },
      },
    });

    if (activeJobs > 0) {
      logger.info(
        `⏳ [${new Date().toISOString()}] Restart pending, but ${activeJobs} active job(s) remaining...`,
      );
      return; // Still have active jobs, wait
    }

    // No active jobs - perform restart!
    logger.info("");
    logger.info(`🔄 [${new Date().toISOString()}] Restart conditions met:`);
    logger.info("   - Settings changed (restart flag set)");
    logger.info("   - No active jobs remaining");
    logger.info("   - Initiating worker restart...");
    logger.info("");

    // Clear the restart flag
    await prisma.systemFlag.delete({
      where: { key: "workers:restart_pending" },
    });

    // Disconnect Prisma
    await prisma.$disconnect();

    // Restart via PM2
    logger.info(`🔄 Restarting PM2 process...`);
    process.exit(0); // PM2 will auto-restart
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Error checking restart status:`,
      normalizeError(error),
    );
  }
}

/**
 * Process a single job with error handling and heartbeat
 */
async function processJob(job: ExternalJob): Promise<void> {
  const jobId = job.jobId || job.id;

  if (!jobId) {
    logger.error(
      `⚠️ [${new Date().toISOString()}] Job missing ID, skipping...`,
    );
    return;
  }

  // Don't start new jobs if shutting down
  if (isShuttingDown) {
    logger.info(
      `⏸️ [${new Date().toISOString()}] Shutdown in progress, skipping job ${jobId}`,
    );
    return;
  }

  // Skip if already completed in LRU cache (CRITICAL: prevents reprocessing same job multiple times)
  if (isInCompletedCache(jobId)) {
    return;
  }

  // Skip if already completed in database (survives worker restarts)
  if (await isJobAlreadyProcessed(jobId)) {
    logger.info(
      `⏭️  [${new Date().toISOString()}] Job ${jobId} already processed (found in database), skipping...`,
    );
    addToCompletedCache(jobId); // Add to LRU cache
    return;
  }

  // Skip if already processing (check both old Set and new Map)
  if (processingJobs.has(jobId) || activeJobs.has(jobId)) {
    return;
  }

  // Start tracking this job
  processingJobs.add(jobId);
  const heartbeatInterval = startJobHeartbeat(jobId);
  const abortController = new AbortController();
  activeJobs.set(jobId, {
    startedAt: Date.now(),
    heartbeatInterval,
    abortController,
  });
  stats.lastJobTime = new Date();

  try {
    logger.info("");
    logger.info(`📥 [${new Date().toISOString()}] Claiming job ${jobId}`);
    logger.info(`   Session ID: ${job.sessionId}`);
    logger.info(`   Mode: ${job.mode}`);
    logger.info(
      `   Responses: ${Object.keys(job.responses || {}).length} questions`,
    );

    // Atomic claim: try to mark as processing (prevents race conditions)
    const claimed = await claimJob(jobId, job);
    if (!claimed) {
      logger.info(
        `⏭️  [${new Date().toISOString()}] Job ${jobId} already claimed by another worker, skipping...`,
      );
      return;
    }

    logger.info(
      `✅ [${new Date().toISOString()}] Successfully claimed job ${jobId} with worker ${WORKER_ID}`,
    );

    // Execute pipeline with abort signal
    const activeJob = activeJobs.get(jobId);
    const success = await executePipeline(
      job,
      activeJob?.abortController.signal,
    );

    // Mark job as completed or failed
    await markJobComplete(
      jobId,
      success,
      success ? undefined : "Pipeline execution failed",
    );

    if (success) {
      stats.jobsProcessed++;
      // Mark as permanently completed to prevent reprocessing (LRU cache)
      addToCompletedCache(jobId);
      logger.info(
        `✅ [${new Date().toISOString()}] Job ${jobId} completed successfully`,
      );
    } else {
      stats.jobsFailed++;
      logger.error(`❌ [${new Date().toISOString()}] Job ${jobId} failed`);
    }
  } catch (error) {
    stats.jobsFailed++;
    logger.error(
      `❌ [${new Date().toISOString()}] Error processing job ${jobId}:`,
      normalizeError(error),
    );

    // Try to mark as failed
    try {
      await markJobComplete(
        jobId,
        false,
        error instanceof Error ? error.message : "Unknown error",
      );
    } catch (markError) {
      logger.error(
        `❌ Failed to mark job as failed:`,
        normalizeError(markError),
      );
    }
  } finally {
    // Stop heartbeat and clean up tracking
    const activeJob = activeJobs.get(jobId);
    if (activeJob) {
      clearInterval(activeJob.heartbeatInterval);
      activeJobs.delete(jobId);
    }
    processingJobs.delete(jobId);

    // Check if we should restart after completing this job
    await checkAndPerformRestartIfNeeded();
  }
}

/**
 * Main polling loop with parallel job processing
 */
async function pollForJobs() {
  stats.pollingCount++;
  stats.lastPollTime = new Date();

  try {
    // Fetch jobs from external API (frontend) and local database (batch jobs)
    const [externalJobs, batchJobs] = await Promise.all([
      fetchJobs(),
      fetchBatchJobs(),
    ]);

    // Combine jobs (batch jobs are already filtered by mode in fetchBatchJobs)
    const jobs = [...externalJobs, ...batchJobs];

    if (jobs.length === 0) {
      // No jobs - silent polling (no log spam)
      return;
    }

    // Filter external jobs by mode if configured (batch jobs already filtered)
    const filteredJobs = CONFIG.modeFilter
      ? jobs.filter((job: ExternalJob) => {
          // Batch jobs are already filtered, external jobs need filtering
          const isBatch = (job as ExternalJob & { userData?: { isBatch?: boolean } }).userData?.isBatch;
          return isBatch || job.mode === CONFIG.modeFilter;
        })
      : jobs;

    if (filteredJobs.length === 0) {
      logger.info(
        `🔍 [${new Date().toISOString()}] Found ${jobs.length} jobs, but none match filter: ${CONFIG.modeFilter}`,
      );
      return;
    }

    stats.jobsFound += filteredJobs.length;

    // Process up to MAX_CONCURRENT_JOBS in parallel
    const jobsToProcess = filteredJobs
      .filter((job) => {
        const jobId = job.jobId || job.id;
        return jobId && !processingJobs.has(jobId);
      })
      .slice(0, MAX_CONCURRENT_JOBS);

    if (jobsToProcess.length === 0) {
      // All jobs are already being processed
      return;
    }

    logger.info(
      `📦 [${new Date().toISOString()}] Processing ${jobsToProcess.length} job(s) in parallel (max: ${MAX_CONCURRENT_JOBS})`,
    );

    // Process jobs in parallel WITHOUT blocking polling loop
    // Launch all jobs concurrently but don't wait for completion
    for (const job of jobsToProcess) {
      // Fire and forget - don't await
      processJob(job).catch((error) => {
        logger.error(
          `❌ Error processing job ${job.jobId || job.id}:`,
          normalizeError(error),
        );
      });
    }

    // Print stats
    logger.info("");
    logger.info(
      `📊 Stats: Polls ${stats.pollingCount}, Found ${stats.jobsFound}, Processed ${stats.jobsProcessed}, Failed ${stats.jobsFailed}, Active ${processingJobs.size}`,
    );
    logger.info("");
  } catch (error) {
    logger.error(
      `❌ [${new Date().toISOString()}] Polling error:`,
      normalizeError(error),
    );
  }
}

/**
 * Start worker
 */
async function startWorker() {
  logger.info(`⏰ Starting polling loop (every ${CONFIG.pollInterval}ms)...`);
  logger.info("");

  // Recover any stuck jobs from previous worker instance
  await recoverStuckJobs();
  logger.info("");

  // Initial poll
  await pollForJobs();

  // Set interval for continuous polling (save reference for graceful shutdown)
  pollingIntervalId = setInterval(async () => {
    if (!isShuttingDown) {
      await pollForJobs();
    }
  }, CONFIG.pollInterval);

  // Set interval for periodic recovery of stuck jobs (every hour)
  recoveryIntervalId = setInterval(async () => {
    if (!isShuttingDown) {
      logger.info(`🔄 Running periodic stuck job recovery...`);
      await recoverStuckJobs();
    }
  }, RECOVERY_INTERVAL_MS);
}

// Graceful shutdown timeout = MAX_JOB_RUNTIME_MS + 5 min buffer
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = MAX_JOB_RUNTIME_MS + 5 * 60 * 1000;

// Flag to prevent new jobs from starting during shutdown
let isShuttingDown = false;

// Polling interval reference for cleanup
let pollingIntervalId: NodeJS.Timeout | null = null;

// Periodic recovery interval (configurable, default 1 hour)
const RECOVERY_INTERVAL_MS = CONFIG.recoveryIntervalMs;
let recoveryIntervalId: NodeJS.Timeout | null = null;

/**
 * Graceful shutdown handler
 * Waits for active jobs to complete (with timeout) before exiting
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.info(`⚠️ Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info("");
  logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

  // Stop polling for new jobs
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    logger.info(`   ✓ Stopped polling for new jobs`);
  }

  // Stop periodic recovery
  if (recoveryIntervalId) {
    clearInterval(recoveryIntervalId);
    recoveryIntervalId = null;
    logger.info(`   ✓ Stopped periodic recovery`);
  }

  // Check if there are active jobs
  if (activeJobs.size > 0) {
    logger.info(
      `   ⏳ Waiting for ${activeJobs.size} active job(s) to complete (max ${GRACEFUL_SHUTDOWN_TIMEOUT_MS / 1000}s)...`,
    );

    const startWait = Date.now();

    // Wait for active jobs to complete with timeout
    await Promise.race([
      // Wait for all active jobs to complete
      new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (activeJobs.size === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      }),
      // Timeout after GRACEFUL_SHUTDOWN_TIMEOUT_MS
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (activeJobs.size > 0) {
            logger.info(
              `   ⚠️ Timeout reached, ${activeJobs.size} job(s) still active`,
            );

            // Abort and reset stuck jobs to queued so they can be picked up again
            for (const [jobId, job] of activeJobs) {
              // Abort the running pipeline
              logger.info(`   🛑 Aborting job ${jobId}`);
              job.abortController.abort();

              clearInterval(job.heartbeatInterval);
              logger.info(
                `   ↩️ Resetting job ${jobId} to queued for reprocessing`,
              );

              // Fire and forget - don't wait for DB update
              prisma.processingJob
                .update({
                  where: { id: jobId },
                  data: {
                    status: "queued",
                    workerId: null,
                    updatedAt: new Date(),
                  },
                })
                .catch(() => {});
            }
          }
          resolve();
        }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
      }),
    ]);

    const waitTime = Math.round((Date.now() - startWait) / 1000);
    logger.info(`   ✓ Wait completed after ${waitTime}s`);
  } else {
    logger.info(`   ✓ No active jobs to wait for`);
  }

  // Print final stats
  logger.info(
    `📊 Final Stats: Polls ${stats.pollingCount}, Found ${stats.jobsFound}, Processed ${stats.jobsProcessed}, Failed ${stats.jobsFailed}`,
  );

  // Disconnect from database
  await prisma.$disconnect();
  logger.info(`   ✓ Database disconnected`);
  logger.info(`👋 Goodbye!`);
  logger.info("");

  process.exit(0);
}

// Handle graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions - log and exit gracefully
process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught exception:", normalizeError(error));
  gracefulShutdown("uncaughtException").finally(() => process.exit(1));
});

// Handle unhandled promise rejections - log and exit gracefully
process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled rejection:", normalizeError(reason));
  gracefulShutdown("unhandledRejection").finally(() => process.exit(1));
});

// Start the worker
startWorker().catch((error) => {
  logger.error("❌ Fatal error starting worker:", normalizeError(error));
  process.exit(1);
});
