import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaCanvasData } from '@/lib/types/prisma';
import { logger } from '@/utils/logger';
import type { DataObject } from '@/types/data';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: projectId } = params;
    
    // Fetch the original project
    const originalProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        globalVariables: true
      }
    });

    if (!originalProject) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Parse canvas data to get node and edge count
    const canvasData = getPrismaCanvasData(originalProject.canvasData) || { nodes: [], edges: [] };
    const nodeCount = canvasData.nodes?.length || 0;
    const edgeCount = canvasData.edges?.length || 0;

    // Create a duplicate project with a new name
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const duplicatedProject = await prisma.project.create({
      data: {
        name: `${originalProject.name} (Copy ${timestamp})`,
        description: originalProject.description,
        canvasData: originalProject.canvasData || undefined, // Copy the canvas data as-is
        globalVariables: {
          create: originalProject.globalVariables.map(variable => ({
            name: variable.name,
            value: variable.value,
            description: variable.description
          }))
        }
      },
      include: {
        globalVariables: true
      }
    });

    // Return success response with the new project
    return NextResponse.json({
      success: true,
      project: {
        id: duplicatedProject.id,
        name: duplicatedProject.name,
        description: duplicatedProject.description,
        nodeCount: nodeCount,
        edgeCount: edgeCount,
        createdAt: duplicatedProject.createdAt.toISOString(),
        updatedAt: duplicatedProject.updatedAt.toISOString(),
        canvasData: duplicatedProject.canvasData,
        globalVariables: duplicatedProject.globalVariables.reduce((acc: DataObject, variable) => {
          acc[variable.name] = {
            name: variable.name,
            value: variable.value,
            description: variable.description
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to duplicate project:', errorMessage);
    
    // Detailed error logging
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to duplicate project' 
      },
      { status: 500 }
    );
  }
}
