const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { v4: uuidv4 } = require("uuid");
const {
  extensionFromName,
  isRawCloudinaryResource,
  sanitizePublicIdBase,
  MAX_DOCUMENT_BYTES,
} = require("./documentFileTypes");
const { destroyCloudinaryAsset } = require("./cloudinaryDocument");

/** Cloudinary free tier file limit (bytes). Override via env if your plan allows more. */
const CLOUDINARY_MAX_BYTES =
  Number(process.env.CLOUDINARY_MAX_FILE_BYTES) || 10 * 1024 * 1024;

/**
 * True when the process runs on a serverless platform where only /tmp is writable
 * (e.g. Vercel, AWS Lambda). Docker/Coolify VMs are not serverless.
 */
function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.FUNCTION_TARGET ||
      process.env.K_SERVICE
  );
}

/**
 * Writable directory for local disk fallbacks (when Cloudinary is skipped or unavailable).
 * UPLOADS_DIR overrides everything; serverless defaults to /tmp/uploads.
 */
function resolveUploadsDir() {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }
  if (isServerlessRuntime()) {
    return path.join("/tmp", "uploads");
  }
  return path.join(process.cwd(), "uploads");
}

function getUploadsDir() {
  return resolveUploadsDir();
}

function ensureUploadsDir() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function shouldTryCloudinary(file) {
  return isCloudinaryConfigured() && file.size <= CLOUDINARY_MAX_BYTES;
}

function cloudinaryFailureShouldFallback(err) {
  const msg = String(err?.message || "");
  return (
    /file size too large/i.test(msg) ||
    /maximum is/i.test(msg) ||
    err?.http_code === 499 ||
    /timeout/i.test(msg)
  );
}

function uploadToCloudinary(file) {
  const { cloudinary } = require("../config/cloudinary");
  const ext = extensionFromName(file.originalname);
  const isRaw = isRawCloudinaryResource(ext);
  const publicIdBase = `${sanitizePublicIdBase(file.originalname)}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "safetyapp_uploads",
        resource_type: isRaw ? "raw" : "auto",
        public_id: isRaw ? `${publicIdBase}.${ext}` : publicIdBase,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    Readable.from(file.buffer).pipe(uploadStream);
  });
}

function saveToLocalDisk(file) {
  const dir = ensureUploadsDir();
  const ext = extensionFromName(file.originalname) || "bin";
  const filename = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${filename}`;
}

/**
 * Store a site-pack document on Cloudinary (≤10 MB) or local disk (larger / fallback).
 */
async function storeUploadedDocument(file) {
  if (file.size > MAX_DOCUMENT_BYTES) {
    const maxMb = Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024);
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const err = new Error(
      `File is too large (${sizeMb} MB). The maximum upload size is ${maxMb} MB. Please choose a smaller file.`
    );
    err.status = 413;
    throw err;
  }

  if (shouldTryCloudinary(file)) {
    try {
      const result = await uploadToCloudinary(file);
      return { url: result.secure_url, storage: "cloudinary" };
    } catch (err) {
      if (!cloudinaryFailureShouldFallback(err)) {
        throw err;
      }
      console.warn(
        "Cloudinary upload unavailable, saving locally:",
        err.message || err
      );
    }
  }

  const url = saveToLocalDisk(file);
  return { url, storage: "local" };
}

async function deleteStoredDocument(url) {
  if (!url) return;

  if (url.includes("res.cloudinary.com")) {
    await destroyCloudinaryAsset(url);
    return;
  }

  if (url.startsWith("/uploads/")) {
    const filePath = path.join(getUploadsDir(), path.basename(url));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Local file delete error:", err);
    }
  }
}

function formatStorageError(err) {
  if (err?.status === 413) {
    return err.message;
  }
  const msg = String(err?.message || "");
  if (/file size too large/i.test(msg) || /maximum is/i.test(msg)) {
    return "File is too large for cloud storage. It will be saved on the server instead—please try again.";
  }
  if (/timeout/i.test(msg) || err?.http_code === 499) {
    return "Upload timed out. Please try again or use a smaller file.";
  }
  return msg || "Upload failed";
}

module.exports = {
  CLOUDINARY_MAX_BYTES,
  isServerlessRuntime,
  resolveUploadsDir,
  getUploadsDir,
  storeUploadedDocument,
  deleteStoredDocument,
  formatStorageError,
  isCloudinaryConfigured,
};
