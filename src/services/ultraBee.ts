/**
 * Client service for Ultra Bee conversations.
 *
 * The browser never talks to OpenRouter directly and never sees the API key:
 * it posts conversation turns to the Hivez backend route (/api/ultra-bee),
 * which attaches the system prompt, calls OpenRouter and returns the reply.
 */

export interface UltraBeeTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UltraBeeRequestContext {
  uid: string;
  displayName?: string;
  username?: string;
}

export interface UltraBeeReplySuccess {
  ok: true;
  reply: string;
}

export interface UltraBeeReplyFailure {
  ok: false;
  error: string;
  message: string;
}

export type UltraBeeReply = UltraBeeReplySuccess | UltraBeeReplyFailure;

const ULTRA_BEE_ENDPOINT = "/api/ultra-bee";
/** Client timeout sits above the server function timeout (25s) + network slack. */
const ULTRA_BEE_CLIENT_TIMEOUT_MS = 32_000;

export const ULTRA_BEE_FALLBACK_ERROR =
  "Sorry, Ultra Bee couldn't respond right now. Please try again.";

interface UltraBeeApiPayload {
  ok?: unknown;
  reply?: unknown;
  error?: unknown;
  message?: unknown;
}

export async function requestUltraBeeReply(input: {
  context: UltraBeeRequestContext;
  history: UltraBeeTurnMessage[];
}): Promise<UltraBeeReply> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ULTRA_BEE_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(ULTRA_BEE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        uid: input.context.uid,
        displayName: input.context.displayName,
        username: input.context.username,
        messages: input.history,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `http_${response.status}`, message: ULTRA_BEE_FALLBACK_ERROR };
    }

    const data = (await response.json()) as UltraBeeApiPayload;

    if (data.ok === true && typeof data.reply === "string" && data.reply.trim()) {
      return { ok: true, reply: data.reply.trim() };
    }

    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "invalid_response",
      message: typeof data.message === "string" ? data.message : ULTRA_BEE_FALLBACK_ERROR,
    };
  } catch (error) {
    console.error("Ultra Bee request failed:", error);
    return { ok: false, error: "network_error", message: ULTRA_BEE_FALLBACK_ERROR };
  } finally {
    window.clearTimeout(timeout);
  }
}
