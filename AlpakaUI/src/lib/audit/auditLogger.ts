import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';

/**
 * Parameters for creating an audit log entry
 */
export interface AuditLogParams {
  /** The action being audited */
  action: string;
  /** ID of the user performing the action */
  userId: string;
  /** ID of the target entity (optional) */
  entityId?: string;
  /** Type of the target entity (e.g., 'USER', 'SESSION', 'REPORT') */
  entityType?: string;
  /** Additional details about the action (stored as JSON string) */
  metadata?: Record<string, unknown>;
  /** IP address of the request */
  ipAddress?: string | null;
}

/**
 * Creates an audit log entry in the database
 *
 * @param params - Audit log parameters
 * @throws {Error} If the audit log creation fails
 *
 * @example
 * ```typescript
 * await createAuditLog({
 *   action: 'USER_CREATED',
 *   userId: currentUserId,
 *   entityId: newUser.id,
 *   entityType: 'USER',
 *   metadata: { email: newUser.email, role: newUser.role },
 *   ipAddress: request.headers.get('x-forwarded-for'),
 * });
 * ```
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        entityId: params.entityId,
        entityType: params.entityType,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
      },
    });

    logger.info('Audit log created', {
      action: params.action,
      userId: params.userId,
      entityId: params.entityId,
      entityType: params.entityType,
    });
  } catch (error) {
    // Log the error but don't throw - audit logging should not break the main flow
    logger.error(
      `Failed to create audit log: action=${params.action}, userId=${params.userId}, entityId=${params.entityId}`,
      normalizeError(error)
    );
  }
}

/**
 * Creates multiple audit log entries in a single transaction
 *
 * @param entries - Array of audit log parameters
 * @throws {Error} If any audit log creation fails
 */
export async function createAuditLogs(entries: AuditLogParams[]): Promise<void> {
  try {
    await prisma.auditLog.createMany({
      data: entries.map((params) => ({
        action: params.action,
        userId: params.userId,
        entityId: params.entityId,
        entityType: params.entityType,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
      })),
    });

    logger.info('Bulk audit logs created', { count: entries.length });
  } catch (error) {
    logger.error('Failed to create bulk audit logs', normalizeError(error));
  }
}
