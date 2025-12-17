import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

// Predefined follow-up questions based on session analysis
const followUpQuestions = {
  PSYCHODIAGNOSTICS: [
    'Вы упомянули о стрессе. Расскажите подробнее, какие именно ситуации вызывают у вас наибольшее напряжение?',
    'Хотелось бы уточнить: как давно вы замечаете изменения в вашем эмоциональном состоянии?',
    'Какие методы вы уже пробовали для решения описанных вами сложностей?'
  ],
  CAREER_GUIDANCE: [
    'Какие конкретные навыки вы бы хотели развить в ближайший год для достижения карьерных целей?',
    'Есть ли у вас опыт работы или проектов в интересующей вас области?',
    'Что для вас важнее: стабильность или возможность профессионального роста?'
  ]
};

// GET /api/sessions/[id]/follow-up - Get follow-up questions for a session
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { answeredAt: 'asc' }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only provide follow-up questions for completed sessions
    if (session.status !== 'COMPLETED') {
      return NextResponse.json({ 
        hasFollowUpQuestions: false,
        message: 'Complete the main questionnaire first' 
      });
    }

    // Check if we should ask follow-up questions
    // Logic: If session is complete and we haven't asked follow-ups yet
    const shouldAskFollowUp = session.status === 'COMPLETED' && 
                              !session.hasFollowUpQuestions &&
                              session.responses.length >= session.totalQuestions;

    if (shouldAskFollowUp) {
      // Mark that follow-up questions are available
      await prisma.session.update({
        where: { id },
        data: { hasFollowUpQuestions: true }
      });

      // Get relevant follow-up questions based on mode
      const questions = followUpQuestions[session.mode] || [];
      
      // For now, return 1-2 random follow-up questions
      const selectedQuestions = questions
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(2, questions.length));

      return NextResponse.json({
        hasFollowUpQuestions: true,
        questions: selectedQuestions.map((text, index) => ({
          id: `follow-up-${index}`,
          text,
          type: 'FOLLOW_UP'
        })),
        message: 'У меня есть несколько уточняющих вопросов для более точного анализа.'
      });
    }

    // No follow-up questions needed or already asked
    return NextResponse.json({
      hasFollowUpQuestions: false,
      followUpQuestionsAsked: session.followUpQuestionsAsked,
      message: session.followUpQuestionsAsked > 0 
        ? 'Дополнительные вопросы уже были заданы' 
        : 'Дополнительные вопросы не требуются'
    });

  } catch (error) {
    logger.error('Error getting follow-up questions:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to get follow-up questions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/follow-up - Submit answer to follow-up question
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const { questionText, answer } = body;

    if (!questionText || !answer) {
      return NextResponse.json(
        { error: 'Question text and answer are required' },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Create a follow-up response
    const response = await prisma.response.create({
      data: {
        sessionId: id,
        questionId: 999 + session.followUpQuestionsAsked, // Use high IDs for follow-ups
        questionText,
        answer,
        timeSpent: 0,
        tokenCount: answer.split(' ').length,
        charCount: answer.length
      }
    });

    // Update follow-up questions counter
    await prisma.session.update({
      where: { id },
      data: {
        followUpQuestionsAsked: { increment: 1 }
      }
    });

    return NextResponse.json({
      success: true,
      response,
      message: 'Спасибо за уточнение! Это поможет сделать анализ более точным.'
    });

  } catch (error) {
    logger.error('Error submitting follow-up answer:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to submit follow-up answer' },
      { status: 500 }
    );
  }
}
