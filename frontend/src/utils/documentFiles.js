import { getBackendOrigin } from "./backendOrigin";
import { fetchDocumentDownloadBlob } from "../services/api.js";

/** Browser file input accept attribute */
export const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.txt,.ppt,.pptx,.rtf,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.mp4,.mov,.webm";

const IMAGE_TYPES = new Set(["JPG", "JPEG", "PNG", "GIF", "WEBP", "SVG", "BMP"]);
const OFFICE_TYPES = new Set(["DOC", "DOCX", "XLS", "XLSX", "XLSM", "CSV", "PPT", "PPTX", "RTF"]);
export const OFFICE_PREVIEW_TYPES = [...OFFICE_TYPES];
const VIDEO_TYPES = new Set(["MP4", "MOV", "WEBM"]);

const DOC_TYPE_MIME = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  XLS: "application/vnd.ms-excel",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  XLSM: "application/vnd.ms-excel.sheet.macroEnabled.12",
  CSV: "text/csv",
  TXT: "text/plain",
  PPT: "application/vnd.ms-powerpoint",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  RTF: "application/rtf",
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  PNG: "image/png",
  GIF: "image/gif",
  WEBP: "image/webp",
  SVG: "image/svg+xml",
  BMP: "image/bmp",
  MP4: "video/mp4",
  MOV: "video/quicktime",
  WEBM: "video/webm",
};

const EXT_FROM_MIME = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
};

/** Server accepts up to 50 MB; files over 10 MB are stored on the server (not Cloudinary). */
export const MAX_DOCUMENT_MB = 50;
export const CLOUDINARY_MAX_MB = 10;
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;

/** User-facing error when a file exceeds the upload limit, or null if OK. */
export function getDocumentFileSizeError(file) {
  if (!file?.size) return null;
  if (file.size <= MAX_DOCUMENT_BYTES) return null;
  const sizeMb = (file.size / 1024 / 1024).toFixed(1);
  return `This file is ${sizeMb} MB. The maximum upload size is ${MAX_DOCUMENT_MB} MB. Please choose a smaller file.`;
}

export function extensionFromFilename(name = "") {
  const parts = String(name).toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts.pop();
}

export function documentTypeFromFile(file) {
  if (!file) return "FILE";
  const ext = extensionFromFilename(file.name);
  if (ext) return ext.toUpperCase();
  const fromMime = EXT_FROM_MIME[file.type];
  return fromMime || "FILE";
}

export function isAllowedDocumentFile(file) {
  if (!file?.name) return false;
  const ext = extensionFromFilename(file.name);
  if (!ext) return false;
  const allowed = DOCUMENT_UPLOAD_ACCEPT.split(",").map((s) => s.replace(".", "").toLowerCase());
  return allowed.includes(ext);
}

export function buildDownloadFilename(doc) {
  const title = (doc?.title || "document").trim();
  const type = (doc?.type || "").toUpperCase();
  if (!type || type === "FORM" || type === "FILE") return title;
  if (title.toLowerCase().endsWith(`.${type.toLowerCase()}`)) return title;
  return `${title}.${type.toLowerCase()}`;
}

/** Cloudinary: force download with correct filename when possible */
export function getDocumentDownloadUrl(url, filename) {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return resolveDocumentUrl(url);

  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const uploadIdx = path.indexOf("/upload/");
    if (uploadIdx === -1) return url;

    const prefix = path.slice(0, uploadIdx + "/upload/".length);
    const suffix = path.slice(uploadIdx + "/upload/".length);
    const flag = filename
      ? `fl_attachment:${encodeURIComponent(filename)}/`
      : "fl_attachment/";
    parsed.pathname = `${prefix}${flag}${suffix}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Resolve /uploads/... paths against the API origin. */
export function resolveDocumentUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined") {
    const origin = getBackendOrigin().replace(/\/$/, "");
    return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
  }
  return url;
}

/** Local server files should load via the authenticated preview API (avoids CSP / iframe issues). */
export function isLocalStoredDocument(url) {
  return Boolean(url && String(url).startsWith("/uploads/"));
}

/** Google Docs viewer cannot fetch localhost or private URLs. */
export function canUseGoogleDocsViewer(url) {
  const resolved = resolveDocumentUrl(url);
  if (!resolved) return false;
  try {
    const { hostname } = new URL(resolved);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
    if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getDocumentViewUrl(url, docType) {
  const type = (docType || "").toUpperCase();
  const resolved = resolveDocumentUrl(url);
  if (!resolved) return "";

  if (type === "PDF" || IMAGE_TYPES.has(type) || VIDEO_TYPES.has(type) || type === "TXT") {
    return resolved;
  }

  if (OFFICE_TYPES.has(type)) {
    if (!canUseGoogleDocsViewer(url)) return "";
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(resolved)}`;
  }

  return resolved;
}

export function mimeTypeFromDocType(docType) {
  return DOC_TYPE_MIME[(docType || "").toUpperCase()] || "application/octet-stream";
}

/** Use authenticated API preview for PDFs and server-stored files (Cloudinary raw PDFs fail in iframes). */
export function shouldFetchPreviewViaApi(doc) {
  const docId = doc?.id || doc?._id;
  if (!docId) return false;

  const docType = (doc?.type || "FILE").toUpperCase();
  if (isLocalStoredDocument(doc.url)) return true;
  if (docType === "PDF") return true;
  if (IMAGE_TYPES.has(docType) || VIDEO_TYPES.has(docType) || docType === "TXT") {
    return true;
  }
  return false;
}

export function createTypedBlob(data, docType, contentTypeHeader) {
  const mime =
    (contentTypeHeader || "").split(";")[0]?.trim() ||
    mimeTypeFromDocType(docType) ||
    data?.type ||
    "application/octet-stream";
  if (data instanceof Blob && data.type === mime) return data;
  return new Blob([data], { type: mime });
}

export async function readBlobApiError(blob) {
  if (!blob || blob.size > 65536) return null;
  const type = blob.type || "";
  if (!type.includes("json") && !type.includes("text") && blob.size > 512) {
    return null;
  }
  try {
    const text = await blob.text();
    const json = JSON.parse(text);
    if (json?.message) return json.message;
    if (json?.error) return json.error;
  } catch {
    /* not JSON */
  }
  return null;
}

/** Extract API error message when axios used responseType blob. */
export async function parseAxiosErrorMessage(err, fallback = "Download failed. Please try again.") {
  if (!err) return fallback;
  const data = err?.response?.data;
  if (data instanceof Blob) {
    return (await readBlobApiError(data)) || err.message || fallback;
  }
  if (data && typeof data === "object" && data.message) return data.message;
  return err.message || fallback;
}

function shouldFallbackToDirectUrl(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403 || status === 404 || status === 410) {
    return false;
  }
  return (
    !status ||
    status >= 500 ||
    err?.code === "ECONNABORTED" ||
    err?.code === "ERR_NETWORK"
  );
}

export function canPreviewInline(docType) {
  const type = (docType || "").toUpperCase();
  return (
    type === "PDF" ||
    IMAGE_TYPES.has(type) ||
    VIDEO_TYPES.has(type) ||
    OFFICE_TYPES.has(type) ||
    type === "TXT"
  );
}

export function triggerBlobDownload(blob, filename) {
  if (!blob) return;
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename || "document";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export function triggerBrowserDownload(url, filename) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = getDocumentDownloadUrl(url, filename);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (filename) link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Parse filename from Content-Disposition header when present. */
export function filenameFromContentDisposition(header, fallback = "document") {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* ignore */
    }
  }
  const ascii = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header);
  if (ascii?.[1]) return ascii[1].trim().replace(/^"|"$/g, "");
  return fallback;
}

/**
 * Download a site-pack document with the correct title and extension.
 * Server-stored files use the authenticated API; Cloudinary uses attachment URLs.
 */
export async function downloadSiteDocument(doc) {
  if (!doc?.url) {
    throw new Error("This document has no file attached.");
  }

  const filename = buildDownloadFilename(doc);
  const docId = doc.id || doc._id;

  // Prefer API download endpoint when we have a document id.
  // This keeps behavior consistent for both local/server files and cloud links.
  if (docId) {
    try {
      const response = await fetchDocumentDownloadBlob(docId);
      const contentType = response.headers?.["content-type"] || "";
      if (contentType.includes("application/json")) {
        const apiError = await readBlobApiError(response.data);
        throw new Error(apiError || "Download failed.");
      }
      const apiError = await readBlobApiError(response.data);
      if (apiError) {
        throw new Error(apiError);
      }
      if (!response.data?.size) {
        throw new Error("Downloaded file is empty.");
      }
      const docType = (doc?.type || "FILE").toUpperCase();
      const typedBlob = createTypedBlob(
        response.data,
        docType,
        contentType
      );
      const fromHeader = filenameFromContentDisposition(
        response.headers?.["content-disposition"],
        filename
      );
      triggerBlobDownload(typedBlob, fromHeader);
      return;
    } catch (err) {
      if (!shouldFallbackToDirectUrl(err)) {
        throw new Error(await parseAxiosErrorMessage(err));
      }
      console.warn("API download failed, falling back to direct URL:", err?.message || err);
    }
  }

  if (isLocalStoredDocument(doc.url)) {
    throw new Error("Could not download this file from the server. Please try again.");
  }

  if (doc.url.includes("res.cloudinary.com")) {
    triggerBrowserDownload(doc.url, filename);
    return;
  }

  triggerBrowserDownload(doc.url, filename);
}
