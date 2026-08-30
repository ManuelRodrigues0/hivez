type ApiRequestBody = {
  categoryId?: unknown;
  categoryTitle?: unknown;
  mimeType?: unknown;
  imageBase64?: unknown;
};

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => { json: (payload: unknown) => void };
};

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

export const config = { maxDuration: 30 };

const GEMINI_LOG_PREFIX = "[HIVEZ GEMINI]";
const GEMINI_TIMEOUT_MS = 20000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const MAX_BASE64_LENGTH = 3_800_000;

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

  // Core decision fields must be valid; non-critical enums get coerced so one
  // odd value (e.g. severity "none") does not discard an otherwise valid check.
  if (typeof candidate.matchesCategory !== "boolean") return null;
  if (typeof candidate.imageRelevant !== "boolean") return null;
  if (typeof candidate.reason !== "string" || !candidate.reason.trim()) return null;

  const confidence =
    typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.min(1, Math.max(0, candidate.confidence))
      : 0;
  const imageQuality = imageQualityValues.includes(candidate.imageQuality as GeminiImageQuality)
    ? (candidate.imageQuality as GeminiImageQuality)
    : "fair";
  const severity = severityValues.includes(candidate.severity as GeminiSeverity)
    ? (candidate.severity as GeminiSeverity)
    : "unknown";
  const detectedObjects = Array.isArray(candidate.detectedObjects)
    ? candidate.detectedObjects.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];

  return {
    matchesCategory: candidate.matchesCategory,
    imageRelevant: candidate.imageRelevant,
    imageQuality,
    detectedObjects,
    confidence,
    severity,
    reason: candidate.reason.slice(0, 400),
  };
}

async function fetchGeminiOnce(apiKey: string, data: ApiRequestBody): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  return fetch(
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
  ).finally(() => clearTimeout(timeout));
}

// Gemini occasionally answers 503 while under load; retry once before failing.
async function callGemini(apiKey: string, data: ApiRequestBody): Promise<Response> {
  let response = await fetchGeminiOnce(apiKey, data);
  if (response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    response = await fetchGeminiOnce(apiKey, data);
  }
  return response;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json(geminiFailure("api_request_failed", "Method not allowed"));
    return;
  }

  logGeminiStarted();

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    res.status(200).json(geminiFailure("missing_api_key", "Missing API key"));
    return;
  }

  const data = (req.body ?? null) as ApiRequestBody | null;

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
    res.status(200).json(geminiFailure("invalid_response", "Invalid verification request"));
    return;
  }

  if (data.imageBase64.length > MAX_BASE64_LENGTH) {
    res.status(200).json(geminiFailure("invalid_response", "Image payload too large"));
    return;
  }

  try {
    const response = await callGemini(apiKey, data);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        res.status(200).json(geminiFailure("invalid_api_key", "Invalid API key"));
        return;
      }
      if (response.status === 429) {
        res.status(200).json(geminiFailure("rate_limited", "Rate limit"));
        return;
      }
      if (response.status === 503 || response.status === 504) {
        res.status(200).json(geminiFailure("gemini_unavailable", "Gemini unavailable"));
        return;
      }
      res.status(200).json(geminiFailure("api_request_failed", `API request failure (${response.status})`));
      return;
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
      res.status(200).json(geminiFailure("invalid_response", "Invalid/malformed response"));
      return;
    }

    const result = validateGeminiResult(parseGeminiJson(text));
    if (!result) {
      res.status(200).json(geminiFailure("invalid_response", "Invalid/malformed response"));
      return;
    }

    logGeminiSuccess();
    res.status(200).json({ ok: true, result } satisfies GeminiSuccessResult);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      res.status(200).json(geminiFailure("timeout", "Timeout"));
      return;
    }

    if (error instanceof SyntaxError) {
      res.status(200).json(geminiFailure("invalid_response", "Invalid/malformed response"));
      return;
    }

    res.status(200).json(geminiFailure("api_request_failed", "API request failure"));
  }
}
