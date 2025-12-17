import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { UserRole } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

const UpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'CONSULTANT', 'SUPPORT', 'USER']),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Get user info from headers (set by middleware)
    const userRole = request.headers.get('x-user-role') as UserRole;
    const userId = request.headers.get('x-user-id');
    
    if (!userRole || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!hasPermission(userRole, 'users.changeRole')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = UpdateRoleSchema.parse(body);

    // Prevent changing own role
    if (params.id === userId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { role: validatedData.role as UserRole },
      select: {
        id: true,
        email: true,
        lastName: true,
        firstName: true,
        middleName: true,
        role: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: params.id,
        metadata: JSON.stringify({
          newRole: validatedData.role,
          changedBy: userId,
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      message: 'Role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating user role:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}