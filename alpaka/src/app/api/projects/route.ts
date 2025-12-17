import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPrismaCanvasData,
  getPrismaGlobalVariable,
} from "@/lib/types/prisma";
import {
  validateProjectData,
  ValidationError,
  checkRateLimit,
} from "@/utils/validation";
import { Prisma } from "@prisma/client";
import type { ProjectsListResponse, CreateProjectResponse } from "@/types/api";
import { logger } from "@/utils/logger";

// GET /api/projects - получить все проекты
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });

    const response: ProjectsListResponse = {
      success: true,
      projects: projects.map((project) => {
        const canvasData = getPrismaCanvasData(project.canvasData);
        return {
          id: project.id,
          name: project.name,
          description: project.description || undefined,
          isSystem: project.isSystem,
          templateId: project.templateId || undefined,
          nodeCount: canvasData?.nodes?.length || 0,
          edgeCount: canvasData?.edges?.length || 0,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        };
      }),
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

// POST /api/projects - создать новый проект
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp, "api")) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validateProjectData(body);
    const {
      name,
      description,
      nodes,
      edges,
      executionResults,
      globalVariables,
      viewport,
    } = validatedData;

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        canvasData: {
          nodes,
          edges,
          executionResults,
          viewport,
        } as Prisma.InputJsonValue,
      },
    });

    // Добавляем глобальные переменные
    if (globalVariables && Object.keys(globalVariables).length > 0) {
      const variableData = Object.entries(globalVariables).map(
        ([varName, varData]) => {
          const data = getPrismaGlobalVariable(varData);
          return {
            projectId: newProject.id,
            name: varName,
            value: data.value,
            description: data.description || "",
          };
        },
      );

      await prisma.globalVariable.createMany({
        data: variableData as Prisma.GlobalVariableCreateManyInput[],
      });
    }

    const responseCanvasData = getPrismaCanvasData(newProject.canvasData);

    const response: CreateProjectResponse = {
      success: true,
      project: {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description || undefined,
        nodes: responseCanvasData?.nodes || [],
        edges: responseCanvasData?.edges || [],
        createdAt: newProject.createdAt.toISOString(),
        updatedAt: newProject.updatedAt.toISOString(),
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.toJSON() },
        { status: 400 },
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[API] Failed to create project:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
