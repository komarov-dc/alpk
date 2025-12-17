// Yandex Cloud Models API Endpoint

import { NextRequest, NextResponse } from "next/server";
import { YandexCloudProvider } from "@/lib/providers/yandex";
import { logger } from "@/utils/logger";

export async function GET(request: NextRequest) {
  try {
    // Get credentials from Authorization header or environment variables
    // SECURITY: Never accept API keys in query parameters - they get logged
    const authHeader = request.headers.get("Authorization");
    const apiKey =
      authHeader?.replace("Bearer ", "") || process.env.YANDEX_CLOUD_API_KEY;
    const folderId =
      request.headers.get("X-Folder-Id") ||
      process.env.YANDEX_CLOUD_FOLDER ||
      "b1gv7s2cc3lh59k24svl";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API key is required. Set YANDEX_CLOUD_API_KEY in .env or provide Authorization header.",
        },
        { status: 400 },
      );
    }

    const yandexProvider = new YandexCloudProvider({
      apiKey,
      folderId,
    });

    const models = await yandexProvider.getModels();

    return NextResponse.json({
      success: true,
      models,
      total: models.length,
    });
  } catch (error) {
    logger.error("Yandex Cloud models API error:", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch Yandex Cloud models" },
      { status: 500 },
    );
  }
}
