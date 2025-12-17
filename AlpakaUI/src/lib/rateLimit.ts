import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT } from '@/config/constants';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key] && store[key].resetTime < now) {
      delete store[key];
    }
  }
}, RATE_LIMIT.CLEANUP_INTERVAL);

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (request: NextRequest) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || String(RATE_LIMIT.DEFAULT_WINDOW), 10),
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || String(RATE_LIMIT.DEFAULT_MAX_REQUESTS), 10),
    message = 'Too many requests, please try again later.',
    keyGenerator = (request: NextRequest) => {
      // Use IP address as key
      return request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
    }
  } = options;

  return async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const key = keyGenerator(request);
    const now = Date.now();
    
    // Initialize or get existing rate limit data
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    store[key].count++;
    
    // Check if limit exceeded
    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      
      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': store[key].resetTime.toString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to response
    const remaining = max - store[key].count;
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', max.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', store[key].resetTime.toString());
    
    return null; // Continue to next middleware
  };
}

// Specific rate limiters for different endpoints
export const apiRateLimit = rateLimit({
  windowMs: RATE_LIMIT.DEFAULT_WINDOW,
  max: RATE_LIMIT.DEFAULT_MAX_REQUESTS,
});

export const authRateLimit = rateLimit({
  windowMs: RATE_LIMIT.AUTH_WINDOW,
  max: RATE_LIMIT.AUTH_MAX_REQUESTS,
  message: 'Too many authentication attempts, please try again later.',
});

export const strictRateLimit = rateLimit({
  windowMs: RATE_LIMIT.DEFAULT_WINDOW,
  max: RATE_LIMIT.STRICT_MAX_REQUESTS,
  message: 'Rate limit exceeded for this endpoint.',
});