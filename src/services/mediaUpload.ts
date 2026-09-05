/**
 * Shared Cloudinary upload helper.
 *
 * Reuses the exact upload architecture already used by the Create
 * post/compose flow (same cloud name, preset and image/video endpoints), so
 * volunteering evidence uploads behave identically to the rest of Hivez and
 * no second media-storage system is introduced.
 */

const CLOUDINARY_CLOUD = "dpotccr5q";
const CLOUDINARY_PRESET = "hivez_upload";

export interface CloudinaryUploadResult {
  secure_url: string;
  resource_type: "image" | "video" | "raw";
}

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);

  const endpoint = file.type.startsWith("video")
    ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`
    : `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

  const response = await fetch(endpoint, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Upload failed.");
  return (await response.json()) as CloudinaryUploadResult;
}