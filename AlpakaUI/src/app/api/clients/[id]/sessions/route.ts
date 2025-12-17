import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UserRole, SessionMode } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

const CreateSessionSchema = z.object({
  mode: z.enum(['PSYCHODIAGNOSTICS', 'CAREER_GUIDANCE']),
  totalQuestions: z.number().min(1).max(20).default(5),
});

// POST /api/clients/[id]/sessions - Create session for client
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await context.params;
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');

    // Only consultants can create sessions for clients
    if (userRole !== UserRole.CONSULTANT) {
      return NextResponse.json({ error: 'Forbidden - Only consultants can create sessions for clients' }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the client belongs to this consultant
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { 
        id: true,
        consultantId: true,
        lastName: true,
        firstName: true,
        middleName: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.consultantId !== userId) {
      return NextResponse.json({ error: 'Forbidden - This client does not belong to you' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = CreateSessionSchema.parse(body);

    // Create session for the client
    const session = await prisma.session.create({
      data: {
        userId: clientId,
        mode: validatedData.mode as SessionMode,
        totalQuestions: validatedData.totalQuestions,
        currentIndex: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            lastName: true,
            firstName: true,
            middleName: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SESSION_CREATED_FOR_CLIENT',
        entityType: 'Session',
        entityId: session.id,
        metadata: JSON.stringify({
          clientId,
          mode: validatedData.mode,
          consultantId: userId,
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating session for client:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
