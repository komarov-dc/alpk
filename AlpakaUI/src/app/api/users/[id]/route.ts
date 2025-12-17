import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = request.headers.get('x-user-role');
    
    // Check if user is admin
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = await context.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete related data first (cascade delete)
    await prisma.$transaction([
      // Delete responses from sessions
      prisma.response.deleteMany({
        where: {
          session: {
            userId: userId
          }
        }
      }),
      prisma.report.deleteMany({
        where: {
          session: {
            userId: userId
          }
        }
      }),
      prisma.session.deleteMany({
        where: { userId: userId }
      }),
      // Delete audit logs
      prisma.auditLog.deleteMany({
        where: { userId: userId }
      }),
      // Finally delete the user
      prisma.user.delete({
        where: { id: userId }
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting user:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

const UpdateUserSchema = z.object({
  email: z.string().email('Неверный формат email').optional(),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа').optional(),
  firstName: z.string().min(2, 'Имя должно содержать минимум 2 символа').optional(),
  middleName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  status: z.enum(['STUDENT', 'EMPLOYEE', 'OTHER']).optional(),
  role: z.enum(['ADMIN', 'CONSULTANT', 'SUPPORT', 'USER']).optional(),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов').optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = request.headers.get('x-user-role');
    
    // Check if user is admin
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: userId } = await context.params;
    const body = await request.json();
    const validatedData = UpdateUserSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If email is being changed, check if it's already taken
    if (validatedData.email && validatedData.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email уже используется' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...validatedData,
      birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
    };

    // Hash password if provided
    if (validatedData.password) {
      updateData.password = await hashPassword(validatedData.password);
    } else {
      delete updateData.password;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: userRole === 'ADMIN' ? undefined : userId,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: userId,
        metadata: JSON.stringify({
          updatedFields: Object.keys(validatedData),
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Return updated user (without password)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Неверные данные', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating user:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
