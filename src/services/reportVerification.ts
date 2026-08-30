import { getFunctions, httpsCallable } from "firebase/functions";
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
    const imageBase64 = await fileToBase64(file);
    const verify = httpsCallable(getFunctions(), "verifyReportWithGemini");
    const response = await verify({
      categoryId,
      categoryTitle,
      mimeType: file.type,
      imageBase64,
    });
    const data = response.data as { ok?: boolean; result?: Omit<GeminiResult, "enabled">; error?: string };

    if (!data.ok || !data.result) {
      return { enabled: false, error: data.error || "gemini_unavailable" };
    }

    return { enabled: true, ...data.result };
  } catch {
    return { enabled: false, error: "backend_failure" };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
