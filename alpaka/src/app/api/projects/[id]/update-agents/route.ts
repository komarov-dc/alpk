import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaCanvasData } from '@/lib/types/prisma';
import { jsonClone } from '@/utils/safeJson';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';

// PATCH /api/projects/[id]/update-agents - Update agent conversation history
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { agents } = await request.json();
    
    // Get existing project
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const canvasData = getPrismaCanvasData(project.canvasData) || { nodes: [], edges: [] };
    const nodes = (canvasData?.nodes || []) as Record<string, unknown>[];
    
    // Update agent nodes with new conversation history
    const updatedNodes = nodes.map((node) => {
      const agentUpdate = agents.find((a: { id: string }) => a.id === node.id);
      if (agentUpdate && node.type === 'agent') {
        const nodeData = node.data as Record<string, unknown>;
        return {
          ...node,
          data: {
            ...nodeData,
            conversationHistory: agentUpdate.conversationHistory,
            currentTurn: agentUpdate.currentTurn || nodeData.currentTurn,
            executionState: agentUpdate.executionState || nodeData.executionState
          }
        };
      }
      return node;
    });

    // Update project with new nodes
    const updatedCanvasData = jsonClone({
      nodes: updatedNodes,
      edges: canvasData?.edges || []
    });
    
    if (!updatedCanvasData) {
      throw new Error('Failed to serialize canvas data');
    }
    
    await prisma.project.update({
      where: { id },
      data: {
        canvasData: updatedCanvasData as Prisma.InputJsonValue
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Agent conversation history updated',
      projectId: id,
      updatedAgents: agents.map((a: { id: string }) => a.id)
    });
  } catch (error) {
    logger.error('Failed to update agents:', error as Error);
    return NextResponse.json(
      { error: 'Failed to update agents' },
      { status: 500 }
    );
  }
}

// POST is an alias for PATCH
export const POST = PATCH;
