import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

// Shared secret for authentication
const SHARED_SECRET = process.env.ALPAKA_SHARED_SECRET;

if (!SHARED_SECRET) {
  throw new Error("ALPAKA_SHARED_SECRET not set in environment variables!");
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

function verifyAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Secret");
  return secureCompare(secret, SHARED_SECRET);
}

/**
 * GET /api/external/jobs/:id
 * Get job status and results
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify authentication
    if (!verifyAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const job = await prisma.processingJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/external/jobs/:id
 * Update job status and reports (from Output Node)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify authentication
    if (!verifyAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, reports, error } = body;

    const updateData: Prisma.ProcessingJobUpdateInput = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      if (status === "completed") {
        updateData.completedAt = new Date();
      }
    }

    if (reports) {
      updateData.reports = reports;
    }

    if (error) {
      updateData.error = error;
    }

    const job = await prisma.processingJob.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Job updated: ${job.id} - Status: ${job.status}`);

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
