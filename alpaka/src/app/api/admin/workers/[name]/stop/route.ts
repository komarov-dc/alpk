/**
 * Admin API: Stop Worker
 * Stop a specific PM2 worker
 */

import { NextRequest, NextResponse } from 'next/server';

// Shared secret for internal API authentication
const INTERNAL_SECRET = process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get('X-Alpaka-Internal-Secret');
  return secret === INTERNAL_SECRET;
}

/**
 * POST /api/admin/workers/[name]/stop
 * Stop a worker process
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid internal secret' },
        { status: 401 }
      );
    }

    const { name } = await params;

    // Validate worker name (allow Психодиагностика, Профориентация, or worker-* names)
    const validWorkerNames = ['Психодиагностика', 'Профориентация'];
    if (!name || (!validWorkerNames.includes(name) && !name.includes('worker-'))) {
      return NextResponse.json(
        { error: 'Invalid worker name' },
        { status: 400 }
      );
    }

    console.log(`🛑 [Workers API] Stopping worker: ${name}`);

    // Stop worker through PM2 (dynamic import to avoid bundling issues)
    const pm2 = (await import('pm2')).default;

    const result = await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          console.error('❌ [Workers API] PM2 connect error:', err);
          return reject(err);
        }

        pm2.stop(name, (err) => {
          pm2.disconnect();

          if (err) {
            console.error(`❌ [Workers API] Failed to stop ${name}:`, err);
            return resolve({
              success: false,
              message: err.message
            });
          }

          console.log(`✅ [Workers API] Worker ${name} stopped successfully`);
          resolve({
            success: true,
            message: `Worker ${name} stopped successfully`
          });
        });
      });
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [Workers API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
