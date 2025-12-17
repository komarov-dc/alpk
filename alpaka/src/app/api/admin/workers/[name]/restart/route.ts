/**
 * Admin API: Restart Worker
 * Restart a specific PM2 worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Shared secret for internal API authentication
const INTERNAL_SECRET = process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get('X-Alpaka-Internal-Secret');
  return secret === INTERNAL_SECRET;
}

/**
 * POST /api/admin/workers/[name]/restart
 * Restart a worker process
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

    console.log(`🔄 [Workers API] Restarting worker: ${name} with new config`);

    // Restart worker using CLI to reload ecosystem.config.js configuration
    // This is the most reliable way to apply config changes
    const result = await new Promise<{ success: boolean; message: string }>(async (resolve) => {
      try {
        // Step 1: Delete the worker
        console.log(`🗑️ [Workers API] Deleting worker ${name}...`);
        await execAsync(`npx pm2 delete ${name}`);

        // Step 2: Start from ecosystem.config.js with --only flag
        console.log(`🚀 [Workers API] Starting worker ${name} from ecosystem.config.js...`);
        await execAsync(`npx pm2 start ecosystem.config.js --only ${name}`);

        console.log(`✅ [Workers API] Worker ${name} restarted with new config`);
        resolve({
          success: true,
          message: `Worker ${name} restarted successfully`
        });
      } catch (error) {
        console.error(`❌ [Workers API] Failed to restart ${name}:`, error);
        resolve({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
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
