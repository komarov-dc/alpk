/**
 * Reset Project to Factory Defaults
 * POST /api/projects/[id]/reset
 *
 * Resets a system project to its factory template state.
 * Only works for projects with isSystem=true and a valid templateId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

interface TemplateData {
  templateId: string;
  name: string;
  description: string | null;
  canvasData: unknown;
  globalVariables: Array<{
    name: string;
    value: string;
    type: string | null;
    description: string | null;
    folder: string | null;
  }>;
  exportedAt: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Find the project
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isSystem: true,
        templateId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only system projects can be reset
    if (!project.isSystem) {
      return NextResponse.json(
        { error: "Only system projects can be reset to factory defaults" },
        { status: 400 },
      );
    }

    // Must have a templateId
    if (!project.templateId) {
      return NextResponse.json(
        { error: "Project does not have a template ID" },
        { status: 400 },
      );
    }

    // Load template from file
    const templatePath = path.join(
      process.cwd(),
      "templates",
      `${project.templateId}.json`,
    );

    let templateContent: string;
    try {
      templateContent = await fs.readFile(templatePath, "utf-8");
    } catch (err) {
      console.error(`Failed to read template file: ${templatePath}`, err);
      return NextResponse.json(
        { error: `Template file not found: ${project.templateId}.json` },
        { status: 404 },
      );
    }

    const template: TemplateData = JSON.parse(templateContent);

    // Start transaction to reset project
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing global variables
      await tx.globalVariable.deleteMany({
        where: { projectId: id },
      });

      // 2. Update project with template data
      await tx.project.update({
        where: { id },
        data: {
          canvasData: template.canvasData as object,
          updatedAt: new Date(),
        },
      });

      // 3. Create global variables from template
      if (template.globalVariables && template.globalVariables.length > 0) {
        await tx.globalVariable.createMany({
          data: template.globalVariables.map((v) => ({
            projectId: id,
            name: v.name,
            value: v.value,
            type: v.type,
            description: v.description,
            folder: v.folder,
          })),
        });
      }
    });

    console.log(
      `[Reset API] Project "${project.name}" (${id}) reset to template "${project.templateId}"`,
    );

    return NextResponse.json({
      success: true,
      message: `Project "${project.name}" has been reset to factory defaults`,
      templateId: project.templateId,
      globalVariablesCount: template.globalVariables?.length || 0,
    });
  } catch (error) {
    console.error("[Reset API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to reset project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
