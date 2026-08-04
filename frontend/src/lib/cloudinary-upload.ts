import { ApiError, uploadAsset, type CloudinaryUploadResult } from "@/lib/api";

const MAX_IMAGE_BYTES = 1_000_000;
const MAX_FILE_BYTES = 8_000_000;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read file"));
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to Cloudinary via the backend.
 * Falls back to a local data URL when Cloudinary is not configured (503).
 */
export async function uploadFileToCloudinary(
  file: File,
  options?: {
    folder?: string;
    resourceType?: "image" | "raw" | "auto";
    maxBytes?: number;
    acceptImageOnly?: boolean;
  },
): Promise<{ url: string; uploaded: boolean; result?: CloudinaryUploadResult }> {
  if (options?.acceptImageOnly && !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  const maxBytes = options?.maxBytes ?? (options?.acceptImageOnly ? MAX_IMAGE_BYTES : MAX_FILE_BYTES);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / 100_000) / 10;
    throw new Error(`File must be ${mb}MB or smaller`);
  }

  const dataUrl = await fileToDataUrl(file);

  try {
    const result = await uploadAsset({
      dataUrl,
      folder: options?.folder,
      filename: file.name,
      resourceType: options?.resourceType ?? (file.type.startsWith("image/") ? "image" : "auto"),
    });
    return { url: result.url, uploaded: true, result };
  } catch (err) {
    // Cloudinary not configured — keep local data URL so the app still works.
    if (err instanceof ApiError && err.status === 503) {
      return { url: dataUrl, uploaded: false };
    }
    throw err;
  }
}
