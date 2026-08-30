export interface MediaValidationResult {
  ok: boolean;
  warnings: string[];
  blockingError?: string;
  width?: number;
  height?: number;
}

const MAX_FILE_SIZE = 60 * 1024 * 1024;
const MIN_IMAGE_EDGE = 320;
const DARKNESS_SAMPLE_SIZE = 72;

export async function validateReportMedia(file: File): Promise<MediaValidationResult> {
  const warnings: string[] = [];

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return { ok: false, warnings, blockingError: "Unsupported file type." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, warnings, blockingError: "This file is too large." };
  }

  if (file.type.startsWith("video/")) {
    return { ok: true, warnings };
  }

  try {
    const image = await loadImage(file);
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      return { ok: false, warnings, blockingError: "This image could not be read." };
    }

    if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) {
      warnings.push("Your photo may be difficult to verify because it is low resolution.");
    }

    if (await isVeryDark(image)) {
      warnings.push("Your photo may be difficult to verify because it looks very dark.");
    }

    return { ok: true, warnings, width, height };
  } catch {
    return { ok: false, warnings, blockingError: "This image appears to be corrupted or unreadable." };
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

async function isVeryDark(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = DARKNESS_SAMPLE_SIZE;
  canvas.height = DARKNESS_SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  let samples = 0;

  for (let index = 0; index < data.length; index += 4) {
    total += (data[index] + data[index + 1] + data[index + 2]) / 3;
    samples += 1;
  }

  return samples > 0 && total / samples < 35;
}
