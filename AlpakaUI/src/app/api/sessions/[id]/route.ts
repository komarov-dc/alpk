import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { UserRole } from '@prisma/client';
import { canAccessSession } from '@/lib/auth/dataFilters';

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Get user info from headers
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');
    
    if (!userRole || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access rights
    const hasAccess = await canAccessSession(userRole, userId, id, prisma);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // First delete all responses associated with the session
    await prisma.response.deleteMany({
      where: { sessionId: id }
    });
    
    // Then delete the session itself
    const deletedSession = await prisma.session.delete({
      where: { id }
    });
    
    return NextResponse.json({
      message: 'Session deleted successfully',
      deletedSession
    });
  } catch (error) {
    logger.error('Error deleting session:', normalizeError(error));
    
    // Check if session not found
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

// GET /api/sessions/[id] - Get a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Get user info from headers
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');
    
    if (!userRole || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access rights
    const hasAccess = await canAccessSession(userRole, userId, id, prisma);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: {
            answeredAt: 'asc'
          }
        }
      }
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    logger.error('Error fetching session:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}