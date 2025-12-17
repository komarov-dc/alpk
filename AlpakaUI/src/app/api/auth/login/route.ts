import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { generateTokenPair } from '@/lib/auth/jwt';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { setCookies } from '@/utils/cookies';

const LoginSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(1, 'Пароль обязателен'),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = LoginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(validatedData.password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Generate tokens
    const rememberMe = validatedData.rememberMe ?? false;
    const { accessToken, refreshToken } = generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    }, rememberMe);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: JSON.stringify({
          email: user.email,
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Create response with tokens
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        lastName: user.lastName,
        firstName: user.firstName,
        middleName: user.middleName,
        phone: user.phone,
        birthDate: user.birthDate,
        role: user.role,
        status: user.status,
      },
      accessToken,
      refreshToken,
    });

    // Set cookies in response using utility function
    setCookies(response, { access: accessToken, refresh: refreshToken }, rememberMe);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Login error:', normalizeError(error));
    return NextResponse.json(
      { error: 'Ошибка при входе' },
      { status: 500 }
    );
  }
}