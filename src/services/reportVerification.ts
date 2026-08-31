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
  const localModel = await verifyWithLocalModel(categoryId, file);
  const cloud = await verifyWithCloudProviders(categoryId, category.title, category.description, file, localModel);

  if (!cloud.ok) {
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
    const { imageBase64 } = await compressImageForGemini(file);
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
      return { ok: false, error: "backend_failure" };
    }

    const data = await response.json() as CloudVerificationApiResponse;

    if (!data.ok) {
      return { ok: false, error: data.error || "verification_unavailable" };
    }

    return data;
  } catch {
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
