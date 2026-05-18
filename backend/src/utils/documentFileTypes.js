/** Extensions stored as SiteDocument.type (uppercase, no dot). */
const RAW_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "xlsm",
  "csv",
  "txt",
  "ppt",
  "pptx",
  "rtf",
  "mp4",
  "mov",
  "webm",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);

const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
};

function extensionFromName(name = "") {
  const parts = String(name).toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts.pop();
}

exports.extensionFromName = extensionFromName;

exports.normalizeDocumentType = (file) => {
  const fromName = extensionFromName(file?.originalname || "");
  if (fromName) return fromName.toUpperCase();
  const fromMime = MIME_TO_EXT[file?.mimetype];
  if (fromMime) return fromMime.toUpperCase();
  return "FILE";
};

exports.isAllowedUpload = (file) => {
  if (!file?.originalname) return false;
  const ext = extensionFromName(file.originalname);
  if (!ext) return false;
  return RAW_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext);
};

exports.isRawCloudinaryResource = (ext) => {
  const lower = String(ext || "").toLowerCase();
  return RAW_EXTENSIONS.has(lower);
};

exports.sanitizePublicIdBase = (originalname = "") => {
  const base = originalname.replace(/\.[^.]+$/i, "");
  return base.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "document";
};

exports.MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const EXT_MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  csv: "text/csv",
  txt: "text/plain",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

exports.mimeTypeFromExtension = (ext = "") => {
  const lower = String(ext).toLowerCase().replace(/^\./, "");
  return EXT_MIME[lower] || "application/octet-stream";
};
