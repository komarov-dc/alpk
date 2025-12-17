import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// POST /api/chats/[id]/messages - Add message to chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { role, content, metadata } = body;
    
    // Create message
    const message = await prisma.message.create({
      data: {
        chatId: id,
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    
    // Update chat's updatedAt
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (error) {
    logger.error('Error creating message:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}