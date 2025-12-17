import { Resend } from 'resend';

// Проверка наличия API ключа
if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

// Инициализация Resend клиента
export const resend = new Resend(process.env.RESEND_API_KEY);

// Типы для отправки email
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  path?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Утилита для отправки email через Resend
 * @param options - параметры отправки email
 * @returns Promise с результатом отправки
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { to, subject, react, html, text, from, replyTo, attachments } = options;

    // Используем onboarding@resend.dev для тестирования или настроенный домен
    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const data = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      react,
      html,
      text,
      replyTo,
      attachments: attachments as never, // Type assertion for Resend SDK compatibility
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
