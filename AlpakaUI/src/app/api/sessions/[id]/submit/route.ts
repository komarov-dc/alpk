import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user info from headers (set by middleware)
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const sessionId = resolvedParams.id;

    // Get session with responses
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        responses: {
          orderBy: { questionId: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session is completed
    if (session.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Session must be completed before generating reports' },
        { status: 400 }
      );
    }

    // Check if reports already generated
    if (session.alpakaJobId && session.alpakaJobStatus === 'completed') {
      return NextResponse.json(
        { error: 'Reports already generated for this session' },
        { status: 400 }
      );
    }

    // Check if job is already queued or processing
    if (session.alpakaJobId && (session.alpakaJobStatus === 'queued' || session.alpakaJobStatus === 'processing')) {
      logger.info('Job already queued/processing, returning existing status', {
        jobId: session.alpakaJobId,
        status: session.alpakaJobStatus
      });

      return NextResponse.json({
        success: true,
        jobId: session.alpakaJobId,
        status: session.alpakaJobStatus,
        message: `Job is already ${session.alpakaJobStatus}. Please wait for completion.`,
      });
    }

    // Generate unique jobId
    const jobId = randomUUID();

    // Update session with Job ID and mark as queued
    // Backend-система will poll GET /api/external/jobs?status=queued to pick it up
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        alpakaJobId: jobId,
        alpakaJobStatus: 'queued',
      },
    });

    logger.info('Job created and queued', { jobId, sessionId });

    return NextResponse.json({
      success: true,
      jobId: jobId,
      status: 'queued',
      message: 'Job queued. Backend-система will pick it up via polling.',
    });
  } catch (error) {
    logger.error('Failed to submit session to Backend', normalizeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
