/**
 * Admin API: Jobs List
 * GET /api/admin/jobs?status=processing
 * Returns list of jobs filtered by status with execution progress
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

// Shared secret for internal API authentication
const INTERNAL_SECRET =
  process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(
  a: string | null | undefined,
  b: string | null | undefined,
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

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // 'processing', 'queued', 'completed', 'failed'

    // Build where clause
    const where = status ? { status } : {};

    // Fetch jobs from database
    const jobs = await prisma.processingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 jobs
      select: {
        id: true,
        sessionId: true,
        mode: true,
        status: true,
        workerId: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        error: true,
      },
    });

    // Fetch execution progress for processing jobs
    // Look for any execution instance (running, completed, or failed)
    const jobIds = jobs.map((j) => j.id);
    const executions = await prisma.executionInstance.findMany({
      where: {
        jobId: { in: jobIds },
      },
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

    // Create a map of jobId -> execution progress
    const executionMap = new Map(executions.map((e) => [e.jobId, e]));

    // Enrich jobs with execution progress
    const enrichedJobs = jobs.map((job) => {
      const execution = executionMap.get(job.id);
      return {
        ...job,
        progress: execution
          ? {
              totalNodes: execution.totalNodes,
              executedNodes: execution.executedNodes,
              failedNodes: execution.failedNodes,
              currentNodeId: execution.currentNodeId,
              startedAt: execution.startedAt,
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

    return NextResponse.json({
      jobs: enrichedJobs,
      count: enrichedJobs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [Jobs API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
