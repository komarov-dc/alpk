import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionMode, SessionStatus, Prisma, UserRole } from "@prisma/client";
import {
  psychodiagnosticsQuestions,
  careerGuidanceQuestions,
} from "@/data/questions";
import { buildSessionFilter } from "@/lib/auth/dataFilters";

// GET /api/sessions - Get all sessions
export async function GET(request: NextRequest) {
  try {
    // Get user info from headers (set by middleware)
    const userRole = request.headers.get("x-user-role") as UserRole;
    const userId = request.headers.get("x-user-id");

    if (!userRole || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const mode = searchParams.get("mode");
    const status = searchParams.get("status");

    // Build role-based filter
    const roleFilter = buildSessionFilter(userRole, userId);

    const where: Prisma.SessionWhereInput = { ...roleFilter };
    if (id) {
      where.id = id;
    }
    if (mode && Object.values(SessionMode).includes(mode as SessionMode)) {
      where.mode = mode as SessionMode;
    }
    if (
      status &&
      Object.values(SessionStatus).includes(status as SessionStatus)
    ) {
      where.status = status as SessionStatus;
    }

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { startedAt: "desc" },
      include: {
        responses: {
          orderBy: { answeredAt: "asc" },
        },
        user: {
          select: {
            id: true,
            email: true,
            lastName: true,
            firstName: true,
            middleName: true,
            role: true,
          },
        },
        reports: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Add question text to responses AND questions array to session
    const sessionsWithQuestionText = sessions.map((session) => {
      const questionTexts =
        session.mode === "PSYCHODIAGNOSTICS"
          ? psychodiagnosticsQuestions
          : careerGuidanceQuestions;

      // Build questions array (same format as POST /api/sessions)
      const questions = questionTexts
        .slice(0, session.totalQuestions)
        .map((text, index) => ({
          id: index,
          text,
          orderIndex: index,
          mode: session.mode,
          active: true,
          createdAt: new Date(),
        }));

      return {
        ...session,
        questions, // Add questions array
        responses: session.responses.map((response) => {
          // questionId is 0-based index in our questions array
          const questionText =
            questionTexts[response.questionId] || response.questionText || "";
          return {
            ...response,
            questionText,
          };
        }),
      };
    });

    return NextResponse.json(sessionsWithQuestionText);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST /api/sessions - Create new diagnostic session
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mode, totalQuestions = 5, respondentName } = body;

    if (!mode || !Object.values(SessionMode).includes(mode)) {
      return NextResponse.json(
        { error: "Invalid session mode" },
        { status: 400 },
      );
    }

    // Get questions from the predefined arrays
    const questionTexts =
      mode === "PSYCHODIAGNOSTICS"
        ? psychodiagnosticsQuestions
        : careerGuidanceQuestions;

    // Take only the required number of questions
    const selectedQuestions = questionTexts
      .slice(0, totalQuestions)
      .map((text, index) => ({
        id: index,
        text,
        orderIndex: index,
        mode,
        active: true,
        createdAt: new Date(),
      }));

    // Create session with respondentName
    const session = await prisma.session.create({
      data: {
        userId,
        mode,
        totalQuestions,
        currentIndex: 0,
        respondentName: respondentName || null,
      },
    });

    return NextResponse.json({
      session,
      questions: selectedQuestions,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create session",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
