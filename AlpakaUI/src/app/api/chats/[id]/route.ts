import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// GET /api/chats/[id] - Get chat with messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chat);
  } catch (error) {
    logger.error('Error fetching chat:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

// PATCH /api/chats/[id] - Update chat
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { title } = body;
    
    const chat = await prisma.chat.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json(chat);
  } catch (error) {
    logger.error('Error updating chat:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[id] - Delete chat
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.chat.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting chat:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}