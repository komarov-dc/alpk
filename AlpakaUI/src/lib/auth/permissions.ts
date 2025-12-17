import { UserRole } from '@prisma/client';

// Define permissions for each role
export const rolePermissions: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.changeRole',
    'sessions.viewAll',
    'sessions.delete',
    'reports.viewAll',
    'reports.create',
    'reports.edit',
    'reports.delete',
    'statistics.viewFull',
    'settings.manage',
    'audit.view',
  ],
  [UserRole.CONSULTANT]: [
    'users.viewAssigned',
    'sessions.viewAssigned',
    'sessions.comment',
    'reports.viewAll',
    'reports.create',
    'reports.edit',
    'statistics.viewLimited',
  ],
  [UserRole.SUPPORT]: [
    'users.view',
    'users.help',
    'sessions.viewMetadata',
    'statistics.viewTechnical',
    'audit.viewTechnical',
  ],
  [UserRole.USER]: [
    'sessions.viewOwn',
    'sessions.create',
    'reports.viewOwn',
    'profile.edit',
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) || false;
}

export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const routePermissions: Record<string, string[]> = {
    '/admin': ['settings.manage'],
    '/admin/users': ['users.view'],
    '/admin/statistics': ['statistics.viewFull'],
    '/admin/audit': ['audit.view'],
    '/sessions': ['sessions.viewOwn', 'sessions.viewAssigned', 'sessions.viewAll'],
    '/reports': ['reports.viewOwn', 'reports.viewAll'],
    '/profile': ['profile.edit'],
  };

  const requiredPermissions = routePermissions[route];
  if (!requiredPermissions) return true; // No restrictions
  
  return hasAnyPermission(role, requiredPermissions);
}