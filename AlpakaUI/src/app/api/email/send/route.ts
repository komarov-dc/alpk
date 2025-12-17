import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import { getWelcomeEmailHtml, getWelcomeEmailText } from '@/lib/email/templates';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, userName, type } = body;

    // Проверка обязательных полей
    if (!to) {
      return NextResponse.json(
        { error: 'Email recipient is required' },
        { status: 400 }
      );
    }

    // Определяем шаблон email в зависимости от типа
    let html: string;
    let text: string;

    switch (type) {
      case 'welcome':
        html = getWelcomeEmailHtml({ userName: userName || 'пользователь' });
        text = getWelcomeEmailText({ userName: userName || 'пользователь' });
        break;
      default:
        // Если тип не указан или не поддерживается, используем приветственный шаблон
        html = getWelcomeEmailHtml({ userName: userName || 'пользователь' });
        text = getWelcomeEmailText({ userName: userName || 'пользователь' });
    }

    // Отправляем email
    const result = await sendEmail({
      to,
      subject: subject || 'Добро пожаловать в BackendUI!',
      html,
      text,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        data: result.data,
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in email API route', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

// GET endpoint для тестирования
export async function GET() {
  return NextResponse.json({
    message: 'Email API is running',
    info: 'Use POST method to send emails',
    example: {
      method: 'POST',
      body: {
        to: 'user@example.com',
        subject: 'Добро пожаловать!',
        userName: 'Иван',
        type: 'welcome'
      }
    }
  });
}
