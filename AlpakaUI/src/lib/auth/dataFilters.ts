import { UserRole, Prisma, PrismaClient } from '@prisma/client';

/**
 * Builds a WHERE clause for filtering users based on the requester's role
 */
export function buildUserFilter(
  userRole: UserRole,
  userId: string
): Prisma.UserWhereInput {
  switch (userRole) {
    case UserRole.ADMIN:
      // Admin can see all users
      return {};
    
    case UserRole.CONSULTANT:
      // Consultant can see:
      // - themselves
      // - their clients (users where consultantId = their id)
      return {
        OR: [
          { id: userId },
          { consultantId: userId },
        ],
      };
    
    case UserRole.USER:
    case UserRole.SUPPORT:
    default:
      // Users and Support can only see themselves
      return { id: userId };
  }
}

/**
 * Builds a WHERE clause for filtering sessions based on the requester's role
 */
export function buildSessionFilter(
  userRole: UserRole,
  userId: string
): Prisma.SessionWhereInput {
  switch (userRole) {
    case UserRole.ADMIN:
      // Admin can see all sessions
      return {};
    
    case UserRole.CONSULTANT:
      // Consultant can see:
      // - their own sessions
      // - sessions of their clients
      return {
        OR: [
          { userId: userId },
          { user: { consultantId: userId } },
        ],
      };
    
    case UserRole.USER:
    case UserRole.SUPPORT:
    default:
      // Users can only see their own sessions
      return { userId: userId };
  }
}

/**
 * Builds a WHERE clause for filtering reports based on the requester's role
 */
export function buildReportFilter(
  userRole: UserRole,
  userId: string
): Prisma.ReportWhereInput {
  switch (userRole) {
    case UserRole.ADMIN:
      // Admin can see all reports
      return {};
    
    case UserRole.CONSULTANT:
      // Consultant can see:
      // - their own reports
      // - reports of their clients
      return {
        OR: [
          { userId: userId },
          { user: { consultantId: userId } },
        ],
      };
    
    case UserRole.USER:
    case UserRole.SUPPORT:
    default:
      // Users can only see their own reports
      return { userId: userId };
  }
}

/**
 * Checks if user has access to view another user's data
 */
export async function canAccessUser(
  requesterRole: UserRole,
  requesterId: string,
  targetUserId: string,
  prisma: PrismaClient
): Promise<boolean> {
  // Admin can access anyone
  if (requesterRole === UserRole.ADMIN) {
    return true;
  }

  // Users can access themselves
  if (requesterId === targetUserId) {
    return true;
  }

  // Consultants can access their clients
  if (requesterRole === UserRole.CONSULTANT) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { consultantId: true },
    });
    
    return targetUser?.consultantId === requesterId;
  }

  return false;
}

/**
 * Checks if user has access to view a session
 */
export async function canAccessSession(
  requesterRole: UserRole,
  requesterId: string,
  sessionId: string,
  prisma: PrismaClient
): Promise<boolean> {
  // Admin can access any session
  if (requesterRole === UserRole.ADMIN) {
    return true;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { 
      userId: true,
      user: {
        select: {
          consultantId: true,
        },
      },
    },
  });

  if (!session) {
    return false;
  }

  // User can access their own session
  if (session.userId === requesterId) {
    return true;
  }

  // Consultant can access their client's session
  if (requesterRole === UserRole.CONSULTANT && session.user?.consultantId === requesterId) {
    return true;
  }

  return false;
}

/**
 * Checks if user has access to view a report
 */
export async function canAccessReport(
  requesterRole: UserRole,
  requesterId: string,
  reportId: string,
  prisma: PrismaClient
): Promise<boolean> {
  // Admin can access any report
  if (requesterRole === UserRole.ADMIN) {
    return true;
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { 
      userId: true,
      user: {
        select: {
          consultantId: true,
        },
      },
    },
  });

  if (!report) {
    return false;
  }

  // User can access their own report
  if (report.userId === requesterId) {
    return true;
  }

  // Consultant can access their client's report
  if (requesterRole === UserRole.CONSULTANT && report.user?.consultantId === requesterId) {
    return true;
  }

  return false;
}
