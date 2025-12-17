/**
 * Admin API: Statistics
 * Get system statistics from database
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
 * GET /api/admin/stats
 * Get overall system statistics
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Fetch statistics from database
    const [
      totalJobsToday,
      completedJobsToday,
      failedJobsToday,
      queuedJobs
    ] = await Promise.all([
      // Total jobs started today
      prisma.executionInstance.count({
        where: { startedAt: { gte: startOfToday } }
      }),

      // Completed jobs today
      prisma.executionInstance.count({
        where: {
          startedAt: { gte: startOfToday },
          status: 'completed'
        }
      }),

      // Failed jobs today
      prisma.executionInstance.count({
        where: {
          startedAt: { gte: startOfToday },
          status: 'failed'
        }
      }),

      // Queued jobs (pending execution)
      prisma.processingJob.count({
        where: { status: 'queued' }
      })
    ]);

    // Get average duration for Prof pipeline
    const profAvgResult = await prisma.executionInstance.aggregate({
      where: {
        projectName: 'MGIMO - Prof',
        startedAt: { gte: startOfToday },
        status: 'completed',
        duration: { not: null }
      },
      _avg: { duration: true }
    });

    // Get average duration for BigFive pipeline
    const bigfiveAvgResult = await prisma.executionInstance.aggregate({
      where: {
        projectName: 'MGIMO - BigFive',
        startedAt: { gte: startOfToday },
        status: 'completed',
        duration: { not: null }
      },
      _avg: { duration: true }
    });

    return NextResponse.json({
      today: {
        totalJobs: totalJobsToday,
        completedJobs: completedJobsToday,
        failedJobs: failedJobsToday,
        averageDuration: {
          prof: profAvgResult._avg.duration || 0,
          bigfive: bigfiveAvgResult._avg.duration || 0
        }
      },
      queued: queuedJobs
    });

  } catch (error) {
    console.error('❌ [Stats API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
