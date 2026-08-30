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

export interface ReportVerificationResult {
  status: VerificationStatus;
  localModel?: LocalModelResult;
  gemini: GeminiResult;
  finalClassification?: VerificationLevel;
  message: string;
}

export async function verifyReportEvidence(categoryId: string, file: File | null): Promise<ReportVerificationResult> {
  const category = getReportCategory(categoryId);
  if (!category) {
    return {
      status: "requires_review",
      gemini: { enabled: false },
      message: "This report category needs review.",
    };
  }

  if (!file || !file.type.startsWith("image/")) {
    return {
      status: "pending",
      gemini: { enabled: false },
      message: category.requiresMedia ? "Add media to run an AI check." : "This report can continue without image AI.",
    };
  }

  const localModel = await verifyWithLocalModel(categoryId, file);
  const shouldUseGemini =
    category.verification.geminiMode === "always" ||
    (category.verification.geminiMode === "on_uncertain" && (!localModel.available || !localModel.passed));
  const gemini = shouldUseGemini ? await verifyWithGemini(categoryId, category.title, file) : { enabled: false };

  if (localModel.available && localModel.passed && (!gemini.enabled || gemini.matchesCategory !== false)) {
    return {
      status: gemini.enabled ? "ai_checked" : "local_model_only",
      localModel,
      gemini,
      finalClassification: localModel.level,
      message: "The uploaded media appears consistent with the selected report category. It does not guarantee that the report is true.",
    };
  }

  if (gemini.enabled && gemini.matchesCategory && gemini.imageRelevant) {
    return {
      status: "ai_checked",
      localModel,
      gemini,
      finalClassification: localModel.level,
      message: "The uploaded media appears consistent with the selected report category. It does not guarantee that the report is true.",
    };
  }

  if (!localModel.available && !gemini.enabled) {
    return {
      status: "requires_review",
      localModel,
      gemini,
      message: "AI verification is unavailable right now. You can continue and the report will be marked for review.",
    };
  }

  return {
    status: "requires_review",
    localModel,
    gemini,
    finalClassification: localModel.level,
    message: "We could not confidently identify this issue. You can upload another file or continue for review.",
  };
}

async function verifyWithGemini(categoryId: string, categoryTitle: string, file: File): Promise<GeminiResult> {
  try {
    const { imageBase64 } = await compressImageForGemini(file);
    const response = await fetch("/api/gemini-verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId,
        categoryTitle,
        mimeType: "image/jpeg",
        imageBase64,
      }),
    });

    if (!response.ok) {
      return { enabled: false, error: "backend_failure" };
    }

    const data = await response.json() as { ok?: boolean; result?: Omit<GeminiResult, "enabled">; error?: string };

    if (!data.ok || !data.result) {
      return { enabled: false, error: data.error || "gemini_unavailable" };
    }

    return { enabled: true, ...data.result };
  } catch {
    return { enabled: false, error: "backend_failure" };
  }
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
