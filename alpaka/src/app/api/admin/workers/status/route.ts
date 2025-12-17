/**
 * Admin API: Workers Status
 * Get status of all PM2 workers
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

// Shared secret for internal API authentication
const INTERNAL_SECRET =
  process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Internal-Secret");
  return secureCompare(secret, INTERNAL_SECRET);
}

interface WorkerStatus {
  name: string;
  status: string;
  uptime: number;
  instances: number;
  memory: number;
  cpu: number;
  restarts: number;
  pid: number[];
  projectName: string;
  lastExecutionAt?: string | null;
}

/**
 * GET /api/admin/workers/status
 * Get status of all workers through PM2
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 },
      );
    }

    // Connect to PM2 (dynamic import to avoid bundling issues)
    const pm2 = (await import("pm2")).default;

    const workers = await new Promise<WorkerStatus[]>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          console.error("❌ [Workers Status API] PM2 connect error:", err);
          return reject(err);
        }

        pm2.list((err, list) => {
          pm2.disconnect();

          if (err) {
            console.error("❌ [Workers Status API] PM2 list error:", err);
            return reject(err);
          }

          // Filter only worker processes (by known names)
          const workerNames = [
            "Психодиагностика",
            "Профориентация",
            "worker-bigfive",
            "worker-prof",
          ];
          const workerProcesses = list.filter(
            (p) => p.name && workerNames.includes(p.name),
          );

          // Group by worker name
          const groupedWorkers = new Map<string, typeof workerProcesses>();
          workerProcesses.forEach((p) => {
            const name = p.name || "unknown";
            if (!groupedWorkers.has(name)) {
              groupedWorkers.set(name, []);
            }
            groupedWorkers.get(name)?.push(p);
          });

          // Aggregate data for each worker group
          const workersData: WorkerStatus[] = Array.from(
            groupedWorkers.entries(),
          ).map(([name, processes]) => {
            // Map worker name to project name
            let projectName = name; // Use PM2 name directly since they're now named correctly
            if (name === "worker-career-guidance" || name === "worker-prof") {
              projectName = "Профориентация";
            } else if (
              name === "worker-psychodiagnostics" ||
              name === "worker-bigfive"
            ) {
              projectName = "Психодиагностика";
            }

            // Count actual running instances
            const instances = processes.length;

            // Collect all PIDs
            const pids = processes.map((p) => p.pid || 0);

            // Get status - if any instance is online, status is online
            let status = "stopped";
            if (processes.some((p) => p.pm2_env?.status === "online")) {
              status = "online";
            } else if (processes.some((p) => p.pm2_env?.status === "errored")) {
              status = "errored";
            }

            // Take maximum uptime (convert ms to seconds)
            const uptime = Math.floor(
              Math.max(
                ...processes.map((p) =>
                  p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
                ),
              ) / 1000,
            );

            // Sum memory and CPU across all instances
            const totalMemory = processes.reduce(
              (sum, p) => sum + (p.monit?.memory || 0),
              0,
            );
            const totalCpu = processes.reduce(
              (sum, p) => sum + (p.monit?.cpu || 0),
              0,
            );

            // Sum restarts
            const totalRestarts = processes.reduce(
              (sum, p) => sum + (p.pm2_env?.restart_time || 0),
              0,
            );

            return {
              name,
              status,
              uptime,
              instances,
              memory: Math.round(totalMemory / (1024 * 1024)), // Convert to MB
              cpu: totalCpu,
              restarts: totalRestarts,
              pid: pids,
              projectName,
            };
          });

          resolve(workersData);
        });
      });
    });

    // Fetch last execution time for each worker from DB
    const careerGuidanceLastExecution =
      await prisma.executionInstance.findFirst({
        where: { projectName: "Профориентация" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });

    const psychodiagnosticsLastExecution =
      await prisma.executionInstance.findFirst({
        where: { projectName: "Психодиагностика" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });

    // Add last execution times to workers
    const workersWithLastExecution = workers.map((worker) => {
      if (
        worker.name === "Профориентация" ||
        worker.name === "worker-career-guidance" ||
        worker.name === "worker-prof"
      ) {
        return {
          ...worker,
          lastExecutionAt:
            careerGuidanceLastExecution?.startedAt.toISOString() || null,
        };
      } else if (
        worker.name === "Психодиагностика" ||
        worker.name === "worker-psychodiagnostics" ||
        worker.name === "worker-bigfive"
      ) {
        return {
          ...worker,
          lastExecutionAt:
            psychodiagnosticsLastExecution?.startedAt.toISOString() || null,
        };
      }
      return worker;
    });

    return NextResponse.json(workersWithLastExecution);
  } catch (error) {
    console.error("❌ [Workers Status API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
