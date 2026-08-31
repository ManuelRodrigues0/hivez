import { getCategoryContext, type ProviderConfig, verificationThresholds } from "./config.js";
import type { NormalizedProviderResult, VerificationRequest } from "./types.js";

type ChatEndpoint = "gemini" | "xai" | "nvidia" | "openrouter";

export async function callProvider(config: ProviderConfig, request: VerificationRequest): Promise<NormalizedProviderResult> {
  const apiKey = config.envKey ? process.env[config.envKey] || "" : "";
  if (!config.enabled) return skipped(config, "disabled", "Provider disabled by configuration.");
  if (!config.supportsImage) return skipped(config, "unsupported", "Model is not configured as supporting image verification.");
  if (!apiKey) return skipped(config, "missing_config", `Missing ${config.envKey}.`);
  if (!request.mimeType.startsWith("image/")) return skipped(config, "unsupported", "Provider image verification supports images only.");

  console.log(`[Verification] ${config.provider} started`);

  try {
    const payload = await withTimeout(callEndpoint(config.endpoint, config, request, apiKey), verificationThresholds.providerTimeoutMs);
    const normalized = normalizeProviderText(config, payload.text, payload.raw);
    console.log(`[Verification] ${config.provider} completed`);
    return normalized;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Provider request failed.";
    console.error(`[Verification] ${config.provider} failed: ${safeReason(reason)}`);
    return {
      provider: config.provider,
      providerGroup: config.providerGroup,
      model: config.model,
      status: "failed",
      success: false,
      reason: safeReason(reason),
    };
  }
}

async function callEndpoint(endpoint: ChatEndpoint, config: ProviderConfig, request: VerificationRequest, apiKey: string) {
  if (endpoint === "gemini") return callGemini(config, request, apiKey);

  const url =
    endpoint === "xai"
      ? "https://api.x.ai/v1/chat/completions"
      : endpoint === "nvidia"
      ? "https://integrate.api.nvidia.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(endpoint === "openrouter" ? { "HTTP-Referer": "https://www.hivez.in", "X-Title": "Hivez" } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      max_tokens: 450,
      ...(endpoint === "xai" ? { store: false } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildVerificationPrompt(request) },
            {
              type: "image_url",
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`API request failure (${response.status})`);
  const raw = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = raw.choices?.[0]?.message?.content;
  if (!text) throw new Error("Invalid provider response.");
  return { text, raw };
}

async function callGemini(config: ProviderConfig, request: VerificationRequest, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: buildVerificationPrompt(request) },
            { inline_data: { mime_type: request.mimeType, data: request.imageBase64 } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`API request failure (${response.status})`);
  const raw = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = raw.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (!text) throw new Error("Invalid provider response.");
  return { text, raw };
}

function buildVerificationPrompt(request: VerificationRequest) {
  const context = getCategoryContext(request.categoryId, request.categoryTitle, request.categoryDescription);
  return [
    "Analyze this image for a Hivez local issue report.",
    `Selected category: ${context.title}.`,
    `Category description: ${context.description}.`,
    context.expectedObjects.length ? `Expected visible evidence: ${context.expectedObjects.join(", ")}.` : "",
    context.prompt,
    "Determine visual evidence only. Do not claim the report is definitely true.",
    "Return only JSON with fields: relevant boolean, issueDetected boolean, confidence number from 0 to 100, imageQuality one of good/acceptable/poor, visibleEvidence string, reason string.",
  ].filter(Boolean).join(" ");
}

function normalizeProviderText(config: ProviderConfig, text: string, raw: unknown): NormalizedProviderResult {
  const parsed = parseJson(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON response.");
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.relevant !== "boolean") throw new Error("Missing relevant decision.");
  if (typeof candidate.issueDetected !== "boolean") throw new Error("Missing issueDetected decision.");

  const confidence = normalizeConfidence(candidate.confidence);
  const imageQuality = normalizeQuality(candidate.imageQuality);
  const reason = typeof candidate.reason === "string" && candidate.reason.trim() ? candidate.reason.slice(0, 500) : "No reason provided.";
  const visibleEvidence = typeof candidate.visibleEvidence === "string" ? candidate.visibleEvidence.slice(0, 500) : "";

  return {
    provider: config.provider,
    providerGroup: config.providerGroup,
    model: config.model,
    status: "completed",
    success: true,
    relevant: candidate.relevant,
    issueDetected: candidate.issueDetected,
    confidence,
    imageQuality,
    visibleEvidence,
    reason,
    rawResponse: process.env.STORE_PROVIDER_RAW_RESPONSES === "true" ? raw : undefined,
  };
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return JSON.parse(fenced[1]);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return JSON.parse(first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed);
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function normalizeQuality(value: unknown): "good" | "acceptable" | "poor" {
  return value === "good" || value === "acceptable" || value === "poor" ? value : "acceptable";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function skipped(config: ProviderConfig, status: NormalizedProviderResult["status"], reason: string): NormalizedProviderResult {
  return {
    provider: config.provider,
    providerGroup: config.providerGroup,
    model: config.model,
    status,
    success: false,
    reason,
  };
}

function safeReason(reason: string) {
  return reason.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").slice(0, 300);
}
