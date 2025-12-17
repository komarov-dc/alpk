import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// CORS headers for external API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Backend-Secret, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
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

// GET endpoint for Backend-система to poll for queued jobs
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Verify secret
    const secret = request.headers.get('x-backend-secret');

    logger.info('External API auth check', {
      hasSecret: !!secret,
      secretValid: secret === BACKEND_SECRET,
    });

    if (secret !== BACKEND_SECRET) {
      logger.warn('Unauthorized external API access attempt');
      return NextResponse.json({
        error: 'Unauthorized',
        hint: 'Check X-Backend-Secret header'
      }, { status: 401, headers: corsHeaders });
    }

    // Get sessions waiting for reports
    const where: Prisma.SessionWhereInput = {
      status: 'COMPLETED',
      alpakaJobId: { not: null },
    };

    if (status === 'queued') {
      where.alpakaJobStatus = { in: ['queued'] };
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        responses: {
          orderBy: { questionId: 'asc' },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true,
            birthDate: true,
            phone: true,
          },
        },
      },
      take: 10, // Limit to 10 jobs at a time
      orderBy: { startedAt: 'asc' }, // Process older jobs first
    });

    // Format jobs for Backend-система
    const jobs = sessions.map(session => {
      const responses: Record<string, string> = {};
      session.responses.forEach((response) => {
        responses[`question_${response.questionId}`] = response.answer;
      });

      return {
        jobId: session.alpakaJobId,
        sessionId: session.id,
        mode: session.mode,
        responses,
        userData: {
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          middleName: session.user.middleName,
          birthDate: session.user.birthDate,
          email: session.user.email,
          phone: session.user.phone,
        },
        createdAt: session.startedAt,
      };
    });

    logger.info('Queued jobs retrieved', { jobCount: jobs.length, status });

    return NextResponse.json({ jobs }, { headers: corsHeaders });
  } catch (error) {
    logger.error('Failed to fetch queued jobs', normalizeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH endpoint to receive updates from Backend-система (Output Sender)
export async function PATCH(request: NextRequest) {
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

    // Verify secret
    const secret = request.headers.get('x-backend-secret');

    logger.info('External API auth check (PATCH)', {
      hasSecret: !!secret,
      secretValid: secret === BACKEND_SECRET,
    });

    if (secret !== BACKEND_SECRET) {
      logger.warn('Unauthorized PATCH attempt from external API');
      return NextResponse.json({
        error: 'Unauthorized',
        hint: 'Check X-Backend-Secret header'
      }, { status: 401, headers: corsHeaders });
    }

    const payload: BackendWebhookPayload = await request.json();

    logger.info('Received webhook from Backend-система', {
      jobId: payload.jobId,
      sessionId: payload.sessionId,
      status: payload.status,
    });

    // Find session by jobId or sessionId
    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { alpakaJobId: payload.jobId },
          { id: payload.sessionId },
        ],
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
        alpakaJobId: payload.jobId,
        alpakaJobStatus: payload.status,
      },
    });

    // If completed with reports, save them
    if (payload.status === 'completed' && payload.reports) {
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

      logger.info('Reports saved successfully', {
        sessionId: session.id,
        reportCount: reportPromises.length,
      });
    }

    // If failed, log error
    if (payload.status === 'failed') {
      logger.error(`Job processing failed: ${payload.jobId}`, new Error(payload.error || 'Unknown error'));
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      status: payload.status,
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('Failed to process Backend webhook', normalizeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
