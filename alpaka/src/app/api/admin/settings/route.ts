/**
 * Admin API: Settings
 * Get and update system settings (.env, ecosystem.config.js, DB)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { timingSafeEqual } from "crypto";

// Types for ecosystem.config.js
interface PM2AppConfig {
  name: string;
  instances: number;
  env: {
    POLL_INTERVAL: string;
    EXTERNAL_API_BASE_URL: string;
    API_BASE_URL: string;
    ALPAKA_SHARED_SECRET?: string;
    ALPAKA_INTERNAL_SECRET?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

interface EcosystemConfig {
  apps: PM2AppConfig[];
}

/**
 * Parse ecosystem.config.js by reading file and extracting the exported object
 */
async function parseEcosystemConfig(
  filePath: string,
): Promise<EcosystemConfig> {
  const ecosystemContent = await fs.readFile(filePath, "utf-8");

  // Extract the exported object - find module.exports = { ... };
  const match = ecosystemContent.match(
    /module\.exports\s*=\s*(\{[\s\S]*\});?\s*$/,
  );
  if (!match) {
    throw new Error("Could not parse ecosystem.config.js");
  }

  // Parse as JSON (ecosystem.config.js exports a plain object)
  // eslint-disable-next-line no-eval
  const config = eval(`(${match[1]})`) as EcosystemConfig;
  return config;
}

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

// Shared secret for internal API authentication
const INTERNAL_SECRET =
  process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Internal-Secret");
  return secureCompare(secret, INTERNAL_SECRET);
}

/**
 * GET /api/admin/settings
 * Get current system settings from .env, ecosystem.config.js, and DB
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

    // Read .env file
    const envPath = path.join(process.cwd(), ".env");
    const envContent = await fs.readFile(envPath, "utf-8");

    // Parse .env (simple key=value parser)
    const envVars: Record<string, string> = {};
    envContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=");
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join("=").trim();
        }
      }
    });

    // Read ecosystem.config.js safely (without eval)
    const ecosystemPath = path.join(process.cwd(), "ecosystem.config.js");
    const ecosystem = await parseEcosystemConfig(ecosystemPath);

    const profWorker = ecosystem.apps.find(
      (app) => app.name === "Профориентация",
    );
    const bigfiveWorker = ecosystem.apps.find(
      (app) => app.name === "Психодиагностика",
    );

    // Get Yandex Cloud credentials from environment variables
    // Model settings are configured per-flow in Model Provider Nodes
    const settings = {
      yandex: {
        oauthToken: "***", // Don't send actual OAuth token to frontend
        folderId: process.env.YANDEX_CLOUD_FOLDER || "b1gv7s2cc3lh59k24svl",
      },
      secrets: {
        sharedSecret: "***", // Masked for security
        internalSecret: "***", // Masked for security
      },
      workers: {
        prof: {
          instances: profWorker?.instances || 3,
          pollInterval: parseInt(profWorker?.env?.POLL_INTERVAL || "10000"),
          maxConcurrentJobs: parseInt(
            profWorker?.env?.MAX_CONCURRENT_JOBS || "5",
          ),
        },
        bigfive: {
          instances: bigfiveWorker?.instances || 1,
          pollInterval: parseInt(bigfiveWorker?.env?.POLL_INTERVAL || "10000"),
          maxConcurrentJobs: parseInt(
            bigfiveWorker?.env?.MAX_CONCURRENT_JOBS || "10",
          ),
        },
      },
      urls: {
        externalApiUrl: process.env.EXTERNAL_API_BASE_URL || "",
        internalApiUrl: process.env.INTERNAL_API_BASE_URL || "",
      },
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("❌ [Settings API] GET Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update system settings across .env, ecosystem.config.js, and database
 */
export async function PUT(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 },
      );
    }

    const settings = await req.json();

    console.log(
      "📝 [Settings API] Updating settings:",
      JSON.stringify(settings, null, 2),
    );

    // 1. Update .env file
    const envPath = path.join(process.cwd(), ".env");
    let envContent = await fs.readFile(envPath, "utf-8");

    // Update Yandex OAuth token if provided and not masked
    if (settings.yandex?.oauthToken && settings.yandex.oauthToken !== "***") {
      envContent = envContent.replace(
        /YANDEX_CLOUD_OAUTH_TOKEN=.*/,
        `YANDEX_CLOUD_OAUTH_TOKEN="${settings.yandex.oauthToken}"`,
      );
    }

    // Update Yandex folder ID if provided
    if (settings.yandex?.folderId) {
      envContent = envContent.replace(
        /YANDEX_CLOUD_FOLDER=.*/,
        `YANDEX_CLOUD_FOLDER="${settings.yandex.folderId}"`,
      );
    }

    // Update secrets if provided and not masked
    if (
      settings.secrets?.sharedSecret &&
      settings.secrets.sharedSecret !== "***"
    ) {
      envContent = envContent.replace(
        /ALPAKA_SHARED_SECRET=.*/g,
        `ALPAKA_SHARED_SECRET=${settings.secrets.sharedSecret}`,
      );
    }
    if (
      settings.secrets?.internalSecret &&
      settings.secrets.internalSecret !== "***"
    ) {
      envContent = envContent.replace(
        /ALPAKA_INTERNAL_SECRET=.*/g,
        `ALPAKA_INTERNAL_SECRET=${settings.secrets.internalSecret}`,
      );
    }

    // Update API URLs if provided
    if (settings.urls?.externalApiUrl !== undefined) {
      envContent = envContent.replace(
        /EXTERNAL_API_BASE_URL=.*/,
        `EXTERNAL_API_BASE_URL=${settings.urls.externalApiUrl}`,
      );
    }
    if (settings.urls?.internalApiUrl !== undefined) {
      envContent = envContent.replace(
        /INTERNAL_API_BASE_URL=.*/,
        `INTERNAL_API_BASE_URL=${settings.urls.internalApiUrl}`,
      );
    }

    await fs.writeFile(envPath, envContent);
    console.log("✅ [Settings API] Updated .env file");

    // 2. Update ecosystem.config.js safely (without eval)
    const ecosystemPath = path.join(process.cwd(), "ecosystem.config.js");
    const ecosystem = await parseEcosystemConfig(ecosystemPath);

    // Update worker-specific PM2 settings (instances, poll interval, max concurrent jobs)
    // Note: Secrets and URLs are managed in .env, not ecosystem.config.js
    ecosystem.apps.forEach((app) => {
      if (app.name === "Профориентация" && settings.workers?.prof) {
        app.instances = settings.workers.prof.instances;
        app.env.POLL_INTERVAL = String(settings.workers.prof.pollInterval);
        app.env.MAX_CONCURRENT_JOBS = String(
          settings.workers.prof.maxConcurrentJobs,
        );
      }

      if (app.name === "Психодиагностика" && settings.workers?.bigfive) {
        app.instances = settings.workers.bigfive.instances;
        app.env.POLL_INTERVAL = String(settings.workers.bigfive.pollInterval);
        app.env.MAX_CONCURRENT_JOBS = String(
          settings.workers.bigfive.maxConcurrentJobs,
        );
      }
    });

    const updatedEcosystemContent = `module.exports = ${JSON.stringify(ecosystem, null, 2)};\n`;
    await fs.writeFile(ecosystemPath, updatedEcosystemContent);
    console.log("✅ [Settings API] Updated ecosystem.config.js");

    // 3. Check for active processing jobs and set restart flag
    const activeJobs = await prisma.processingJob.count({
      where: {
        status: { in: ["queued", "processing"] },
      },
    });

    let restartStatus: "immediate" | "pending" = "immediate";

    if (activeJobs > 0) {
      // There are active jobs - set pending restart flag
      restartStatus = "pending";

      await prisma.systemFlag.upsert({
        where: { key: "workers:restart_pending" },
        update: { value: "true", updatedAt: new Date() },
        create: { key: "workers:restart_pending", value: "true" },
      });

      console.log(
        `⏳ [Settings API] ${activeJobs} active jobs detected - restart deferred`,
      );
      console.log("   Workers will auto-restart after completing all jobs");
    } else {
      // No active jobs - clear pending restart flag if exists
      await prisma.systemFlag.deleteMany({
        where: { key: "workers:restart_pending" },
      });

      console.log(
        "✅ [Settings API] No active jobs - workers can restart immediately",
      );
    }

    return NextResponse.json({
      success: true,
      message:
        restartStatus === "immediate"
          ? "Settings saved successfully. Restart workers to apply changes."
          : `Settings saved successfully. Restart pending (${activeJobs} active job${activeJobs > 1 ? "s" : ""} in progress). Workers will auto-restart after jobs complete.`,
      restartStatus,
      stats: {
        activeJobs,
        settingsUpdated: true,
      },
    });
  } catch (error) {
    console.error("❌ [Settings API] PUT Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
