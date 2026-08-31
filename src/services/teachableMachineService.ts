import { classifyConfidence, getReportCategory, type VerificationLevel } from "@/config/reportCategories";

export interface LocalModelResult {
  available: boolean;
  category: string;
  provider: "teachable-machine";
  providerGroup: "local";
  status: "completed" | "failed" | "unsupported";
  predictions: Array<{
    label: string;
    confidence: number;
    confidencePercent: number;
  }>;
  topClassType?: "positive" | "normal" | "negative";
  predictedClass?: string;
  topLabel?: string;
  confidence?: number;
  topConfidence?: number;
  topConfidencePercent?: number;
  modelVersion?: string;
  passed: boolean;
  level?: VerificationLevel;
  source: "teachable-machine";
  relevant: boolean;
  issueDetected: boolean;
  imageQuality: "good" | "acceptable" | "poor";
  reason?: string;
}

type TfRuntime = {
  loadLayersModel: (url: string) => Promise<{
    predict: (input: unknown) => unknown;
  }>;
  browser: {
    fromPixels: (image: HTMLImageElement) => TfTensor;
  };
  image: {
    resizeBilinear: (tensor: TfTensor, size: [number, number]) => TfTensor;
  };
};

type TfTensor = {
  toFloat: () => TfTensor;
  div: (value: number) => TfTensor;
  expandDims: (axis: number) => TfTensor;
  data: () => Promise<Float32Array | number[]>;
  dispose: () => void;
};

export async function verifyWithLocalModel(categoryId: string, file: File): Promise<LocalModelResult> {
  const category = getReportCategory(categoryId);
  if (!category?.verificationModel) {
    return unavailable(categoryId, "No local model configured for this category.");
  }

  if (!file.type.startsWith("image/")) {
    return unavailable(categoryId, "Local model verification currently supports images only.");
  }

  const modelPath = `/models/${category.verificationModel}`;
  const metadata = await loadMetadata(modelPath);
  if (!metadata) {
    return unavailable(categoryId, "Local AI model unavailable.");
  }

  const tf = await loadTensorFlowRuntime();
  if (!tf) {
    return unavailable(categoryId, "TensorFlow.js runtime unavailable.");
  }

  try {
    const image = await loadImage(file);
    const model = await tf.loadLayersModel(`${modelPath}/model.json`);
    const input = tf.image.resizeBilinear(tf.browser.fromPixels(image), [224, 224]).toFloat().div(255).expandDims(0);
    const prediction = model.predict(input) as TfTensor;
    const values = Array.from(await prediction.data());
    input.dispose();
    prediction.dispose();

    const predictions = values
      .map((value, index) => {
        const confidence = Number(value) || 0;
        return {
          label: metadata.labels[index] || `Class ${index + 1}`,
          confidence,
          confidencePercent: Math.round(confidence * 100),
        };
      })
      .sort((a, b) => b.confidence - a.confidence);
    const best = predictions[0];
    const predictedClass = best?.label || "Unknown";
    const confidence = best?.confidence || 0;
    const level = classifyConfidence(confidence, category.verification);
    const topClassType = classifyModelClass(predictedClass);
    const relevant = topClassType !== "negative" && confidence >= category.verification.mediumConfidence;
    const issueDetected = topClassType === "positive" && confidence >= category.verification.mediumConfidence;

    return {
      available: true,
      category: categoryId,
      provider: "teachable-machine",
      providerGroup: "local",
      status: "completed",
      predictions,
      predictedClass,
      topLabel: predictedClass,
      topClassType,
      confidence,
      topConfidence: confidence,
      topConfidencePercent: Math.round(confidence * 100),
      modelVersion: metadata.version || `${category.verificationModel}-v1`,
      passed: issueDetected,
      level,
      source: "teachable-machine",
      relevant,
      issueDetected,
      imageQuality: "acceptable",
      reason: topClassType === "negative"
        ? "The strongest local model prediction is a negative/not-relevant class."
        : topClassType === "normal"
        ? "The strongest local model prediction is a normal/non-issue class."
        : "The local model found a visually relevant top class.",
    };
  } catch {
    return unavailable(categoryId, "Model loading failure.");
  }
}

function unavailable(categoryId: string, reason: string): LocalModelResult {
  console.info(`[HIVEZ LOCAL AI] ${reason}`);
  return {
    available: false,
    category: categoryId,
    provider: "teachable-machine",
    providerGroup: "local",
    status: "failed",
    predictions: [],
    passed: false,
    source: "teachable-machine",
    relevant: false,
    issueDetected: false,
    imageQuality: "acceptable",
    reason,
  };
}

function classifyModelClass(label: string): "positive" | "normal" | "negative" {
  const normalized = label.trim().toLowerCase();
  if (
    normalized.startsWith("no ") ||
    normalized.includes("not relevant") ||
    normalized.includes("irrelevant") ||
    normalized === "clean"
  ) {
    return "negative";
  }
  if (normalized.startsWith("normal") || normalized.startsWith("legal ")) {
    return "normal";
  }
  return "positive";
}

async function loadMetadata(modelPath: string): Promise<{ labels: string[]; version?: string } | null> {
  try {
    const response = await fetch(`${modelPath}/metadata.json`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    const labels =
      Array.isArray(data.labels)
        ? data.labels
        : Array.isArray(data.classNames)
        ? data.classNames
        : [];
    return {
      labels: labels.filter((label: unknown): label is string => typeof label === "string"),
      version: typeof data.version === "string" ? data.version : undefined,
    };
  } catch {
    return null;
  }
}

async function loadTensorFlowRuntime(): Promise<TfRuntime | null> {
  try {
    // Literal dynamic import (not `new Function`) so Vite/Rollup can statically
    // resolve "@tensorflow/tfjs" and emit it as a lazy, code-split chunk.
    const tf = (await import("@tensorflow/tfjs")) as unknown as TfRuntime;
    return tf;
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
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
