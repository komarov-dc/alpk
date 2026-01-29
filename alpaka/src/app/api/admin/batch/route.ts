/**
 * Admin API: Batch Upload
 * POST /api/admin/batch - Create a new batch of jobs from uploaded files
 * GET /api/admin/batch - List all batches
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Shared secret for internal API authentication
const INTERNAL_SECRET =
  process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Internal-Secret");
  return secureCompare(secret, INTERNAL_SECRET);
}

/**
 * Generate a unique batch ID based on timestamp
 */
function generateBatchId(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const random = Math.random().toString(36).substring(2, 6);
  return `batch_${timestamp}_${random}`;
}

/**
 * Create output directory for batch results
 */
function createOutputDir(batchId: string): string {
  const outputBase = path.join(process.cwd(), "..", "batch_output");
  const batchDir = path.join(outputBase, batchId);

  // Create directories if they don't exist
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }

  return batchDir;
}

/**
 * POST /api/admin/batch
 * Create a new batch of jobs from uploaded files
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { projectId, projectName, files } = body;

    // Validate input
    if (!projectId || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, files" },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Determine mode based on project name
    // This allows the correct worker to pick up the job
    let jobMode = "PSYCHODIAGNOSTICS"; // default
    const projectNameLower = project.name.toLowerCase();
    if (projectNameLower.includes("проф") || projectNameLower.includes("career") || projectNameLower.includes("prof")) {
      jobMode = "CAREER_GUIDANCE";
    }

    // Generate batch ID and create output directory
    const batchId = generateBatchId();
    const outputDir = createOutputDir(batchId);

    // Create batch record
    const batch = await prisma.batchUpload.create({
      data: {
        id: batchId,
        name: batchId,
        projectId: projectId,
        projectName: projectName || project.name,
        status: "processing",
        totalJobs: files.length,
        completedJobs: 0,
        failedJobs: 0,
        outputDir: outputDir,
      },
    });

    // Create jobs for each file
    const jobPromises = files.map(async (file: { name: string; content: string }, index: number) => {
      const fileName = file.name.replace(/\.(docx|md|txt)$/i, '');
      const sessionId = `${batchId}_${fileName}_${index}`;

      // Create subdirectory for this file's outputs
      const fileOutputDir = path.join(outputDir, fileName);
      if (!fs.existsSync(fileOutputDir)) {
        fs.mkdirSync(fileOutputDir, { recursive: true });
      }

      // Create job record
      return prisma.processingJob.create({
        data: {
          sessionId: sessionId,
          mode: jobMode, // Use actual mode so workers can pick it up
          status: "queued",
          responses: {
            // Store the file content as the main input (will be passed as questionnaire_responses)
            raw_text: file.content,
            file_name: file.name,
            batch_id: batchId,
            output_dir: fileOutputDir,
            project_id: projectId, // Worker uses this to execute the right pipeline
          },
          batchId: batchId,
          fileName: file.name,
        },
      });
    });

    const jobs = await Promise.all(jobPromises);

    console.log(`[Batch API] Created batch ${batchId} with ${jobs.length} jobs`);

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        totalJobs: batch.totalJobs,
        outputDir: batch.outputDir,
      },
      jobsCreated: jobs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Batch API] Error creating batch:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/batch
 * List all batches with their status
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 }
      );
    }

    // Fetch all batches, most recent first
    const batches = await prisma.batchUpload.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Update batch statuses based on job completion
    const updatedBatches = await Promise.all(
      batches.map(async (batch) => {
        // Count job statuses for this batch
        const jobStats = await prisma.processingJob.groupBy({
          by: ["status"],
          where: { batchId: batch.id },
          _count: { status: true },
        });

        const statusCounts = jobStats.reduce(
          (acc, stat) => {
            acc[stat.status] = stat._count.status;
            return acc;
          },
          {} as Record<string, number>
        );

        const completedJobs = statusCounts["completed"] || 0;
        const failedJobs = statusCounts["failed"] || 0;
        const queuedJobs = statusCounts["queued"] || 0;
        const processingJobs = statusCounts["processing"] || 0;

        // Determine batch status
        let status = batch.status;
        if (queuedJobs === 0 && processingJobs === 0) {
          if (failedJobs > 0 && completedJobs > 0) {
            status = "partial";
          } else if (failedJobs === batch.totalJobs) {
            status = "failed";
          } else if (completedJobs === batch.totalJobs) {
            status = "completed";
          }
        } else if (processingJobs > 0 || (queuedJobs > 0 && completedJobs > 0)) {
          status = "processing";
        }

        // Update batch in database if status changed
        if (
          status !== batch.status ||
          completedJobs !== batch.completedJobs ||
          failedJobs !== batch.failedJobs
        ) {
          await prisma.batchUpload.update({
            where: { id: batch.id },
            data: {
              status,
              completedJobs,
              failedJobs,
              completedAt:
                status === "completed" || status === "partial" || status === "failed"
                  ? new Date()
                  : null,
            },
          });
        }

        // Fetch per-job details with execution progress
        const batchJobs = await prisma.processingJob.findMany({
          where: { batchId: batch.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sessionId: true,
            fileName: true,
            status: true,
            workerId: true,
            createdAt: true,
            updatedAt: true,
            error: true,
          },
        });

        // Fetch execution instances for these jobs
        const jobIds = batchJobs.map((j) => j.id);
        const executions = await prisma.executionInstance.findMany({
          where: { jobId: { in: jobIds } },
          select: {
            jobId: true,
            totalNodes: true,
            executedNodes: true,
            failedNodes: true,
            currentNodeId: true,
            startedAt: true,
            status: true,
          },
          orderBy: { startedAt: "desc" },
        });

        const executionMap = new Map(executions.map((e) => [e.jobId, e]));

        const enrichedJobs = batchJobs.map((job) => {
          const execution = executionMap.get(job.id);
          return {
            ...job,
            progress: execution
              ? {
                  totalNodes: execution.totalNodes,
                  executedNodes: execution.executedNodes,
                  failedNodes: execution.failedNodes,
                  percentage:
                    execution.totalNodes > 0
                      ? Math.round(
                          (execution.executedNodes / execution.totalNodes) * 100,
                        )
                      : 0,
                }
              : null,
          };
        });

        return {
          ...batch,
          status,
          completedJobs,
          failedJobs,
          jobs: enrichedJobs,
        };
      })
    );

    return NextResponse.json({
      batches: updatedBatches,
      count: updatedBatches.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Batch API] Error listing batches:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
