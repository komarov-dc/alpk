import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { randomUUID } from 'crypto';

// POST /api/sessions/[id]/responses - Submit response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { questionId, questionText, answer, timeSpent } = body;
    
    // Get session
    const session = await prisma.session.findUnique({
      where: { id },
      include: { responses: true },
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    if (session.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Session is not in progress' },
        { status: 400 }
      );
    }
    
    // Create response
    const response = await prisma.response.create({
      data: {
        sessionId: id,
        questionId,
        questionText,
        answer,
        timeSpent,
      },
    });
    
    // Update session progress
    const newIndex = session.currentIndex + 1;
    const isComplete = newIndex >= session.totalQuestions;
    
    await prisma.session.update({
      where: { id },
      data: {
        currentIndex: newIndex,
        status: isComplete ? SessionStatus.COMPLETED : SessionStatus.IN_PROGRESS,
        completedAt: isComplete ? new Date() : undefined,
      },
    });
    
    // If session is completed, create job for polling
    let alpakaJobId = null;
    if (isComplete) {
      try {
        // Generate unique jobId
        alpakaJobId = randomUUID();
        
        // Update session with Job ID and mark as queued
        // Backend-система will poll GET /api/external/jobs?status=queued to pick it up
        await prisma.session.update({
          where: { id },
          data: {
            alpakaJobId: alpakaJobId,
            alpakaJobStatus: 'queued',
          },
        });
        
        logger.info(`Session ${id} completed, job ${alpakaJobId} queued for processing`);
      } catch (error) {
        logger.error(`Error creating job for session ${id}:`, normalizeError(error));
      }
    }
    
    return NextResponse.json({
      response,
      sessionComplete: isComplete,
      currentIndex: newIndex,
      alpakaJobId, // Return jobId if submission was successful
    });
  } catch (error) {
    logger.error('Error creating response:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to create response' },
      { status: 500 }
    );
  }
}