import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// GET /api/chats - Get all chats
export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    logger.error('Error fetching chats:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

// POST /api/chats - Create new chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title = 'New Chat', projectId } = body;
    
    const chat = await prisma.chat.create({
      data: {
        title,
        projectId,
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    logger.error('Error creating chat:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}