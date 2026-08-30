import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret("GEMINI_API_KEY");

type GeminiImageQuality = "poor" | "fair" | "good";
type GeminiSeverity = "low" | "medium" | "high" | "unknown";

interface GeminiVerificationResult {
  matchesCategory: boolean;
  imageRelevant: boolean;
  imageQuality: GeminiImageQuality;
  detectedObjects: string[];
  confidence: number;
  severity: GeminiSeverity;
  reason: string;
}

interface GeminiFailureResult {
  ok: false;
  error:
    | "missing_api_key"
    | "invalid_api_key"
    | "api_request_failed"
    | "timeout"
    | "rate_limited"
    | "gemini_unavailable"
    | "invalid_response";
  message: string;
}

interface GeminiSuccessResult {
  ok: true;
  result: GeminiVerificationResult;
}

const GEMINI_LOG_PREFIX = "[HIVEZ GEMINI]";
const GEMINI_TIMEOUT_MS = 20000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function logGeminiStarted() {
  console.log(`${GEMINI_LOG_PREFIX} Verification started`);
}

function logGeminiSuccess() {
  console.log(`${GEMINI_LOG_PREFIX} Verification successful`);
}

function logGeminiFailure(reason: string) {
  console.error(`${GEMINI_LOG_PREFIX} Verification failed`);
  console.error(`Reason: ${reason}`);
}

function geminiFailure(
  error: GeminiFailureResult["error"],
  reason: string
): GeminiFailureResult {
  logGeminiFailure(reason);
  return {
    ok: false,
    error,
    message: "AI verification is currently unavailable. Please try again or continue for review.",
  };
}

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function validateGeminiResult(value: unknown): GeminiVerificationResult | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<GeminiVerificationResult>;
  const imageQualityValues: GeminiImageQuality[] = ["poor", "fair", "good"];
  const severityValues: GeminiSeverity[] = ["low", "medium", "high", "unknown"];

  if (typeof candidate.matchesCategory !== "boolean") return null;
  if (typeof candidate.imageRelevant !== "boolean") return null;
  if (!imageQualityValues.includes(candidate.imageQuality as GeminiImageQuality)) return null;
  if (!Array.isArray(candidate.detectedObjects)) return null;
  if (!candidate.detectedObjects.every((item) => typeof item === "string")) return null;
  if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) return null;
  if (!severityValues.includes(candidate.severity as GeminiSeverity)) return null;
  if (typeof candidate.reason !== "string" || !candidate.reason.trim()) return null;

  return {
    matchesCategory: candidate.matchesCategory,
    imageRelevant: candidate.imageRelevant,
    imageQuality: candidate.imageQuality as GeminiImageQuality,
    detectedObjects: candidate.detectedObjects.slice(0, 12),
    confidence: candidate.confidence,
    severity: candidate.severity as GeminiSeverity,
    reason: candidate.reason.slice(0, 400),
  };
}

function getGeminiApiKey(): string {
  try {
    return geminiApiKey.value() || process.env.GEMINI_API_KEY || "";
  } catch {
    return process.env.GEMINI_API_KEY || "";
  }
}

async function sendToUser(
  uid: string,
  title: string,
  body: string,
  link: string
) {
  const tokensSnapshot = await db.collection("users").doc(uid).collection("pushTokens").get();
  const tokens = tokensSnapshot.docs.map((doc) => doc.id);

  if (!tokens.length) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    webpush: {
      fcmOptions: {
        link,
      },
      notification: {
        icon: "/favicon.svg",
        badge: "/favicon.svg",
      },
    },
    data: {
      title,
      body,
      link,
    },
  });

  await Promise.all(
    response.responses.map(async (result, index) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
          await tokensSnapshot.docs[index].ref.delete();
        }
      }
    })
  );
}

export const pushSocialNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    if (!notification || notification.type === "message") return;

    const actorName = notification.actorDisplayName || notification.actorUsername || "Someone";
    const title =
      notification.type === "comment"
        ? `${actorName} commented on your post`
        : notification.type === "follow"
        ? `${actorName} followed you`
        : `${actorName} liked your post`;

    await sendToUser(
      notification.recipientId,
      title,
      notification.type === "follow" ? `@${notification.actorUsername}` : notification.text || "",
      notification.link || "/notifications"
    );
  }
);

export const pushChatMessage = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const chatSnap = await db.collection("chats").doc(event.params.chatId).get();
    const chat = chatSnap.data();
    const recipientId = chat?.participants?.find((uid: string) => uid !== message.senderId);
    if (!recipientId) return;

    const sender = chat?.participantProfiles?.[message.senderId];
    const senderName = sender?.displayName || sender?.username || "Someone";

    await sendToUser(
      recipientId,
      `${senderName} sent you a message`,
      message.text || "New message",
      "/chats"
    );
  }
);

export const verifyReportWithGemini = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 30, memory: "512MiB" },
  async (request): Promise<GeminiSuccessResult | GeminiFailureResult> => {
    logGeminiStarted();

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return geminiFailure("missing_api_key", "Missing API key");
    }

    const data = request.data as {
      categoryId?: unknown;
      categoryTitle?: unknown;
      mimeType?: unknown;
      imageBase64?: unknown;
    } | null;

    if (
      typeof data?.categoryId !== "string" ||
      typeof data?.categoryTitle !== "string" ||
      typeof data?.mimeType !== "string" ||
      typeof data?.imageBase64 !== "string" ||
      !data.categoryId.trim() ||
      !data.categoryTitle.trim() ||
      !data.mimeType.startsWith("image/") ||
      !data.imageBase64.trim()
    ) {
      return geminiFailure("invalid_response", "Invalid verification request");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.1,
              response_mime_type: "application/json",
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "Analyze this image for a Hivez local issue report. " +
                      `Selected category: ${data.categoryTitle}. Category ID: ${data.categoryId}. ` +
                      "Return only JSON with these fields: matchesCategory boolean, imageRelevant boolean, " +
                      "imageQuality one of poor/fair/good, detectedObjects string array, confidence number from 0 to 1, " +
                      "severity one of low/medium/high/unknown, reason string. " +
                      "Do not identify a specific person. Do not claim the report is true; only assess visible relevance and quality.",
                  },
                  {
                    inline_data: {
                      mime_type: data.mimeType,
                      data: data.imageBase64,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return geminiFailure("invalid_api_key", "Invalid API key");
        }
        if (response.status === 429) {
          return geminiFailure("rate_limited", "Rate limit");
        }
        if (response.status === 503 || response.status === 504) {
          return geminiFailure("gemini_unavailable", "Gemini unavailable");
        }
        return geminiFailure("api_request_failed", `API request failure (${response.status})`);
      }

      const payload = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
      if (!text) {
        return geminiFailure("invalid_response", "Invalid/malformed response");
      }

      const result = validateGeminiResult(parseGeminiJson(text));
      if (!result) {
        return geminiFailure("invalid_response", "Invalid/malformed response");
      }

      logGeminiSuccess();
      return { ok: true, result };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === "AbortError") {
        return geminiFailure("timeout", "Timeout");
      }

      if (error instanceof SyntaxError) {
        return geminiFailure("invalid_response", "Invalid/malformed response");
      }

      return geminiFailure("api_request_failed", "API request failure");
    }
  }
);
