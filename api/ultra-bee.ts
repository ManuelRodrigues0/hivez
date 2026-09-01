/**
 * Vercel serverless route: POST /api/ultra-bee
 *
 * Secure bridge between the Hivez chat UI and OpenRouter. The OpenRouter API
 * key lives only in server-side environment variables and is never exposed to
 * the browser. The browser sends conversation turns; this route attaches the
 * Ultra Bee system prompt (Hivez knowledge + rules) and calls the provider.
 *
 * Required server-side environment variables:
 *   ULTRA_BEE_OPENROUTER_API_KEY - DEDICATED OpenRouter API key for Ultra Bee only.
 *                                  Intentionally separate from the verification system's
 *                                  OPENROUTER_API_KEY (that key is never read here).
 *                                  Never prefixed with VITE_.
 *   OPENROUTER_MODEL             - optional model override, defaults to "openrouter/free"
 *                                  (not read by the verification system)
 */

declare const process: { env: Record<string, string | undefined> };

import { callOpenRouterChat, ULTRA_BEE_ERROR_MESSAGE } from "../lib/ultra-bee/openrouter.js";
import { buildUltraBeeSystemPrompt } from "../lib/ultra-bee/prompt.js";
import type { UltraBeeTurnMessage } from "../lib/ultra-bee/prompt.js";

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

export const config = { maxDuration: 30 };

const LOG_PREFIX = "[HIVEZ ULTRA BEE]";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const ULTRA_BEE_TIMEOUT_MS = 25_000;
const ULTRA_BEE_MAX_TOKENS = 700;
const ULTRA_BEE_TEMPERATURE = 0.6;
const MAX_REQUEST_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_NAME_CHARS = 80;

interface UltraBeeApiRequestBody {
  uid?: unknown;
  displayName?: unknown;
  username?: unknown;
  messages?: unknown;
}

interface UltraBeeApiSuccess {
  ok: true;
  reply: string;
  model?: string;
}

interface UltraBeeApiFailure {
  ok: false;
  error: string;
  message: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json(failure("method_not_allowed"));
    return;
  }

  const apiKey = readEnv("ULTRA_BEE_OPENROUTER_API_KEY");
  if (!apiKey) {
    console.error(`${LOG_PREFIX} Missing ULTRA_BEE_OPENROUTER_API_KEY`);
    res.status(200).json(failure("missing_api_key"));
    return;
  }

  const request = normalizeRequest(req.body);
  if (!request) {
    res.status(200).json(failure("invalid_request"));
    return;
  }

  const model = readEnv("OPENROUTER_MODEL") || DEFAULT_OPENROUTER_MODEL;
  console.log(`${LOG_PREFIX} Turn started (${request.messages.length} turns, model ${model})`);

  const result = await callOpenRouterChat({
    apiKey,
    model,
    timeoutMs: ULTRA_BEE_TIMEOUT_MS,
    maxTokens: ULTRA_BEE_MAX_TOKENS,
    temperature: ULTRA_BEE_TEMPERATURE,
    messages: [
      {
        role: "system",
        content: buildUltraBeeSystemPrompt({
          displayName: request.displayName,
          username: request.username,
        }),
      },
      ...request.messages.map((message) => ({ role: message.role, content: message.content })),
    ],
  });

  if (!result.ok) {
    console.error(`${LOG_PREFIX} Turn failed: ${result.error}`);
    res.status(200).json(failure(result.error));
    return;
  }

  console.log(`${LOG_PREFIX} Turn completed`);
  const success: UltraBeeApiSuccess = { ok: true, reply: result.text, model: result.model };
  res.status(200).json(success);
}

function normalizeRequest(body: unknown): {
  uid: string;
  displayName?: string;
  username?: string;
  messages: UltraBeeTurnMessage[];
} | null {
  if (!body || typeof body !== "object") return null;

  const data = body as UltraBeeApiRequestBody;
  if (typeof data.uid !== "string" || !data.uid.trim() || data.uid.length > 128) return null;

  const displayName = sanitizeText(data.displayName, MAX_NAME_CHARS) || undefined;
  const username = sanitizeText(data.username, MAX_NAME_CHARS) || undefined;

  if (!Array.isArray(data.messages) || !data.messages.length || data.messages.length > MAX_REQUEST_MESSAGES) {
    return null;
  }

  const messages: UltraBeeTurnMessage[] = [];
  for (const item of data.messages) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { role?: unknown; content?: unknown };
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    if (typeof entry.content !== "string") continue;
    const content = entry.content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content) continue;
    messages.push({ role: entry.role, content });
  }

  // The latest turn must come from the user, otherwise there is nothing to answer.
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return null;

  return { uid: data.uid.trim(), displayName, username, messages };
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function readEnv(key: string): string {
  const value = process.env[key];
  return value && value !== "[SENSITIVE]" ? value : "";
}

function failure(error: string): UltraBeeApiFailure {
  return {
    ok: false,
    error,
    message: ULTRA_BEE_ERROR_MESSAGE,
  };
}
