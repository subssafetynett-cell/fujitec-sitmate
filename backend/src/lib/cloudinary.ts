import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
  resourceType: string;
  width?: number;
  height?: number;
};

let configured = false;

export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function ensureConfigured() {
  if (configured) return;
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
      api_key: process.env.CLOUDINARY_API_KEY!.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
      secure: true,
    });
  }
  configured = true;
}

function toResult(result: UploadApiResponse): CloudinaryUploadResult {
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    bytes: result.bytes ?? 0,
    format: result.format || "",
    resourceType: result.resource_type || "image",
    width: result.width,
    height: result.height,
  };
}

export type UploadOptions = {
  folder?: string;
  publicId?: string;
  resourceType?: "image" | "raw" | "auto" | "video";
  filename?: string;
};

/** Upload a Buffer to Cloudinary (images, PDFs, etc.). */
export function uploadBuffer(
  buffer: Buffer,
  options: UploadOptions = {},
): Promise<CloudinaryUploadResult> {
  ensureConfigured();
  const folder = (options.folder || "sheq-harmony").replace(/^\/+|\/+$/g, "");
  const resourceType = options.resourceType || "auto";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        overwrite: false,
        unique_filename: true,
        use_filename: Boolean(options.filename),
        filename_override: options.filename?.slice(0, 180),
        ...(options.publicId ? { public_id: options.publicId } : {}),
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(toResult(result));
      },
    );
    stream.end(buffer);
  });
}

/** Upload a data URL (e.g. data:image/png;base64,...) to Cloudinary. */
export async function uploadDataUrl(
  dataUrl: string,
  options: UploadOptions = {},
): Promise<CloudinaryUploadResult> {
  ensureConfigured();
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) {
    throw new Error("Expected a data URL");
  }

  const folder = (options.folder || "sheq-harmony").replace(/^\/+|\/+$/g, "");
  const result = await cloudinary.uploader.upload(trimmed, {
    folder,
    resource_type: options.resourceType || "auto",
    overwrite: false,
    unique_filename: true,
    use_filename: Boolean(options.filename),
    filename_override: options.filename?.slice(0, 180),
    ...(options.publicId ? { public_id: options.publicId } : {}),
  });
  return toResult(result);
}

/** Delete an asset from Cloudinary (best-effort). */
export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "raw" | "video" | "auto" = "image",
): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === "auto" ? "image" : resourceType,
    });
  } catch (err) {
    console.warn("Cloudinary destroy failed:", publicId, err);
  }
}

/**
 * If Cloudinary is configured and value is a data URL, upload it and return the
 * CDN URL. Otherwise return the original value unchanged.
 */
export async function maybeUploadDataUrl(
  value: string,
  options: UploadOptions = {},
): Promise<string> {
  const trimmed = (value || "").trim();
  if (!trimmed.startsWith("data:") || !isCloudinaryConfigured()) return trimmed;
  const uploaded = await uploadDataUrl(trimmed, options);
  return uploaded.url;
}

/** Upload every data:image / data:application value in a form map to Cloudinary. */
export async function offloadFormDataImages(
  formData: Record<string, string>,
  folder = "sheq-harmony/forms",
): Promise<Record<string, string>> {
  if (!isCloudinaryConfigured()) return formData;

  const entries = Object.entries(formData);
  const out: Record<string, string> = {};

  await Promise.all(
    entries.map(async ([key, value]) => {
      const v = String(value ?? "");
      if (!v.startsWith("data:")) {
        out[key] = v;
        return;
      }
      try {
        const isImage = v.startsWith("data:image/");
        out[key] = (
          await uploadDataUrl(v, {
            folder: `${folder}/${isImage ? "images" : "files"}`,
            resourceType: isImage ? "image" : "auto",
            filename: key,
          })
        ).url;
      } catch (err) {
        console.warn(`Cloudinary offload failed for ${key}:`, err);
        out[key] = v;
      }
    }),
  );

  return out;
}
