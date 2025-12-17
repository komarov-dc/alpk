import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { UserRole } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as UserRole;

    if (!userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view full statistics
    if (!hasPermission(userRole, 'statistics.viewFull')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get mode filter from query params
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as 'ALL' | 'PSYCHODIAGNOSTICS' | 'CAREER_GUIDANCE' | null;

    // Build where clause based on mode filter
    const sessionWhere = mode && mode !== 'ALL' ? { mode } : {};
    const reportWhere = mode && mode !== 'ALL'
      ? { session: { mode } }
      : {};

    // Build user where clause for active users
    const activeUserWhere = mode && mode !== 'ALL'
      ? {
          sessions: {
            some: {
              mode,
              startedAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        }
      : {
          sessions: {
            some: {
              startedAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        };

    // Fetch statistics
    const [
      totalUsers,
      totalSessions,
      completedSessions,
      totalReports,
      psychodiagnosticsSessions,
      careerGuidanceSessions,
      activeUsersCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.session.count({ where: sessionWhere }),
      prisma.session.count({
        where: { ...sessionWhere, status: 'COMPLETED' },
      }),
      prisma.report.count({ where: reportWhere }),
      prisma.session.count({
        where: { mode: 'PSYCHODIAGNOSTICS' },
      }),
      prisma.session.count({
        where: { mode: 'CAREER_GUIDANCE' },
      }),
      prisma.user.count({ where: activeUserWhere }),
    ]);

    // Get detailed metrics
    const recentSessions = await prisma.session.findMany({
      where: {
        ...sessionWhere,
        startedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    const avgResponsesPerSession = recentSessions.length > 0
      ? recentSessions.reduce((sum, s) => sum + s._count.responses, 0) / recentSessions.length
      : 0;

    return NextResponse.json({
      totalUsers,
      totalSessions,
      completedSessions,
      totalReports,
      activeUsers: activeUsersCount,
      sessionsByMode: {
        psychodiagnostics: psychodiagnosticsSessions,
        careerGuidance: careerGuidanceSessions,
      },
      metrics: {
        completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
        avgResponsesPerSession: Math.round(avgResponsesPerSession),
        recentSessionsCount: recentSessions.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching statistics:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
