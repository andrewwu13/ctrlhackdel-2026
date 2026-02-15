import { GoogleGenerativeAI, GenerateContentRequest } from "@google/generative-ai";
import { config } from "../config";

// ── Constants ──────────────────────────────────────────────────────

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const EMBEDDING_MODEL = "text-embedding-005";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_RPM = 8; // stay under free-tier 10 RPM
const WINDOW_MS = 60_000;

// ── Singleton Client ───────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// ── Rate Limiter ───────────────────────────────────────────────────

const requestTimestamps: number[] = [];

function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  // Remove timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_RPM) {
    const waitUntil = requestTimestamps[0] + WINDOW_MS;
    const delay = waitUntil - now;
    console.warn(
      `[Gemini] Rate limit self-throttle: ${requestTimestamps.length}/${MAX_RPM} RPM, waiting ${delay}ms`
    );
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  requestTimestamps.push(now);
  return Promise.resolve();
}

// ── Error Helpers ──────────────────────────────────────────────────

interface GeminiErrorInfo {
  status: number | undefined;
  statusText: string;
  message: string;
  isRateLimit: boolean;
  isNotFound: boolean;
  isRetryable: boolean;
}

function parseGeminiError(error: unknown): GeminiErrorInfo {
  const err = error as Record<string, unknown> | undefined;
  const status =
    (err?.status as number) ??
    (err?.httpStatusCode as number) ??
    extractStatusFromMessage(String(err?.message ?? ""));
  const message = String(err?.message ?? err ?? "Unknown Gemini error");

  const isRateLimit = status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
  const isNotFound = status === 404 || message.includes("404") || message.includes("not found");
  const isServerError = status !== undefined && status >= 500 && status < 600;
  const isRetryable = isRateLimit || isServerError;

  let statusText = "UNKNOWN";
  if (isRateLimit) statusText = "RATE_LIMITED";
  else if (isNotFound) statusText = "NOT_FOUND";
  else if (isServerError) statusText = "SERVER_ERROR";
  else if (status !== undefined) statusText = `HTTP_${status}`;

  return { status, statusText, message, isRateLimit, isNotFound, isRetryable };
}

function extractStatusFromMessage(message: string): number | undefined {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

// ── Retry Wrapper for generateContent ──────────────────────────────

export async function generateWithRetry(
  request: GenerateContentRequest & { systemInstruction?: unknown },
  options: {
    caller?: string;
    temperature?: number;
    model?: string;
    jsonMode?: boolean;
  } = {}
): Promise<string> {
  const caller = options.caller ?? "unknown";
  const modelName = options.model ?? PRIMARY_MODEL;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const currentModel = modelName;

    try {
      await enforceRateLimit();
      const startMs = Date.now();

      const generationConfig: Record<string, unknown> = {};
      if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options.jsonMode) generationConfig.responseMimeType = "application/json";

      const model = genAI.getGenerativeModel({
        model: currentModel,
        generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig as never : undefined,
      });

      const result = await model.generateContent(request);
      const text = result.response.text();
      const elapsedMs = Date.now() - startMs;

      console.log(
        `[Gemini] ${caller} | ${currentModel} | 200 OK | ${elapsedMs}ms | attempt ${attempt + 1}/${MAX_RETRIES + 1}`
      );

      return text;
    } catch (error) {
      lastError = error;
      const info = parseGeminiError(error);

      // On 404, try fallback model immediately
      if (info.isNotFound && currentModel === PRIMARY_MODEL) {
        console.warn(
          `[Gemini] ${caller} | ${currentModel} | 404 NOT_FOUND | falling back to ${FALLBACK_MODEL}`
        );
        try {
          await enforceRateLimit();
          const startMs = Date.now();
          const fallbackGenConfig: Record<string, unknown> = {};
          if (options.temperature !== undefined) fallbackGenConfig.temperature = options.temperature;
          if (options.jsonMode) fallbackGenConfig.responseMimeType = "application/json";

          const fallbackModel = genAI.getGenerativeModel({
            model: FALLBACK_MODEL,
            generationConfig: Object.keys(fallbackGenConfig).length > 0 ? fallbackGenConfig as never : undefined,
          });
          const result = await fallbackModel.generateContent(request);
          const text = result.response.text();
          const elapsedMs = Date.now() - startMs;
          console.log(
            `[Gemini] ${caller} | ${FALLBACK_MODEL} (fallback) | 200 OK | ${elapsedMs}ms`
          );
          return text;
        } catch (fallbackError) {
          const fallbackInfo = parseGeminiError(fallbackError);
          console.error(
            `[Gemini] ${caller} | ${FALLBACK_MODEL} (fallback) | ${fallbackInfo.statusText} | ${fallbackInfo.message}`
          );
          lastError = fallbackError;
        }
      }

      if (info.isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Gemini] ${caller} | ${currentModel} | ${info.statusText} | retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[Gemini] ${caller} | ${currentModel} | ${info.statusText} | FAILED after ${attempt + 1} attempts | ${info.message}`
        );
      }
    }
  }

  throw lastError;
}

// ── Retry Wrapper for embedContent ─────────────────────────────────

export async function embedWithRetry(
  text: string,
  options: { caller?: string } = {}
): Promise<number[]> {
  const caller = options.caller ?? "unknown";
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await enforceRateLimit();
      const startMs = Date.now();

      const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent(text);
      const elapsedMs = Date.now() - startMs;

      console.log(
        `[Gemini] ${caller} | ${EMBEDDING_MODEL} | 200 OK | ${elapsedMs}ms | dim=${result.embedding.values.length} | attempt ${attempt + 1}/${MAX_RETRIES + 1}`
      );

      return result.embedding.values;
    } catch (error) {
      lastError = error;
      const info = parseGeminiError(error);

      if (info.isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Gemini] ${caller} | ${EMBEDDING_MODEL} | ${info.statusText} | retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[Gemini] ${caller} | ${EMBEDDING_MODEL} | ${info.statusText} | FAILED after ${attempt + 1} attempts | ${info.message}`
        );
      }
    }
  }

  throw lastError;
}

// ── Log on import ──────────────────────────────────────────────────

console.log(
  `[Gemini] Client initialized | primary: ${PRIMARY_MODEL} | fallback: ${FALLBACK_MODEL} | embedding: ${EMBEDDING_MODEL} | max RPM: ${MAX_RPM}`
);
