import { GoogleGenerativeAI, GenerateContentRequest } from "@google/generative-ai";
import Groq from "groq-sdk";
import { config } from "../config";

// ── Model Constants ────────────────────────────────────────────────

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = "gemini-2.5-flash-lite"; // fallback if no Groq key
const EMBEDDING_MODEL = "text-embedding-005";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// ── Clients ────────────────────────────────────────────────────────

const groqClient = config.groqApiKey
  ? new Groq({ apiKey: config.groqApiKey })
  : null;

const geminiClient = config.geminiApiKey
  ? new GoogleGenerativeAI(config.geminiApiKey)
  : null;

// ── Rate Limiter (per-provider) ────────────────────────────────────

const rateLimitState = {
  groq: { timestamps: [] as number[], maxRpm: 25 },   // Groq free = 30 RPM
  gemini: { timestamps: [] as number[], maxRpm: 12 },  // Gemini free = 15 RPM
};

function enforceRateLimit(provider: "groq" | "gemini"): Promise<void> {
  const state = rateLimitState[provider];
  const now = Date.now();

  while (state.timestamps.length > 0 && state.timestamps[0] < now - 60_000) {
    state.timestamps.shift();
  }

  if (state.timestamps.length >= state.maxRpm) {
    const waitUntil = state.timestamps[0] + 60_000;
    const delay = waitUntil - now;
    console.warn(
      `[LLM] ${provider} rate limit self-throttle: ${state.timestamps.length}/${state.maxRpm} RPM, waiting ${delay}ms`
    );
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  state.timestamps.push(now);
  return Promise.resolve();
}

// ── Error Helpers ──────────────────────────────────────────────────

interface LLMErrorInfo {
  status: number | undefined;
  statusText: string;
  message: string;
  isRateLimit: boolean;
  isRetryable: boolean;
}

function parseError(error: unknown): LLMErrorInfo {
  const err = error as Record<string, unknown> | undefined;
  const status =
    (err?.status as number) ??
    (err?.httpStatusCode as number) ??
    extractStatusFromMessage(String(err?.message ?? ""));
  const message = String(err?.message ?? err ?? "Unknown error");

  const isRateLimit =
    status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("rate_limit");
  const isServerError = status !== undefined && status >= 500 && status < 600;
  const isRetryable = isRateLimit || isServerError;

  let statusText = "UNKNOWN";
  if (isRateLimit) statusText = "RATE_LIMITED";
  else if (isServerError) statusText = "SERVER_ERROR";
  else if (status !== undefined) statusText = `HTTP_${status}`;

  return { status, statusText, message, isRateLimit, isRetryable };
}

function extractStatusFromMessage(message: string): number | undefined {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

// ── Groq Generation ────────────────────────────────────────────────

async function generateViaGroq(
  prompt: string,
  systemPrompt: string | undefined,
  options: { temperature?: number; jsonMode?: boolean; caller: string }
): Promise<string> {
  if (!groqClient) throw new Error("Groq client not initialized — GROQ_API_KEY missing");

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await enforceRateLimit("groq");
      const startMs = Date.now();

      const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const completion = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: 1024,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      });

      const text = completion.choices[0]?.message?.content ?? "";
      const elapsedMs = Date.now() - startMs;

      console.log(
        `[LLM] ${options.caller} | groq/${GROQ_MODEL} | 200 OK | ${elapsedMs}ms | attempt ${attempt + 1}/${MAX_RETRIES + 1}`
      );

      return text;
    } catch (error) {
      lastError = error;
      const info = parseError(error);

      if (info.isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[LLM] ${options.caller} | groq/${GROQ_MODEL} | ${info.statusText} | retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[LLM] ${options.caller} | groq/${GROQ_MODEL} | ${info.statusText} | FAILED after ${attempt + 1} attempts | ${info.message}`
        );
      }
    }
  }

  throw lastError;
}

// ── Gemini Generation (fallback) ───────────────────────────────────

async function generateViaGemini(
  request: GenerateContentRequest & { systemInstruction?: unknown },
  options: { temperature?: number; jsonMode?: boolean; caller: string }
): Promise<string> {
  if (!geminiClient) throw new Error("Gemini client not initialized — GEMINI_API_KEY missing");

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await enforceRateLimit("gemini");
      const startMs = Date.now();

      const generationConfig: Record<string, unknown> = {};
      if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options.jsonMode) generationConfig.responseMimeType = "application/json";

      const model = geminiClient.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig as never : undefined,
      });

      const result = await model.generateContent(request);
      const text = result.response.text();
      const elapsedMs = Date.now() - startMs;

      console.log(
        `[LLM] ${options.caller} | gemini/${GEMINI_MODEL} | 200 OK | ${elapsedMs}ms | attempt ${attempt + 1}/${MAX_RETRIES + 1}`
      );

      return text;
    } catch (error) {
      lastError = error;
      const info = parseError(error);

      if (info.isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[LLM] ${options.caller} | gemini/${GEMINI_MODEL} | ${info.statusText} | retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[LLM] ${options.caller} | gemini/${GEMINI_MODEL} | ${info.statusText} | FAILED after ${attempt + 1} attempts | ${info.message}`
        );
      }
    }
  }

  throw lastError;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate text using the best available provider.
 * Uses Groq (14,400 RPD) by default, falls back to Gemini if no Groq key.
 *
 * For callers that were previously passing Gemini-shaped `contents` arrays,
 * this now extracts the text and system prompt to pass to whichever provider.
 */
export async function generateWithRetry(
  request: GenerateContentRequest & { systemInstruction?: unknown },
  options: {
    caller?: string;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
  } = {}
): Promise<string> {
  const caller = options.caller ?? "unknown";

  // Extract text content from the Gemini-shaped request for Groq
  const userParts = request.contents
    .filter((c) => c.role === "user")
    .flatMap((c) => c.parts)
    .map((p) => ("text" in p ? p.text : ""))
    .filter(Boolean);

  const modelParts = request.contents
    .filter((c) => c.role === "model")
    .flatMap((c) => c.parts)
    .map((p) => ("text" in p ? p.text : ""))
    .filter(Boolean);

  const userText = userParts.join("\n");

  // Extract system prompt if present
  let systemPrompt: string | undefined;
  const sysInst = request.systemInstruction as { parts?: Array<{ text?: string }> } | undefined;
  if (sysInst?.parts?.[0]?.text) {
    systemPrompt = sysInst.parts[0].text;
  }

  // If Groq is available, use it (14,400 RPD vs Gemini's 20 RPD)
  if (groqClient) {
    try {
      // Build a combined prompt that includes conversation context for Groq
      let fullPrompt = userText;
      if (modelParts.length > 0) {
        // Reconstruct conversation history for Groq
        const history = request.contents
          .map((c) => {
            const text = c.parts.map((p) => ("text" in p ? p.text : "")).join("");
            return `${c.role === "model" ? "assistant" : "user"}: ${text}`;
          })
          .join("\n");
        fullPrompt = history;
      }

      return await generateViaGroq(fullPrompt, systemPrompt, {
        temperature: options.temperature,
        jsonMode: options.jsonMode,
        caller,
      });
    } catch (groqError) {
      console.warn(
        `[LLM] ${caller} | Groq failed, falling back to Gemini:`,
        groqError instanceof Error ? groqError.message : groqError
      );
      // Fall through to Gemini
    }
  }

  // Fallback: use Gemini directly
  return generateViaGemini(request, {
    temperature: options.temperature,
    jsonMode: options.jsonMode,
    caller,
  });
}

/**
 * Generate embeddings locally using a deterministic hash-based approach.
 * Gemini embedding models (text-embedding-004/005) are unavailable on the free tier,
 * so we generate consistent 768-dim vectors locally instead.
 */
export async function embedWithRetry(
  text: string,
  options: { caller?: string } = {}
): Promise<number[]> {
  const caller = options.caller ?? "unknown";
  const startMs = Date.now();

  const embedding = localEmbed(text);
  const elapsedMs = Date.now() - startMs;

  console.log(
    `[LLM] ${caller} | local/hash-embed | OK | ${elapsedMs}ms | dim=${embedding.length}`
  );

  return embedding;
}

/**
 * Simple deterministic text → 768-dim vector.
 * Uses character-level hashing with trigrams for basic semantic sensitivity.
 * Not as good as a real embedding model, but consistent and instant.
 */
function localEmbed(text: string, dims = 768): number[] {
  const vec = new Float64Array(dims);
  const normalized = text.toLowerCase().trim();

  // Hash each trigram into the vector
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash + trigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % dims;
    vec[idx] += hash > 0 ? 1 : -1;
  }

  // L2-normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const result = new Array(dims);
  for (let i = 0; i < dims; i++) result[i] = vec[i] / norm;

  return result;
}

// ── Log on import ──────────────────────────────────────────────────

const primaryProvider = groqClient ? `groq/${GROQ_MODEL}` : `gemini/${GEMINI_MODEL}`;
console.log(
  `[LLM] Client initialized | primary: ${primaryProvider} | embeddings: local/hash | groq: ${groqClient ? "✓" : "✗ (no GROQ_API_KEY)"} | gemini: ${geminiClient ? "✓" : "✗"}`
);

