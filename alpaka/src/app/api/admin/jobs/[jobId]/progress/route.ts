/**
 * Admin API: Progress Logs Streaming (Simplified Polling Version)
 * GET /api/admin/logs/[jobId]/progress?offset=0
 * Returns new log lines starting from offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { readProgressLog } from '@/utils/logFileHelper';

// Shared secret for internal API authentication
const INTERNAL_SECRET = process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get('X-Alpaka-Internal-Secret');
  return secret === INTERNAL_SECRET;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid internal secret' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Read log file with offset
    const { lines, total } = await readProgressLog(jobId, offset);

    return NextResponse.json({
      jobId,
      lines,
      offset,
      total,
      hasMore: total > offset + lines.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Progress Logs API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
