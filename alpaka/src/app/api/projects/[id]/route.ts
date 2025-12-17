import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getPrismaCanvasData,
  getPrismaGlobalVariable,
} from "@/lib/types/prisma";
import {
  validateUpdateProjectData,
  ValidationError,
  checkRateLimit,
} from "@/utils/validation";
import { logger } from "@/utils/logger";
import type {
  ProjectDetailResponse,
  UpdateProjectResponse,
  DeleteProjectResponse,
} from "@/types/api";

// GET /api/projects/[id] - получить проект по ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        globalVariables: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const canvasData = getPrismaCanvasData(project.canvasData) || {
      nodes: [],
      edges: [],
      executionResults: {},
      viewport: null,
    };

    const response: ProjectDetailResponse = {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        canvasData: {
          nodes: canvasData.nodes || [],
          edges: canvasData.edges || [],
          executionResults: (canvasData.executionResults || {}) as Record<
            string,
            {
              nodeId: string;
              success: boolean;
              output?: unknown;
              error?: string;
              duration?: number;
            }
          >,
          viewport: canvasData.viewport || null,
        },
        globalVariables: project.globalVariables.reduce(
          (acc, variable) => {
            const varWithType = variable as {
              name: string;
              value: string;
              type?: string | null;
              description?: string | null;
              folder?: string | null;
            };
            acc[variable.name] = {
              name: variable.name,
              value: variable.value,
              type: varWithType.type !== null ? varWithType.type : undefined,
              description:
                variable.description !== null
                  ? variable.description
                  : undefined,
              folder: variable.folder !== null ? variable.folder : undefined,
            };
            return acc;
          },
          {} as Record<
            string,
            {
              name: string;
              value: string;
              type?: string;
              description?: string;
              folder?: string;
            }
          >,
        ),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    // Failed to fetch project
    logger.error("[API] Failed to fetch project:", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 },
    );
  }
}

// PUT /api/projects/[id] - обновить проект
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp, "api")) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    // Validate request body
    const body = await request.json();
    logger.info("[API] Update project body:", {
      bodyKeys: Object.keys(body),
      nodesCount: body.nodes?.length,
      edgesCount: body.edges?.length,
    });
    const {
      name,
      description,
      nodes,
      edges,
      executionResults,
      globalVariables,
      viewport,
    } = validateUpdateProjectData(body);

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (name) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (
      nodes ||
      edges ||
      executionResults !== undefined ||
      viewport !== undefined
    ) {
      try {
        // Clean and validate data before saving
        const existingCanvas = getPrismaCanvasData(existingProject.canvasData);

        // CRITICAL: Don't use jsonClone for nodes as it loses undefined properties
        // We need to preserve parentId, extent, expandParent even when they are undefined
        const cleanNodes = nodes || existingCanvas?.nodes || [];
        const cleanEdges = edges || existingCanvas?.edges || [];
        const cleanExecutionResults =
          executionResults || existingCanvas?.executionResults || {};
        const cleanViewport =
          viewport !== undefined ? viewport : existingCanvas?.viewport || null;

        updateData.canvasData = {
          nodes: cleanNodes,
          edges: cleanEdges,
          executionResults: cleanExecutionResults,
          viewport: cleanViewport,
        };
      } catch (error) {
        logger.error("[API] Failed to serialize canvas data:", error as Error);
        throw new Error("Invalid data format: unable to serialize canvas data");
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Обновляем глобальные переменные
    if (globalVariables !== undefined) {
      // Удаляем старые переменные
      await prisma.globalVariable.deleteMany({
        where: { projectId: id } as Prisma.GlobalVariableWhereInput,
      });

      // Добавляем новые переменные
      if (Object.keys(globalVariables).length > 0) {
        const variableData = Object.entries(globalVariables).map(
          ([varName, varData]) => {
            const data = getPrismaGlobalVariable(varData);
            return {
              projectId: id,
              name: varName,
              value: data.value,
              type: data.type || null,
              description: data.description || "",
              folder: data.folder,
            };
          },
        );

        await prisma.globalVariable.createMany({
          data: variableData as Prisma.GlobalVariableCreateManyInput[],
        });
      }
    }

    const updatedCanvasData = getPrismaCanvasData(
      updatedProject.canvasData,
    ) || { nodes: [], edges: [] };
    const response: UpdateProjectResponse = {
      success: true,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description || undefined,
        canvasData: {
          nodes: updatedCanvasData.nodes || [],
          edges: updatedCanvasData.edges || [],
          executionResults: (updatedCanvasData.executionResults ||
            {}) as Record<
            string,
            {
              nodeId: string;
              success: boolean;
              output?: unknown;
              error?: string;
              duration?: number;
            }
          >,
          viewport: updatedCanvasData.viewport || null,
        },
        createdAt: updatedProject.createdAt.toISOString(),
        updatedAt: updatedProject.updatedAt.toISOString(),
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error("[API] Validation error:", error.toJSON());
      return NextResponse.json(
        { error: error.message, details: error.toJSON() },
        { status: 400 },
      );
    }

    logger.error("[API] Update project error:", error as Error);
    return NextResponse.json(
      {
        error: "Failed to update project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/projects/[id] - удалить проект
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Prevent deletion of system projects
    if (existingProject.isSystem) {
      return NextResponse.json(
        {
          error:
            'System projects cannot be deleted. Use "Reset to factory defaults" instead.',
        },
        { status: 403 },
      );
    }

    await prisma.project.delete({
      where: { id },
    });

    const response: DeleteProjectResponse = {
      success: true,
      message: "Project deleted successfully",
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error("Failed to delete project:", error as Error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
