import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'http://localhost:4000',
  'https://psypro.mgimo.local',
];

export function corsHeaders(origin?: string | null) {
  const headers = new Headers();
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400');
  
  return headers;
}

export function handleCors(request: NextRequest): NextResponse | null {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin);
    
    return new NextResponse(null, {
      status: 200,
      headers,
    });
  }
  
  return null;
}