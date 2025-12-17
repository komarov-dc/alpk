import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateTokenPair } from '@/lib/auth/jwt';
import { UserStatus, UserRole } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

const RegisterSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа'),
  firstName: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  middleName: z.string().optional(),
  phone: z.string().min(10, 'Телефон обязателен'),
  birthDate: z.string().min(1, 'Дата рождения обязательна'),
  status: z.enum(['STUDENT', 'EMPLOYEE', 'OTHER']).default('OTHER'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = RegisterSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        lastName: validatedData.lastName,
        firstName: validatedData.firstName,
        middleName: validatedData.middleName,
        phone: validatedData.phone,
        birthDate: new Date(validatedData.birthDate),
        status: validatedData.status as UserStatus,
        role: UserRole.USER, // Default role for new users
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
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

    // Return user data with tokens
    return NextResponse.json({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Registration error:', normalizeError(error));
    return NextResponse.json(
      { error: 'Ошибка при регистрации' },
      { status: 500 }
    );
  }
}