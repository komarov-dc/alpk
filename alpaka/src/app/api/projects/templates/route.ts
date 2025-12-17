import { NextRequest, NextResponse } from 'next/server';
import { Node } from '@xyflow/react';
import { prisma } from '@/lib/prisma';
import { createBasicLLMChainNode, createModelProviderNode } from '@/store/modules/nodeFactories';
import { safeJsonParse, safeJsonStringify } from '@/utils/safeJson';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';

// GET /api/projects/templates - get list of available starter templates
export async function GET() {
  try {
    // Simple starter templates that users can build upon on the canvas
    const templates = [
      {
        id: 'blank',
        name: 'Blank Canvas',
        description: 'Start with a clean canvas and build your workflow',
        nodeCount: 0,
        category: 'Starter'
      },
      {
        id: 'simple-workflow',
        name: 'Simple Workflow',
        description: 'Basic Input → LLM → Output workflow to get started',
        nodeCount: 3,
        category: 'Starter'
      }
    ];
    
    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Failed to get templates:', error as Error);
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    );
  }
}

// POST /api/projects/templates - create project from template
export async function POST(request: NextRequest) {
  try {
    const { templateId, name, description } = await request.json();
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }
    
    // Generate simple workflow based on template
    let workflowData;
    switch (templateId) {
      case 'blank':
        workflowData = { nodes: [], edges: [] };
        break;
      case 'simple-workflow':
        workflowData = createSimpleWorkflow();
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown template ID' },
          { status: 400 }
        );
    }
    
    logger.info(`🔧 Template ${templateId} generated:`, {
      nodeCount: workflowData.nodes.length,
      edgeCount: workflowData.edges.length
    });
    
    // Create project in database
    const stringified = safeJsonStringify(workflowData);
    if (!stringified) {
      throw new Error('Failed to serialize workflow data');
    }
    const canvasData = safeJsonParse(stringified, workflowData);
    
    const newProject = await prisma.project.create({
      data: {
        name: name || `Project from ${templateId}`,
        description: description || `Created from ${templateId} template`,
        canvasData: canvasData as unknown as Prisma.InputJsonValue
      }
    });
    
    logger.info(`✅ Project created:`, {
      id: newProject.id,
      name: newProject.name,
      nodeCount: workflowData.nodes.length
    });

    return NextResponse.json({
      success: true,
      project: {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description
      }
    });

  } catch (error) {
    logger.error('Failed to create project from template:', error as Error);
    return NextResponse.json(
      { error: 'Failed to create project from template' },
      { status: 500 }
    );
  }
}

// Simple workflow: Model Provider → LLM
function createSimpleWorkflow() {
  const nodes: Node[] = [];
  const edges: unknown[] = [];

  // Create nodes
  const modelNode = createModelProviderNode(crypto.randomUUID(), { x: 300, y: 200 }, []);
  modelNode.data.label = 'Model Config';
  nodes.push(modelNode);

  const llmNode = createBasicLLMChainNode(crypto.randomUUID(), { x: 500, y: 200 }, nodes);
  llmNode.data.label = 'AI Assistant';
  llmNode.data.messages = [{
    id: 'user_1',
    role: 'user',
    content: 'Enter your prompt here'
  }];
  nodes.push(llmNode);

  return { nodes, edges };
}