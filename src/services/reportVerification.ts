import { getReportCategory, type VerificationLevel, type VerificationStatus } from "@/config/reportCategories";
import { verifyWithLocalModel, type LocalModelResult } from "@/services/teachableMachineService";

export interface GeminiResult {
  enabled: boolean;
  matchesCategory?: boolean;
  imageRelevant?: boolean;
  imageQuality?: "poor" | "fair" | "good";
  detectedObjects?: string[];
  confidence?: number;
  severity?: "low" | "medium" | "high" | "unknown";
  reason?: string;
  error?: string;
}

export type FinalVerificationDecision = "VERIFIED" | "UNCERTAIN" | "REJECTED";
export type ProviderStatus = "completed" | "failed" | "skipped" | "disabled" | "missing_config" | "unsupported";

export interface ProviderVerificationResult {
  provider: string;
  providerGroup: string;
  model: string;
  status: ProviderStatus;
  success: boolean;
  relevant?: boolean;
  issueDetected?: boolean;
  confidence?: number;
  imageQuality?: "good" | "acceptable" | "poor";
  visibleEvidence?: string;
  reason: string;
}

export interface ConsensusSummary {
  finalDecision: FinalVerificationDecision;
  verificationScore: number;
  agreement: number;
  successfulChecks: number;
  independentGroups: number;
  relevantCount: number;
  notRelevantCount: number;
  issueDetectedCount: number;
  strongContradiction: boolean;
  earlyConsensusReached: boolean;
  reason: string;
}

export interface ReportVerificationResult {
  status: VerificationStatus;
  finalDecision: FinalVerificationDecision;
  localModel?: LocalModelResult;
  gemini: GeminiResult;
  providers: ProviderVerificationResult[];
  consensus?: ConsensusSummary;
  verificationScore?: number;
  agreement?: number;
  verifiedAt?: string;
  finalClassification?: VerificationLevel;
  message: string;
}

type CloudVerificationApiResponse =
  | {
      ok: true;
      providers: ProviderVerificationResult[];
      finalDecision: FinalVerificationDecision;
      verificationScore: number;
      agreement: number;
      consensus: ConsensusSummary;
      verifiedAt: string;
    }
  | { ok: false; error: string };

export async function verifyReportEvidence(categoryId: string, file: File | null): Promise<ReportVerificationResult> {
  const category = getReportCategory(categoryId);
  if (!category) {
    return {
      status: "requires_review",
      finalDecision: "UNCERTAIN",
      gemini: { enabled: false },
      providers: [],
      message: "This report category needs review.",
    };
  }

  if (!file || !file.type.startsWith("image/")) {
    return {
      status: "pending",
      finalDecision: "UNCERTAIN",
      gemini: { enabled: false },
      providers: [],
      message: category.requiresMedia ? "Add media to run an AI check." : "This report can continue without image AI.",
    };
  }

  console.info(`[Verification] Category selected: ${category.title}`);
  console.info(`[Verification] Image received: ${file.type}, ${Math.round(file.size / 1024)} KB`);
  console.info("[Verification] Local model started");
  const localModel = await verifyWithLocalModel(categoryId, file);
  console.info(
    `[Verification] Local model completed: ${localModel.topLabel || "unavailable"} (${formatLogConfidence(localModel.topConfidence ?? localModel.confidence)})`,
  );
  if (localModel.predictions.length > 0) {
    console.groupCollapsed("[Verification] Local model scores (all classes)");
    console.table(
      localModel.predictions.map((prediction) => ({
        class: prediction.label,
        confidence: `${prediction.confidencePercent}%`,
      })),
    );
    console.info(
      `[Verification] Top class: ${localModel.topLabel ?? localModel.predictedClass ?? "n/a"} | type: ${localModel.topClassType ?? "n/a"} | passed: ${localModel.passed} | level: ${localModel.level ?? "n/a"}`,
    );
    console.groupEnd();
  }
  console.info("[Verification] Cloud verification request started");
  const cloud = await verifyWithCloudProviders(categoryId, category.title, category.description, file, localModel);

  if (!cloud.ok) {
    console.warn(`[Verification] Cloud verification failed: ${cloud.error}`);
    return {
      status: "requires_review",
      finalDecision: "UNCERTAIN",
      localModel,
      gemini: { enabled: false, error: cloud.error },
      providers: [],
      finalClassification: localModel.level,
      message: "AI verification is unavailable right now. Please try again with another image.",
    };
  }

  const geminiProvider = cloud.providers.find((provider) => provider.provider === "gemini");
  const gemini = providerToGemini(geminiProvider);
  const status = cloud.finalDecision === "VERIFIED" ? "ai_checked" : "requires_review";
  console.info(
    `[Verification] Cloud verification completed: ${cloud.finalDecision}, checks=${cloud.consensus.successfulChecks}, agreement=${Math.round(cloud.agreement * 100)}%`,
  );

  console.groupCollapsed("[Verification] ===== AI SCORE REPORT =====");
  console.info(`[Verification] Report category: ${category.title} (${categoryId})`);

  console.info("[Verification] — 1. Cloud AI providers (per-provider scores) —");
  console.table(
    cloud.providers.map((provider) => ({
      provider: provider.provider,
      group: provider.providerGroup,
      model: provider.model,
      status: provider.status,
      success: provider.success,
      relevant: provider.relevant ?? "n/a",
      issueDetected: provider.issueDetected ?? "n/a",
      confidence: typeof provider.confidence === "number" ? `${Math.round(provider.confidence * 100)}%` : "n/a",
      imageQuality: provider.imageQuality ?? "n/a",
      reason: provider.reason,
    })),
  );

  console.info("[Verification] — 2. Consensus (how the scores combine) —");
  console.info(
    `[Verification] Final decision: ${cloud.consensus.finalDecision} | verificationScore: ${Math.round(cloud.verificationScore * 100)}% | agreement: ${Math.round(cloud.agreement * 100)}%`,
  );
  console.info(
    `[Verification] Successful checks: ${cloud.consensus.successfulChecks} | independent groups: ${cloud.consensus.independentGroups} | relevant: ${cloud.consensus.relevantCount} | not relevant: ${cloud.consensus.notRelevantCount} | issue detected: ${cloud.consensus.issueDetectedCount}`,
  );
  console.info(
    `[Verification] Strong contradiction: ${cloud.consensus.strongContradiction} | early consensus reached: ${cloud.consensus.earlyConsensusReached}`,
  );
  console.info(`[Verification] Consensus reason: ${cloud.consensus.reason}`);

  console.info("[Verification] — 3. How this post is scored —");
  console.info(
    `[Verification] Post verification status: ${status}${status === "ai_checked" ? " (post badge: AI-verified)" : " (post flagged: needs manual review)"}`,
  );
  console.info(
    `[Verification] Post final classification: ${localModel.level ?? "n/a"} | shown to user: ${messageForDecision(cloud.finalDecision)}`,
  );
  console.groupEnd();

  return {
    status,
    finalDecision: cloud.finalDecision,
    localModel,
    gemini,
    providers: cloud.providers,
    consensus: cloud.consensus,
    verificationScore: cloud.verificationScore,
    agreement: cloud.agreement,
    verifiedAt: cloud.verifiedAt,
    finalClassification: localModel.level,
    message: messageForDecision(cloud.finalDecision),
  };
}

async function verifyWithCloudProviders(
  categoryId: string,
  categoryTitle: string,
  categoryDescription: string,
  file: File,
  localModelResult: LocalModelResult,
): Promise<CloudVerificationApiResponse> {
  try {
    console.info("[Verification] Preparing image payload for server-side AI checks");
    const { imageBase64 } = await compressImageForGemini(file);
    console.info("[Verification] Sending image to server-side AI verification");
    const response = await fetch("/api/verify-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId,
        categoryTitle,
        categoryDescription,
        mimeType: "image/jpeg",
        imageBase64,
        localModelResult,
      }),
    });

    if (!response.ok) {
      console.warn(`[Verification] Server verification route failed with HTTP ${response.status}`);
      return { ok: false, error: "backend_failure" };
    }

    const data = await response.json() as CloudVerificationApiResponse;

    if (!data.ok) {
      console.warn(`[Verification] Server verification returned error: ${data.error || "verification_unavailable"}`);
      return { ok: false, error: data.error || "verification_unavailable" };
    }

    return data;
  } catch (error) {
    console.warn(`[Verification] Cloud verification request failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, error: "backend_failure" };
  }
}

function providerToGemini(provider: ProviderVerificationResult | undefined): GeminiResult {
  if (!provider) return { enabled: false };
  if (!provider.success) return { enabled: false, error: provider.reason };
  return {
    enabled: true,
    matchesCategory: provider.relevant,
    imageRelevant: provider.issueDetected,
    imageQuality: provider.imageQuality === "acceptable" ? "fair" : provider.imageQuality,
    detectedObjects: provider.visibleEvidence ? [provider.visibleEvidence] : [],
    confidence: provider.confidence,
    severity: "unknown",
    reason: provider.reason,
  };
}

function messageForDecision(decision: FinalVerificationDecision) {
  if (decision === "VERIFIED") return "Your image appears to match the selected report category.";
  if (decision === "REJECTED") return "The uploaded image does not appear to match the selected report category.";
  return "We could not confidently verify this image. Please try another image.";
}

function formatLogConfidence(confidence: number | undefined) {
  return typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "n/a";
}

async function compressImageForGemini(file: File): Promise<{ imageBase64: string }> {
  const image = await loadImageElement(file);
  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not process image.");
  }
  ctx.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) {
    throw new Error("Could not process image.");
  }
  return { imageBase64: base64 };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image failed to load."));
    };
    image.src = url;
  });
}
