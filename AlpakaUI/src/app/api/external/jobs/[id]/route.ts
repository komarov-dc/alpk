import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// CORS headers for external API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Backend-Secret, Authorization',
  'Access-Control-Max-Age': '86400',
};

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

interface BackendWebhookPayload {
  jobId: string;
  sessionId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  reports?: {
    'Adapted Report'?: string;
    'Professional Report'?: string;
    'Aggregate Score Profile'?: string;
  };
  error?: string;
  completedAt?: string;
}

// PATCH endpoint to receive updates from Backend-система for specific job
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate environment variables at runtime
    const BACKEND_SECRET = process.env.BACKEND_SECRET;

    if (!BACKEND_SECRET) {
      logger.error('BACKEND_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: corsHeaders }
      );
    }

    const { id: jobId } = await params;

    // Verify secret
    const secret = request.headers.get('x-backend-secret');

    if (secret !== BACKEND_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const payload: BackendWebhookPayload = await request.json();

    logger.info('Received webhook for job', {
      jobId,
      status: payload.status,
      hasReports: !!payload.reports,
      reportKeys: payload.reports ? Object.keys(payload.reports).join(', ') : 'none',
      payloadKeys: Object.keys(payload).join(', '),
    });

    // Find session by jobId
    const session = await prisma.session.findFirst({
      where: {
        alpakaJobId: jobId,
      },
      include: {
        reports: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Update session status
    await prisma.session.update({
      where: { id: session.id },
      data: {
        alpakaJobStatus: payload.status,
      },
    });

    // If completed with reports, save them
    if (payload.status === 'completed' && payload.reports) {
      logger.info('Processing reports', {
        sessionId: session.id,
        reportKeys: Object.keys(payload.reports).join(', '),
        hasAdapted: !!payload.reports['Adapted Report'],
        hasProfessional: !!payload.reports['Professional Report'],
        hasAggregate: !!payload.reports['Aggregate Score Profile'],
      });

      // Delete old reports if any
      await prisma.report.deleteMany({
        where: { sessionId: session.id },
      });

      const reportPromises = [];

      // Adapted Report -> ADAPTED
      if (payload.reports['Adapted Report']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId: session.id,
              userId: session.userId,
              type: 'ADAPTED',
              content: payload.reports['Adapted Report'],
              visibility: 'PRIVATE',
            },
          })
        );
      }

      // Professional Report -> FULL
      if (payload.reports['Professional Report']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId: session.id,
              userId: session.userId,
              type: 'FULL',
              content: payload.reports['Professional Report'],
              visibility: 'RESTRICTED',
            },
          })
        );
      }

      // Aggregate Score Profile -> SCORE_TABLE
      if (payload.reports['Aggregate Score Profile']) {
        reportPromises.push(
          prisma.report.create({
            data: {
              sessionId: session.id,
              userId: session.userId,
              type: 'SCORE_TABLE',
              content: payload.reports['Aggregate Score Profile'],
              visibility: 'RESTRICTED',
            },
          })
        );
      }

      await Promise.all(reportPromises);

      logger.info('Reports saved for session', { sessionId: session.id, reportCount: reportPromises.length });
    } else if (payload.status === 'completed') {
      logger.warn('Job completed but no reports provided', {
        sessionId: session.id,
        jobId,
        hasReports: !!payload.reports,
      });
    }

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        status: payload.status,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('Failed to process webhook', normalizeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
