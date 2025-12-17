import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  isSessionToken?: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
}

export function generateAccessToken(user: Pick<User, 'id' | 'email' | 'role'>, isSessionToken = false): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    isSessionToken,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
  });
}

export function generateRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = {
    userId,
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new Error('Invalid refresh token');
  }
}

export function generateTokenPair(user: Pick<User, 'id' | 'email' | 'role'>, rememberMe = true) {
  return {
    accessToken: generateAccessToken(user, !rememberMe), // isSessionToken = !rememberMe
    refreshToken: generateRefreshToken(user.id),
  };
}
