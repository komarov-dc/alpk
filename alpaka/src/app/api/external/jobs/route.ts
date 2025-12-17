import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Shared secret for authentication
const SHARED_SECRET = process.env.ALPAKA_SHARED_SECRET;

if (!SHARED_SECRET) {
  throw new Error("ALPAKA_SHARED_SECRET not set in environment variables!");
}

// Maximum payload size (10 MB)
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

// Maximum sessionId length
const MAX_SESSION_ID_LENGTH = 100;

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifyAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Secret");
  if (!secret || !SHARED_SECRET) {
    return false;
  }
  return secureCompare(secret, SHARED_SECRET);
}

/**
 * Validate and sanitize sessionId
 */
function validateSessionId(sessionId: unknown): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (typeof sessionId !== "string") {
    return { valid: false, error: "sessionId must be a string" };
  }

  if (sessionId.length === 0) {
    return { valid: false, error: "sessionId cannot be empty" };
  }

  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    return {
      valid: false,
      error: `sessionId too long (max ${MAX_SESSION_ID_LENGTH} chars)`,
    };
  }

  // Allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return { valid: false, error: "sessionId contains invalid characters" };
  }

  return { valid: true, value: sessionId };
}

/**
 * Validate responses object
 */
function validateResponses(responses: unknown): {
  valid: boolean;
  value?: object;
  error?: string;
} {
  if (responses === null || responses === undefined) {
    return { valid: false, error: "responses is required" };
  }

  if (typeof responses !== "object" || Array.isArray(responses)) {
    return { valid: false, error: "responses must be an object" };
  }

  return { valid: true, value: responses };
}

/**
 * POST /api/external/jobs
 * Create new processing job from AlpakaUI
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check payload size
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        {
          error: `Payload too large (max ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB)`,
        },
        { status: 413 },
      );
    }

    const body = await req.json();
    const { sessionId, mode, responses } = body;

    // Validate sessionId
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.valid) {
      return NextResponse.json(
        { error: sessionValidation.error },
        { status: 400 },
      );
    }

    // Validate mode
    if (mode !== "PSYCHODIAGNOSTICS" && mode !== "CAREER_GUIDANCE") {
      return NextResponse.json(
        { error: "Invalid mode. Must be PSYCHODIAGNOSTICS or CAREER_GUIDANCE" },
        { status: 400 },
      );
    }

    // Validate responses
    const responsesValidation = validateResponses(responses);
    if (!responsesValidation.valid) {
      return NextResponse.json(
        { error: responsesValidation.error },
        { status: 400 },
      );
    }

    // Create processing job
    const job = await prisma.processingJob.create({
      data: {
        sessionId: sessionValidation.value!,
        mode,
        responses: responsesValidation.value!,
        status: "queued",
      },
    });

    console.log(
      `✅ New job created: ${job.id} for session ${sessionValidation.value} (mode: ${mode})`,
    );

    return NextResponse.json({
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status,
      createdAt: job.createdAt,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/external/jobs?status=queued
 * Get jobs by status (for Trigger Node polling)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || "queued";
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get jobs with specified status
    const jobs = await prisma.processingJob.findMany({
      where: {
        status: status,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
    });

    return NextResponse.json({
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
