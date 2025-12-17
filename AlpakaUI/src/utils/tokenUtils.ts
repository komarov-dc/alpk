/**
 * Utilities for working with JWT tokens and cookies
 */

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  isSessionToken?: boolean;
  exp?: number;
  iat?: number;
}

/**
 * Get access token from cookies
 */
export function getAccessTokenFromCookies(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'accessToken') {
      return value || null;
    }
  }

  return null;
}

/**
 * Parse JWT payload without verification (client-side only)
 * Note: This does NOT verify the signature - that should be done server-side
 */
export function parseJWTPayload(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Get current user info from token in cookies
 */
export function getCurrentUserFromToken(): JWTPayload | null {
  const token = getAccessTokenFromCookies();
  if (!token) return null;

  return parseJWTPayload(token);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseJWTPayload(token);
  if (!payload || !payload.exp) return true;

  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 < Date.now();
}

/**
 * Get user role from token
 */
export function getUserRoleFromToken(): string | null {
  const payload = getCurrentUserFromToken();
  return payload?.role || null;
}

/**
 * Check if current user is admin
 */
export function isCurrentUserAdmin(): boolean {
  const role = getUserRoleFromToken();
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
