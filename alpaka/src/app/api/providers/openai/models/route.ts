// OpenAI Models API Endpoint

import { NextRequest, NextResponse } from "next/server";
import { API_URLS } from "@/config/api";
import { logger } from "@/utils/logger";

export async function GET(request: NextRequest) {
  try {
    // Get credentials from headers or environment variables
    // SECURITY: Never accept API keys in query parameters - they get logged
    const authHeader = request.headers.get("Authorization");
    const apiKey =
      authHeader?.replace("Bearer ", "") || process.env.OPENAI_API_KEY;
    const baseURL =
      request.headers.get("X-Base-URL") || API_URLS.OPENAI_BASE_URL;
    const organization =
      request.headers.get("OpenAI-Organization") ||
      process.env.OPENAI_ORGANIZATION;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API key is required. Set OPENAI_API_KEY in .env or provide Authorization header.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(organization && { "OpenAI-Organization": organization }),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          error: `OpenAI API error: ${error.error?.message || response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Filter and format models
    const models = data.data
      .filter(
        (model: { id: string }) =>
          model.id.includes("gpt") ||
          model.id.includes("o1") ||
          model.id.includes("text-") ||
          model.id.includes("code-"),
      )
      .map((model: { id: string; created: number; owned_by: string }) => ({
        id: model.id,
        name: model.id,
        provider: "openai",
        description: `OpenAI model: ${model.id}`,
        contextLength: getContextLength(model.id),
        capabilities: getModelCapabilities(model.id),
        created: model.created,
        owned_by: model.owned_by,
      }))
      .sort(
        (a: { created: number }, b: { created: number }) =>
          b.created - a.created,
      ); // Sort by newest first

    return NextResponse.json({
      success: true,
      models,
      total: models.length,
    });
  } catch (error) {
    logger.error("OpenAI models API error:", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAI models" },
      { status: 500 },
    );
  }
}

function getContextLength(modelId: string): number {
  const contextLengths: Record<string, number> = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "o1-preview": 128000,
    "o1-mini": 128000,
  };

  // Find exact match
  if (contextLengths[modelId]) {
    return contextLengths[modelId];
  }

  // Check for partial matches
  for (const [key, length] of Object.entries(contextLengths)) {
    if (modelId.includes(key)) {
      return length;
    }
  }

  return 4096; // Default
}

function getModelCapabilities(modelId: string) {
  const isO1Model = modelId.includes("o1");
  const isGPT4 = modelId.includes("gpt-4");
  const isVisionModel =
    modelId.includes("gpt-4") && !modelId.includes("gpt-4-32k");

  return {
    chat: true,
    completion: !isO1Model,
    vision: isVisionModel,
    functionCalling: isGPT4 && !isO1Model,
    reasoning: isO1Model,
  };
}
