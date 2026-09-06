/**
 * Centralized OmniRoute connection layer (server-side only).
 *
 * OmniRoute is Hivez's AI router exposing an OpenAI-compatible API. This
 * module is the SINGLE place in the codebase that knows about OmniRoute:
 * base URL, authentication, timeouts, response normalization, and failure
 * handling. Existing AI systems (verification providers, Ultra Bee,
 * Teachable Machine, Gemini on-call functions) intentionally do NOT use
 * this module - they keep their own providers.
 *
 * Configuration (server-side environment variables only, never VITE_):
 *   OMNIROUTE_BASE_URL - OpenAI-compatible base URL,
 *                        e.g. http://localhost:20128/v1 or https://remote-host/v1
 *   OMNIROUTE_API_KEY  - server-side secret sent as Bearer token. Never exposed
 *                        to the browser, logs, or API responses.
 *   OMNIROUTE_MODEL    - default model id. OmniRoute itself routes the model to
 *                        a provider, so Hivez never hardcodes one. Defaults to "auto".
 *
 * Moving OmniRoute to a remote host only requires changing OMNIROUTE_BASE_URL;
 * no application code changes.
 */

declare const process: { env: Record<string, string | undefined> };

export const OMNIROUTE_DEFAULT_BASE_URL = "http://localhost:20128/v1";
export const OMNIROUTE_DEFAULT_MODEL = "auto";
export const OMNIROUTE_LOG_PREFIX = "[HIVEZ OMNIROUTE]";
export const OMNIROUTE_DEFAULT_TIMEOUT_MS = 25_000;
/** Vercel CLI redacts secret values in pulled env files with this literal. */
const SENSITIVE_PLACEHOLDER = "[SENSITIVE]";

export type OmniRouteErrorKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "timeout"
  | "unreachable"
  | "provider_unavailable"
  | "invalid_response"
  | "api_request_failed";

export interface OmniRouteConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** True when OMNIROUTE_API_KEY is present in the server environment. */
  isConfigured: boolean;
}

export type OmniRouteChatRole = "system" | "user" | "assistant";

/** OpenAI-compatible content part, used for image understanding features. */
export type OmniRouteContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OmniRouteChatMessage {
  role: OmniRouteChatRole;
  /** Plain text, or content parts when a feature needs image understanding. */
  content: string | OmniRouteContentPart[];
}

export interface OmniRouteChatOptions {
  messages: OmniRouteChatMessage[];
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface OmniRouteChatSuccess {
  ok: true;
  text: string;
  model: string;
}

export interface OmniRouteFailure {
  ok: false;
  error: OmniRouteErrorKind;
  message: string;
}

export type OmniRouteChatResponse = OmniRouteChatSuccess | OmniRouteFailure;

export interface OmniRouteModelsSuccess {
  ok: true;
  models: string[];
}

export type OmniRouteModelsResponse = OmniRouteModelsSuccess | OmniRouteFailure;

/** One secret-free check result inside a connection report. */
export interface OmniRouteCheckResult {
  ok: boolean;
  detail: string;
}

export interface OmniRouteConnectionReport {
  ok: boolean;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  checks: {
    reachable: OmniRouteCheckResult;
    authentication: OmniRouteCheckResult;
    modelsEndpoint: OmniRouteCheckResult;
    completion: OmniRouteCheckResult;
  };
  /** Model ids advertised by OmniRoute (names only, truncated). */
  models: string[];
}

const FAILURE_MESSAGES: Record<OmniRouteErrorKind, string> = {
  missing_api_key: "OmniRoute is not configured (missing API key).",
  invalid_api_key: "OmniRoute rejected the credentials.",
  rate_limited: "OmniRoute is rate limiting requests.",
  timeout: "OmniRoute did not respond in time.",
  unreachable: "OmniRoute server is unreachable.",
  provider_unavailable: "OmniRoute is temporarily unavailable.",
  invalid_response: "OmniRoute returned an unexpected response.",
  api_request_failed: "OmniRoute request failed.",
};

function failure(error: OmniRouteErrorKind): OmniRouteFailure {
  return { ok: false, error, message: FAILURE_MESSAGES[error] };
}

function readEnv(key: string): string {
  const value = process.env[key];
  return value && value !== SENSITIVE_PLACEHOLDER ? value : "";
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Reads the OmniRoute configuration from the server environment. Reads happen
 * per call so serverless invocations always see fresh configuration and tests
 * can override the environment.
 */
export function getOmniRouteConfig(): OmniRouteConfig {
  const apiKey = readEnv("OMNIROUTE_API_KEY");
  return {
    baseUrl: normalizeBaseUrl(readEnv("OMNIROUTE_BASE_URL") || OMNIROUTE_DEFAULT_BASE_URL),
    apiKey,
    model: readEnv("OMNIROUTE_MODEL") || OMNIROUTE_DEFAULT_MODEL,
    isConfigured: Boolean(apiKey),
  };
}

function mapHttpStatus(status: number): OmniRouteErrorKind {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status === 500 || status === 502 || status === 503) return "provider_unavailable";
  return "api_request_failed";
}

function classifyFetchError(error: unknown): OmniRouteErrorKind {
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  // fetch() network failures (connection refused, DNS, TLS) surface as TypeError.
  if (error instanceof TypeError) return "unreachable";
  return "api_request_failed";
}
interface OpenAiChatPayload {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface OpenAiModelsPayload {
  data?: Array<{ id?: unknown }>;
}

/**
 * Sends an authenticated OpenAI-compatible chat completion request to
 * OmniRoute. The API key always comes from the server environment; callers
 * cannot (and must not) pass one in.
 */
export async function callOmniRouteChat(options: OmniRouteChatOptions): Promise<OmniRouteChatResponse> {
  const config = getOmniRouteConfig();
  if (!config.apiKey) {
    return failure("missing_api_key");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? OMNIROUTE_DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model || config.model,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 700,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      return failure(mapHttpStatus(response.status));
    }

    let payload: OpenAiChatPayload;
    try {
      payload = (await response.json()) as OpenAiChatPayload;
    } catch {
      return failure("invalid_response");
    }
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return failure("invalid_response");
    }

    return {
      ok: true,
      text: text.trim(),
      model: typeof payload.model === "string" ? payload.model : options.model || config.model,
    };
  } catch (error) {
    return failure(classifyFetchError(error));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches the model list from OmniRoute's OpenAI-compatible /models endpoint.
 * Fails with missing_api_key without a network call when no key is configured.
 */
export async function listOmniRouteModels(options?: { timeoutMs?: number }): Promise<OmniRouteModelsResponse> {
  const config = getOmniRouteConfig();
  if (!config.apiKey) {
    return failure("missing_api_key");
  }

  const result = await probeOmniRouteModels(options?.timeoutMs ?? OMNIROUTE_DEFAULT_TIMEOUT_MS);
  if (result.ok) {
    return { ok: true, models: result.models };
  }
  return failure(result.error);
}

type ModelsProbeResult =
  | { ok: true; status: number; models: string[] }
  | { ok: false; status: number | null; error: OmniRouteErrorKind };

/**
 * Internal probe that always performs the network call (even without a key)
 * so the connection test can distinguish "server down" from "bad credentials".
 */
async function probeOmniRouteModels(timeoutMs: number): Promise<ModelsProbeResult> {
  const config = getOmniRouteConfig();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: mapHttpStatus(response.status) };
    }

    let payload: OpenAiModelsPayload;
    try {
      payload = (await response.json()) as OpenAiModelsPayload;
    } catch {
      return { ok: false, status: response.status, error: "invalid_response" };
    }
    const ids = Array.isArray(payload.data)
      ? payload.data.filter((entry): entry is { id: string } => typeof entry?.id === "string").map((entry) => entry.id)
      : [];
    return { ok: true, status: response.status, models: ids };
  } catch (error) {
    return { ok: false, status: null, error: classifyFetchError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const COMPLETION_PING_PROMPT = "Reply with exactly one word: pong";
const MAX_REPORT_MODELS = 20;

/**
 * Verifies the full OmniRoute connection path and returns a structured,
 * secret-free report:
 *   1. reachable       - the OmniRoute server answers HTTP at all
 *   2. authentication  - the configured API key is accepted
 *   3. modelsEndpoint  - the OpenAI-compatible /models endpoint responds
 *   4. completion      - a basic chat completion round-trip succeeds
 *
 * Never includes the API key, Authorization headers, or any other secret in
 * the returned report.
 */
export async function testOmniRouteConnection(options?: {
  modelsTimeoutMs?: number;
  completionTimeoutMs?: number;
}): Promise<OmniRouteConnectionReport> {
  const config = getOmniRouteConfig();

  const probe = await probeOmniRouteModels(options?.modelsTimeoutMs ?? 10_000);
  const reachable: OmniRouteCheckResult = probe.ok
    ? { ok: true, detail: `OmniRoute server responded (HTTP ${probe.status}).` }
    : probe.status === null
      ? { ok: false, detail: `No HTTP response from ${config.baseUrl} (${probe.error}).` }
      : { ok: true, detail: `OmniRoute server responded (HTTP ${probe.status}).` };

  const authentication: OmniRouteCheckResult = probe.ok
    ? { ok: true, detail: "API key accepted." }
    : probe.status === 401 || probe.status === 403
      ? { ok: false, detail: `Credentials rejected (HTTP ${probe.status}).` }
      : probe.error === "rate_limited"
        ? { ok: false, detail: "Could not verify credentials (rate limited)." }
        : { ok: false, detail: `Could not verify credentials (${probe.error}).` };

  const modelsEndpoint: OmniRouteCheckResult = probe.ok
    ? { ok: true, detail: `/models responded with ${probe.models.length} model(s).` }
    : { ok: false, detail: `/models did not respond correctly (${probe.error}).` };

  let completion: OmniRouteCheckResult;
  let models: string[];
  if (!reachable.ok) {
    completion = { ok: false, detail: "Skipped: OmniRoute server is unreachable." };
    models = [];
  } else {
    const chat = await callOmniRouteChat({
      messages: [{ role: "user", content: COMPLETION_PING_PROMPT }],
      maxTokens: 16,
      temperature: 0,
      timeoutMs: options?.completionTimeoutMs ?? 20_000,
    });
    completion = chat.ok
      ? { ok: true, detail: `Completion succeeded via model ${chat.model}.` }
      : { ok: false, detail: `Completion failed (${chat.error}).` };
    models = probe.ok ? probe.models.slice(0, MAX_REPORT_MODELS) : [];
  }

  const ok = reachable.ok && authentication.ok && modelsEndpoint.ok && completion.ok;
  return {
    ok,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: config.isConfigured,
    checks: { reachable, authentication, modelsEndpoint, completion },
    models,
  };
}
