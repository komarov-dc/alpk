/**
 * Internal API: Execution History
 * Get list of execution instances with logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Shared secret for internal API authentication
const INTERNAL_SECRET = process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get('X-Alpaka-Internal-Secret');
  return secret === INTERNAL_SECRET;
}

/**
 * GET /api/internal/execution-history
 * Get list of execution instances
 *
 * Query parameters:
 * - projectId: Filter by project ID (optional)
 * - status: Filter by status (optional)
 * - limit: Number of results to return (default: 50, max: 100)
 * - offset: Offset for pagination (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid internal secret' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }
    if (status) {
      where.status = status;
    }

    // Fetch execution instances
    const instances = await prisma.executionInstance.findMany({
      where,
      orderBy: {
        startedAt: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            logs: true
          }
        }
      }
    });

    // Get total count
    const total = await prisma.executionInstance.count({ where });

    return NextResponse.json({
      instances: instances.map(instance => ({
        id: instance.id,
        projectId: instance.projectId,
        projectName: instance.projectName,
        jobId: instance.jobId,
        sessionId: instance.sessionId,
        status: instance.status,
        totalNodes: instance.totalNodes,
        executedNodes: instance.executedNodes,
        failedNodes: instance.failedNodes,
        skippedNodes: instance.skippedNodes,
        startedAt: instance.startedAt,
        completedAt: instance.completedAt,
        duration: instance.duration,
        error: instance.error,
        logsCount: instance._count.logs
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('❌ [Execution History API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
