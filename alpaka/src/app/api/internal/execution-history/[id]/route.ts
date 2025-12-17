/**
 * Internal API: Execution Instance Detail
 * Get detailed information about a specific execution instance
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
 * GET /api/internal/execution-history/[id]
 * Get detailed information about a specific execution instance
 *
 * Query parameters:
 * - includeLogs: Include execution logs (default: true)
 * - includeResults: Include full execution results (default: false, can be large)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid internal secret' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const includeLogs = searchParams.get('includeLogs') !== 'false';
    const includeResults = searchParams.get('includeResults') === 'true';

    // Fetch execution instance
    const instance = await prisma.executionInstance.findUnique({
      where: { id },
      include: {
        logs: includeLogs ? {
          orderBy: {
            createdAt: 'asc'
          }
        } : false
      }
    });

    if (!instance) {
      return NextResponse.json(
        { error: 'Execution instance not found' },
        { status: 404 }
      );
    }

    // Build response
    const response: Record<string, unknown> = {
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
      currentNodeId: instance.currentNodeId,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      duration: instance.duration,
      error: instance.error,
      globalVariablesSnapshot: instance.globalVariablesSnapshot
    };

    // Include full execution results if requested (can be large)
    if (includeResults) {
      response.executionResults = instance.executionResults;
    }

    // Include logs if requested
    if (includeLogs && instance.logs) {
      response.logs = instance.logs.map(log => ({
        id: log.id,
        nodeId: log.nodeId,
        input: log.input,
        output: log.output,
        status: log.status,
        error: log.error,
        duration: log.duration,
        createdAt: log.createdAt
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [Execution Detail API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
