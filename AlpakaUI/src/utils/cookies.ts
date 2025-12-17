import { SESSION } from '@/config/constants';
import { NextResponse } from 'next/server';

interface Tokens {
  access: string;
  refresh: string;
}

/**
 * Set authentication cookies with appropriate expiry times
 * @param response NextResponse object to set cookies on
 * @param tokens Access and refresh tokens
 * @param rememberMe Whether to use extended expiry (30 days) or session expiry (7 days)
 */
export function setCookies(
  response: NextResponse,
  tokens: Tokens,
  rememberMe: boolean
): void {
  const maxAge = rememberMe
    ? SESSION.REMEMBER_ME_EXPIRY / 1000
    : SESSION.SESSION_COOKIE_EXPIRY / 1000;

  response.cookies.set('accessToken', tokens.access, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  response.cookies.set('refreshToken', tokens.refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}
