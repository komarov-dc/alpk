/**
 * Internal API: Execute Pipeline Programmatically
 * Used by background workers to trigger pipeline execution
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Node, Edge } from "@xyflow/react";
import { saveExecutionLogToFile } from "@/utils/executionFileLogger";
import { timingSafeEqual } from "crypto";

// Shared secret for internal API authentication
const INTERNAL_SECRET =
  process.env.ALPAKA_INTERNAL_SECRET || process.env.ALPAKA_SHARED_SECRET;

if (!INTERNAL_SECRET) {
  console.warn(
    "⚠️ ALPAKA_INTERNAL_SECRET not set! Internal API will be insecure.",
  );
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

function verifyInternalAuth(req: NextRequest): boolean {
  const secret = req.headers.get("X-Alpaka-Internal-Secret");
  return secureCompare(secret, INTERNAL_SECRET);
}

/**
 * POST /api/internal/execute-flow
 * Trigger pipeline execution programmatically
 *
 * Request body:
 * {
 *   "projectId": "cmhkdbn560000vt859aw766a2",
 *   "globalVariables": {
 *     "job_id": "uuid-123",
 *     "job_session_id": "session-456",
 *     "questionnaire_responses": "{...}"
 *   },
 *   "clearResults": false // optional, default false
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    if (!verifyInternalAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid internal secret" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { projectId, globalVariables, clearResults = false } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Load project from database
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 },
      );
    }

    // Get canvasData (Prisma Json fields are already parsed objects)
    type GlobalVarType = {
      name: string;
      value: string;
      description?: string;
      folder?: string | null;
    };
    const canvasData = (project.canvasData || {}) as {
      nodes?: Node[];
      edges?: Edge[];
      globalVariables?: Record<string, GlobalVarType>;
    };
    const nodes: Node[] = canvasData.nodes || [];
    const edges: Edge[] = canvasData.edges || [];

    // Load global variables from database table (correct source)
    const dbGlobalVars = await prisma.globalVariable.findMany({
      where: { projectId },
      select: { name: true, value: true, description: true, folder: true },
    });

    // Convert database global variables to the format executor expects
    const existingGlobalVars: Record<string, GlobalVarType> = {};
    dbGlobalVars.forEach((gv) => {
      existingGlobalVars[gv.name] = {
        name: gv.name,
        value: gv.value,
        description: gv.description || undefined,
        folder: gv.folder || null,
      };
    });

    // Merge provided globalVariables (from worker) with existing ones from database
    const mergedGlobalVariables = {
      ...existingGlobalVars,
      ...Object.entries(globalVariables || {}).reduce(
        (acc, [name, value]) => {
          acc[name] = {
            name,
            value: String(value),
            description: `Set by worker at ${new Date().toISOString()}`,
            folder: undefined,
          };
          return acc;
        },
        {} as Record<string, GlobalVarType>,
      ),
    };

    console.log(
      `🚀 [Internal API] Starting pipeline execution for project: ${project.name}`,
    );
    console.log(`   Nodes: ${nodes.length}, Edges: ${edges.length}`);
    console.log(
      `   Global variables: ${Object.keys(mergedGlobalVariables).length}`,
    );

    // Create ExecutionInstance BEFORE execution starts (status: running)
    const executionStartTime = new Date();
    const executionInstance = await prisma.executionInstance.create({
      data: {
        projectId,
        projectName: project.name,
        jobId:
          typeof globalVariables["job_id"] === "string"
            ? globalVariables["job_id"]
            : globalVariables["job_id"]?.value || null,
        sessionId:
          typeof globalVariables["job_session_id"] === "string"
            ? globalVariables["job_session_id"]
            : globalVariables["job_session_id"]?.value || null,
        status: "running",
        totalNodes: nodes.length,
        executedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        startedAt: executionStartTime,
        completedAt: null,
        duration: null,
        globalVariablesSnapshot: JSON.parse(
          JSON.stringify(mergedGlobalVariables),
        ),
        executionResults: {},
      },
    });

    console.log(
      `💾 [Internal API] Created ExecutionInstance (running): ${executionInstance.id}`,
    );

    // Execute pipeline using standalone executor
    const { executeFlowStandalone } = await import("@/lib/standaloneExecutor");

    const result = await executeFlowStandalone({
      nodes,
      edges,
      globalVariables: mergedGlobalVariables,
      clearResults,
      projectId,
      projectName: project.name,
    });

    console.log(`✅ [Internal API] Pipeline execution completed`);
    console.log(
      `   Executed: ${result.executed}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
    );

    // Update ExecutionInstance with final results
    const completedAt = new Date();
    const duration = completedAt.getTime() - executionStartTime.getTime();

    await prisma.executionInstance.update({
      where: { id: executionInstance.id },
      data: {
        status: result.success ? "completed" : "failed",
        executedNodes: result.executed,
        failedNodes: result.failed,
        skippedNodes: result.skipped,
        completedAt,
        duration,
        executionResults: JSON.parse(
          JSON.stringify(result.executionResults || {}),
        ),
      },
    });

    console.log(
      `💾 [Internal API] Updated ExecutionInstance: ${executionInstance.id} -> ${result.success ? "completed" : "failed"}`,
    );

    // Save ExecutionLog for each node
    const logPromises = Object.entries(result.executionResults || {}).map(
      async ([nodeId, execResult]) => {
        return prisma.executionLog.create({
          data: {
            nodeId,
            projectId,
            executionInstanceId: executionInstance.id,
            input: execResult.debugInfo?.request
              ? JSON.parse(JSON.stringify(execResult.debugInfo.request))
              : null,
            output: execResult.output
              ? JSON.parse(JSON.stringify(execResult.output))
              : null,
            status: execResult.success ? "completed" : "failed",
            error: execResult.error || null,
            duration: execResult.duration || null,
          },
        });
      },
    );

    await Promise.all(logPromises);
    console.log(`💾 [Internal API] Saved ${logPromises.length} ExecutionLogs`);

    // Save execution log to file (in addition to database)
    // Only enabled in standalone mode (workers) to avoid breaking Canvas execution
    const enableFileLogging =
      process.env.ENABLE_FILE_LOGGING === "true" ||
      process.env.NODE_ENV === "production";

    if (enableFileLogging) {
      try {
        // Parse questionnaire responses from global variables
        let questionnaireResponses: Record<string, unknown> | null = null;
        const qrString =
          mergedGlobalVariables["questionnaire_responses"]?.value;
        if (qrString) {
          try {
            questionnaireResponses = JSON.parse(qrString);
          } catch (parseError) {
            console.warn(
              "⚠️ Failed to parse questionnaire_responses:",
              parseError,
            );
          }
        }

        // Build node labels map for readable logs
        const nodeLabelsMap: Record<string, string> = {};
        nodes.forEach((node) => {
          if (node.data?.label) {
            nodeLabelsMap[node.id] = String(node.data.label);
          }
        });

        // Prepare node logs with labels and full data
        const nodeLogs = Object.entries(result.executionResults || {}).map(
          ([nodeId, execResult]) => ({
            nodeId,
            nodeLabel: nodeLabelsMap[nodeId] || nodeId,
            status: execResult.success
              ? ("completed" as const)
              : ("failed" as const),
            duration: execResult.duration || null,
            input: execResult.debugInfo?.request
              ? JSON.parse(JSON.stringify(execResult.debugInfo.request))
              : null,
            output: execResult.output
              ? JSON.parse(JSON.stringify(execResult.output))
              : null,
            error: execResult.error || null,
          }),
        );

        // Save to file
        const logFilePath = await saveExecutionLogToFile({
          executionInstanceId: executionInstance.id,
          projectId,
          projectName: project.name,
          jobId: executionInstance.jobId,
          sessionId: executionInstance.sessionId,
          status: executionInstance.status,
          startedAt:
            executionInstance.startedAt ||
            new Date(Date.now() - result.duration),
          completedAt: executionInstance.completedAt || new Date(),
          duration: result.duration,
          totalNodes: nodes.length,
          executedNodes: result.executed,
          failedNodes: result.failed,
          skippedNodes: result.skipped,
          questionnaireResponses,
          globalVariables: mergedGlobalVariables,
          nodeLogs,
          executionResults: result.executionResults || {},
        });

        console.log(
          `📝 [Internal API] Saved execution log to file: ${logFilePath}`,
        );
      } catch (fileLogError) {
        console.error(
          "⚠️ [Internal API] Failed to save execution log to file (non-critical):",
          fileLogError,
        );
        // Continue execution even if file logging fails
      }
    } else {
      console.log(
        `⏭️ [Internal API] File logging disabled (ENABLE_FILE_LOGGING not set)`,
      );
    }

    return NextResponse.json({
      success: true,
      projectId,
      projectName: project.name,
      executionId: result.executionId,
      executionInstanceId: executionInstance.id,
      stats: {
        totalNodes: nodes.length,
        executed: result.executed,
        failed: result.failed,
        skipped: result.skipped,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error("❌ [Internal API] Pipeline execution error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
