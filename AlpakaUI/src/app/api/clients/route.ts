import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { UserRole, UserStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import { buildUserFilter } from '@/lib/auth/dataFilters';

const CreateClientSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа'),
  firstName: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  middleName: z.string().optional(),
  phone: z.string().min(10, 'Телефон обязателен'),
  birthDate: z.string().min(1, 'Дата рождения обязательна'),
  status: z.enum(['STUDENT', 'EMPLOYEE', 'OTHER']).default('OTHER'),
});

// GET /api/clients - Get clients for consultant
export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');
    
    if (!userRole || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only consultants and admins can access this endpoint
    if (userRole !== UserRole.CONSULTANT && userRole !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build filter based on role
    const roleFilter = buildUserFilter(userRole, userId);

    // Get clients (users with consultantId set)
    const clients = await prisma.user.findMany({
      where: {
        ...roleFilter,
        role: UserRole.USER,
        consultantId: userRole === UserRole.CONSULTANT ? userId : undefined,
      },
      select: {
        id: true,
        email: true,
        lastName: true,
        firstName: true,
        middleName: true,
        phone: true,
        birthDate: true,
        status: true,
        consultantId: true,
        createdAt: true,
        _count: {
          select: {
            sessions: true,
            reports: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    logger.error('Error fetching clients:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client (only for consultants)
export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');

    // Only consultants can create clients
    if (userRole !== UserRole.CONSULTANT) {
      return NextResponse.json({ error: 'Forbidden - Only consultants can create clients' }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateClientSchema.parse(body);

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

    // Create client (user with consultantId set to current consultant)
    const client = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        lastName: validatedData.lastName,
        firstName: validatedData.firstName,
        middleName: validatedData.middleName,
        phone: validatedData.phone,
        birthDate: new Date(validatedData.birthDate),
        status: validatedData.status as UserStatus,
        role: UserRole.USER,
        consultantId: userId, // Link to consultant
        emailVerified: new Date(), // Auto-verify when created by consultant
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CLIENT_CREATED_BY_CONSULTANT',
        entityType: 'User',
        entityId: client.id,
        metadata: JSON.stringify({
          email: client.email,
          consultantId: userId,
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Return client data (without password)
    const { password: _, ...clientWithoutPassword } = client;
    return NextResponse.json(clientWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating client:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
