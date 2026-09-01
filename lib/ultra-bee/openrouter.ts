/**
 * AI provider layer for Ultra Bee.
 *
 * Ultra Bee currently talks to OpenRouter (chat completions). Keeping the
 * provider call isolated here means a second provider (Gemini direct, etc.)
 * can be added later without touching the chat UI or the API route contract.
 */

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_HTTP_REFERER = "https://www.hivez.in";
export const OPENROUTER_APP_TITLE = "Hivez";

export type AiChatRole = "system" | "user" | "assistant";

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export type AiProviderErrorKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "timeout"
  | "provider_unavailable"
  | "invalid_response"
  | "api_request_failed";

export interface AiProviderSuccess {
  ok: true;
  text: string;
  model: string;
}

export interface AiProviderFailure {
  ok: false;
  error: AiProviderErrorKind;
  message: string;
}

export type AiProviderResponse = AiProviderSuccess | AiProviderFailure;

export interface AiProviderChatOptions {
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export const ULTRA_BEE_ERROR_MESSAGE = "Sorry, Ultra Bee couldn't respond right now. Please try again.";

interface OpenRouterChatPayload {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export async function callOpenRouterChat(options: AiProviderChatOptions): Promise<AiProviderResponse> {
  if (!options.apiKey) {
    return { ok: false, error: "missing_api_key", message: ULTRA_BEE_ERROR_MESSAGE };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_HTTP_REFERER,
        "X-Title": OPENROUTER_APP_TITLE,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 700,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      return { ok: false, ...mapHttpStatus(response.status) };
    }

    const payload = (await response.json()) as OpenRouterChatPayload;
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "invalid_response", message: ULTRA_BEE_ERROR_MESSAGE };
    }

    return {
      ok: true,
      text: text.trim(),
      model: typeof payload.model === "string" ? payload.model : options.model,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "timeout", message: ULTRA_BEE_ERROR_MESSAGE };
    }
    return { ok: false, error: "api_request_failed", message: ULTRA_BEE_ERROR_MESSAGE };
  } finally {
    clearTimeout(timeout);
  }
}

function mapHttpStatus(status: number): { error: AiProviderErrorKind; message: string } {
  if (status === 401 || status === 403) {
    return { error: "invalid_api_key", message: ULTRA_BEE_ERROR_MESSAGE };
  }
  if (status === 429) {
    return { error: "rate_limited", message: ULTRA_BEE_ERROR_MESSAGE };
  }
  if (status === 408 || status === 504) {
    return { error: "timeout", message: ULTRA_BEE_ERROR_MESSAGE };
  }
  if (status === 500 || status === 502 || status === 503) {
    return { error: "provider_unavailable", message: ULTRA_BEE_ERROR_MESSAGE };
  }
  return { error: "api_request_failed", message: ULTRA_BEE_ERROR_MESSAGE };
}
