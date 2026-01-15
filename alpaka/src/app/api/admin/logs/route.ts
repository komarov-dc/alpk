/**
 * Admin API: Execution Logs
 * List execution instances with pagination and filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Shared secret for internal API authentication
const INTERNAL_SECRET = process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get('X-Alpaka-Internal-Secret');
  return secret === INTERNAL_SECRET;
}

/**
 * GET /api/admin/logs?page=1&limit=20&status=completed&projectName=MGIMO%20-%20Prof
 * List execution instances with pagination and filters
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

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status');
    const projectName = searchParams.get('projectName');

    // Build where clause
    const where: Prisma.ExecutionInstanceWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (projectName) {
      where.projectName = projectName;
    }

    // Fetch executions with pagination
    const [executions, total] = await Promise.all([
      prisma.executionInstance.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          projectName: true,
          jobId: true,
          sessionId: true,
          status: true,
          totalNodes: true,
          executedNodes: true,
          failedNodes: true,
          skippedNodes: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          error: true,
        },
      }),
      prisma.executionInstance.count({ where }),
    ]);

    return NextResponse.json({
      executions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ [Logs API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
