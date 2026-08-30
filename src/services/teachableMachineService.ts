import { classifyConfidence, getReportCategory, type VerificationLevel } from "@/config/reportCategories";

export interface LocalModelResult {
  available: boolean;
  category: string;
  predictedClass?: string;
  confidence?: number;
  modelVersion?: string;
  passed: boolean;
  level?: VerificationLevel;
  source: "teachable_machine";
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

    const best = values.reduce(
      (winner, value, index) => (value > winner.value ? { index, value } : winner),
      { index: 0, value: -Infinity },
    );
    const predictedClass = metadata.labels[best.index] || `Class ${best.index + 1}`;
    const confidence = Number(best.value) || 0;
    const level = classifyConfidence(confidence, category.verification);

    return {
      available: true,
      category: categoryId,
      predictedClass,
      confidence,
      modelVersion: metadata.version || `${category.verificationModel}-v1`,
      passed: confidence >= category.verification.mediumConfidence,
      level,
      source: "teachable_machine",
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
    passed: false,
    source: "teachable_machine",
    reason,
  };
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
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<TfRuntime>;
    return await dynamicImport("@tensorflow/tfjs");
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
