import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/auth/jwt-edge';
import { apiRateLimit, authRateLimit } from '@/lib/rateLimit';

// Routes that require authentication
const protectedRoutes = ['/', '/admin'];
const protectedApiRoutes = ['/api/admin', '/api/users', '/api/logs', '/api/reports', '/api/sessions', '/api/clients'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Apply rate limiting to auth endpoints (stricter)
  if (path.startsWith('/api/auth/')) {
    const rateLimitResponse = await authRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Apply rate limiting to all API routes (general)
  if (path.startsWith('/api/')) {
    const rateLimitResponse = await apiRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(route =>
    path === route || path.startsWith(route + '/')
  );

  // Check if this is a protected API route
  const isProtectedApiRoute = protectedApiRoutes.some(route =>
    path.startsWith(route)
  );

  if (!isProtectedRoute && !isProtectedApiRoute) {
    return NextResponse.next();
  }
  
  // Check for access token in cookies or Authorization header for API routes
  let accessToken = request.cookies.get('accessToken')?.value;
  
  // For API routes, also check Authorization header
  if (!accessToken && isProtectedApiRoute) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }
  
  if (!accessToken) {
    if (isProtectedApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    // Clear any remaining cookies
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');
    return response;
  }
  
  try {
    // Verify token
    const payload = await verifyAccessTokenEdge(accessToken);
    
    // Check if this is a session-only token (no "remember me")
    // Session tokens should be more strictly validated
    const isSessionToken = payload.isSessionToken === true;
    
    if (isSessionToken) {
      // For session tokens, apply additional security measures:
      // 1. Check token age - session tokens should be shorter-lived in practice
      // 2. Could add IP validation
      // 3. Could add User-Agent validation
      
      // Additional validation can be added here
      // For example, if we want to limit session token lifetime:
      if (payload.iat) {
        const tokenAge = Date.now() - (payload.iat * 1000);
        const maxSessionAge = 4 * 60 * 60 * 1000; // 4 hours for session tokens
        
        if (tokenAge > maxSessionAge) {
          const response = NextResponse.redirect(new URL('/auth/login?reason=session_expired', request.url));
          response.cookies.delete('accessToken');
          response.cookies.delete('refreshToken');
          return response;
        }
      }
      
      // Note: The main session validation (checking if browser was restarted)
      // happens on the client side in sessionManager.ts
    }
    
    // Check admin access
    if (path.startsWith('/admin') && payload.role !== 'ADMIN' && payload.role !== 'CONSULTANT') {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }
    
    // Add user info to headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-session-type', isSessionToken ? 'session' : 'persistent');
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Invalid token - redirect to login
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    // Clear invalid cookies
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match routes that need protection:
     * - / (home page)
     * - /admin (admin pages)
     * - Protected API routes
     */
    '/',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/users/:path*',
    '/api/logs/:path*',
    '/api/reports/:path*',
    '/api/sessions/:path*',
    '/api/clients/:path*',
  ],
};
