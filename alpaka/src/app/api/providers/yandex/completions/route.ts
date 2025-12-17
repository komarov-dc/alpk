// Yandex Cloud Completions API Proxy

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/utils/logger";

// ============================================================================
// IAM Token Cache - токен действует 12 часов, обновляем за 30 минут до истечения
// ============================================================================
interface TokenCache {
  token: string;
  expiresAt: number;
  oauthTokenHash: string; // Для поддержки разных OAuth токенов
}

let iamTokenCache: TokenCache | null = null;
const TOKEN_TTL = 12 * 60 * 60 * 1000; // 12 часов
const TOKEN_REFRESH_BUFFER = 30 * 60 * 1000; // Обновить за 30 минут до истечения

// Простой hash для сравнения OAuth токенов (не криптографический)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Helper function to get IAM token from OAuth token (internal, без кеша)
async function fetchIAMToken(
  oauthToken: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(
    "https://iam.api.cloud.yandex.net/iam/v1/tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        yandexPassportOauthToken: oauthToken,
      }),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get IAM token: ${response.status}`);
  }

  const data = await response.json();
  return data.iamToken;
}

// Получить IAM токен с кешированием
async function getIAMToken(
  oauthToken: string,
  signal?: AbortSignal,
): Promise<string> {
  const now = Date.now();
  const oauthHash = simpleHash(oauthToken);

  // Проверить кеш: токен валиден и для того же OAuth токена
  if (
    iamTokenCache &&
    iamTokenCache.oauthTokenHash === oauthHash &&
    now < iamTokenCache.expiresAt - TOKEN_REFRESH_BUFFER
  ) {
    logger.dev("IAM token cache hit");
    return iamTokenCache.token;
  }

  // Получить новый токен
  logger.dev("IAM token cache miss, fetching new token");
  const token = await fetchIAMToken(oauthToken, signal);

  // Кешировать
  iamTokenCache = {
    token,
    expiresAt: now + TOKEN_TTL,
    oauthTokenHash: oauthHash,
  };

  return token;
}

// ============================================================================
// Circuit Breaker для Yandex Cloud API
// Если слишком много ошибок подряд - временно прекращаем запросы
// ============================================================================
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  state: "closed",
};

const CIRCUIT_BREAKER_THRESHOLD = 5; // 5 ошибок подряд открывают circuit
const CIRCUIT_BREAKER_RESET_TIMEOUT = 60 * 1000; // 1 минута cooldown

function checkCircuitBreaker(): { allowed: boolean; error?: string } {
  const now = Date.now();

  if (circuitBreaker.state === "open") {
    // Проверяем, прошло ли достаточно времени для перехода в half-open
    if (now - circuitBreaker.lastFailure > CIRCUIT_BREAKER_RESET_TIMEOUT) {
      circuitBreaker.state = "half-open";
      logger.dev("Circuit breaker: transitioning to half-open");
      return { allowed: true };
    }
    const remainingCooldown = Math.round(
      (CIRCUIT_BREAKER_RESET_TIMEOUT - (now - circuitBreaker.lastFailure)) /
        1000,
    );
    return {
      allowed: false,
      error: `Circuit breaker is open. Too many Yandex API failures. Retry in ${remainingCooldown}s`,
    };
  }

  return { allowed: true };
}

function recordCircuitBreakerSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.state = "closed";
}

function recordCircuitBreakerFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = "open";
    logger.warn(
      `Circuit breaker opened: ${circuitBreaker.failures} consecutive Yandex API failures`,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check circuit breaker first
    const circuitCheck = checkCircuitBreaker();
    if (!circuitCheck.allowed) {
      return NextResponse.json({ error: circuitCheck.error }, { status: 503 });
    }

    const body = await request.json();

    // Get OAuth token or API key from request or environment
    const oauthToken = body.oauthToken || process.env.YANDEX_CLOUD_OAUTH_TOKEN;
    const apiKey = body.apiKey || process.env.YANDEX_CLOUD_API_KEY;

    if (!oauthToken && !apiKey) {
      return NextResponse.json(
        {
          error:
            "OAuth token or API key is required. Set YANDEX_CLOUD_OAUTH_TOKEN or YANDEX_CLOUD_API_KEY in .env or provide it in the request.",
        },
        { status: 400 },
      );
    }

    // Get IAM token from OAuth if OAuth token is provided
    let authToken = apiKey;
    if (oauthToken) {
      try {
        // Timeout for IAM token request (1 minute)
        const iamController = new AbortController();
        const iamTimeoutId = setTimeout(() => iamController.abort(), 60 * 1000);

        try {
          authToken = await getIAMToken(oauthToken, iamController.signal);
          clearTimeout(iamTimeoutId);
        } catch (error) {
          clearTimeout(iamTimeoutId);
          throw error;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          logger.error("IAM token request timeout (1 minute)");
          return NextResponse.json(
            { error: "IAM token request timeout" },
            { status: 504 },
          );
        }
        logger.error("Failed to get IAM token:", error as Error);
        return NextResponse.json(
          { error: "Failed to get IAM token from OAuth token" },
          { status: 401 },
        );
      }
    }

    // Remove credentials from body before sending to Yandex
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      oauthToken: _oauth,
      apiKey: _key,
      folderId: _folder,
      ...requestBody
    } = body;

    logger.dev("Yandex API request:", {
      model: requestBody.model,
      messagesCount: requestBody.messages?.length,
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
    });

    // Determine auth type based on token format
    // IAM tokens start with t1., API keys start with AQVN
    const authHeader = authToken.startsWith("t1.")
      ? `Bearer ${authToken}`
      : `Api-Key ${authToken}`;

    // Use OpenAI-compatible endpoint with 90-minute timeout (BigFive can take 50-60 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90 * 60 * 1000); // 90 minutes

    try {
      const response = await fetch(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "Yandex Cloud API error:",
          new Error(`${response.status} - ${errorText}`),
        );
        // Record failure for circuit breaker (only for server errors, not client errors)
        if (response.status >= 500) {
          recordCircuitBreakerFailure();
        }
        return NextResponse.json(
          {
            error: `Yandex Cloud API error: ${response.status} - ${errorText}`,
          },
          { status: response.status },
        );
      }

      const data = await response.json();

      // Success! Reset circuit breaker
      recordCircuitBreakerSuccess();

      // Response is already in OpenAI-compatible format
      return NextResponse.json(data);
    } catch (error) {
      clearTimeout(timeoutId);

      // Record failure for circuit breaker
      recordCircuitBreakerFailure();

      if ((error as Error).name === "AbortError") {
        logger.error("Yandex API request timeout (90 minutes)", {
          message: `Request timeout after 90 minutes for model ${requestBody.model}`,
          model: requestBody.model,
          messagesCount: requestBody.messages?.length,
        });
        return NextResponse.json(
          { error: "Request timeout after 90 minutes" },
          { status: 504 },
        );
      }

      throw error;
    }
  } catch (error) {
    // Record failure for circuit breaker
    recordCircuitBreakerFailure();
    logger.error("Yandex Cloud proxy error:", error as Error);
    return NextResponse.json(
      { error: "Failed to process Yandex Cloud request" },
      { status: 500 },
    );
  }
}
