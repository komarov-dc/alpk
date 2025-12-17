import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// DELETE /api/sessions/clear - Delete all sessions
export async function DELETE() {
  try {
    // First delete all responses
    await prisma.response.deleteMany({});
    
    // Then delete all sessions
    const deletedSessions = await prisma.session.deleteMany({});
    
    return NextResponse.json({ 
      message: 'All sessions deleted successfully',
      deletedCount: deletedSessions.count
    });
  } catch (error) {
    logger.error('Error clearing sessions:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to clear sessions' },
      { status: 500 }
    );
  }
}
