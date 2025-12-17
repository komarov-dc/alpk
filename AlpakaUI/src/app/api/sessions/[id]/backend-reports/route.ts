import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

interface BackendJob {
  id: string;
  sessionId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  reports: {
    'Professional Report': string;
    'Aggregate Score Profile': string;
    'Adapted Report': string;
  } | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate environment variables at runtime
    const BACKEND_PROCESSING_URL = process.env.BACKEND_PROCESSING_URL;
    const BACKEND_SECRET = process.env.BACKEND_SECRET;

    if (!BACKEND_PROCESSING_URL || !BACKEND_SECRET) {
      logger.error(
        'Missing required environment variables',
        new Error(`Missing: ${!BACKEND_PROCESSING_URL ? 'BACKEND_PROCESSING_URL ' : ''}${!BACKEND_SECRET ? 'BACKEND_SECRET' : ''}`)
      );
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get user info from headers (set by middleware)
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const sessionId = resolvedParams.id;

    // Get session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        reports: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session has Backend Job ID
    if (!session.alpakaJobId) {
      return NextResponse.json(
        { error: 'No Backend job found for this session' },
        { status: 404 }
      );
    }

    // If reports already saved, return them
    if (session.reports.length > 0 && session.alpakaJobStatus === 'completed') {
      return NextResponse.json({
        status: 'completed',
        reports: session.reports.map((r) => ({
          id: r.id,
          type: r.type,
          content: r.content,
          createdAt: r.createdAt,
        })),
      });
    }

    // Poll Backend-система for job status
    const backendResponse = await fetch(
      `${BACKEND_PROCESSING_URL}/api/external/jobs/${session.alpakaJobId}`,
      {
        headers: {
          'X-Backend-Secret': BACKEND_SECRET,
        },
      }
    );

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch job status from Backend-система' },
        { status: backendResponse.status }
      );
    }

    const backendJob: BackendJob = await backendResponse.json();

    // Update session status
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        alpakaJobStatus: backendJob.status,
      },
    });

    // If still processing, return status
    if (backendJob.status === 'queued' || backendJob.status === 'processing') {
      return NextResponse.json({
        status: backendJob.status,
        message: 'Reports are being generated...',
      });
    }

    // If failed, return error
    if (backendJob.status === 'failed') {
      return NextResponse.json(
        {
          status: 'failed',
          error: backendJob.error || 'Report generation failed',
        },
        { status: 500 }
      );
    }

    // If completed, save reports to database
    if (backendJob.status === 'completed' && backendJob.reports) {
      // Delete old reports if any
      await prisma.report.deleteMany({
        where: { sessionId },
      });

      // Create new reports with correct mapping
      const reportPromises = [];

      // Adapted Report -> ADAPTED
      if (backendJob.reports['Adapted Report']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId,
              userId: session.userId,
              type: 'ADAPTED',
              content: backendJob.reports['Adapted Report'],
              visibility: 'PRIVATE',
            },
          })
        );
      }

      // Professional Report -> FULL
      if (backendJob.reports['Professional Report']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId,
              userId: session.userId,
              type: 'FULL',
              content: backendJob.reports['Professional Report'],
              visibility: 'RESTRICTED',
            },
          })
        );
      }

      // Aggregate Score Profile -> SCORE_TABLE
      if (backendJob.reports['Aggregate Score Profile']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId,
              userId: session.userId,
              type: 'SCORE_TABLE',
              content: backendJob.reports['Aggregate Score Profile'],
              visibility: 'RESTRICTED',
            },
          })
        );
      }

      const savedReports = await Promise.all(reportPromises);

      return NextResponse.json({
        status: 'completed',
        reports: savedReports.map((r) => ({
          id: r.id,
          type: r.type,
          content: r.content,
          createdAt: r.createdAt,
        })),
      });
    }

    return NextResponse.json({
      status: backendJob.status,
    });
  } catch (error) {
    logger.error('Failed to fetch Backend reports', normalizeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
