const DEFAULT_PHOTO = { maxWidth: 1280, maxHeight: 1280, quality: 0.82 };
const DEFAULT_LOGO = { maxWidth: 480, maxHeight: 240, quality: 0.88 };
const DEFAULT_PDF = { maxWidth: 1024, maxHeight: 1024, quality: 0.78 };
const SHRINK_THRESHOLD_BYTES = 380_000;

function fitWithin(width, height, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
}

function estimateDataUrlBytes(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return 0;
    const base64 = dataUrl.split(",")[1] || "";
    return Math.floor((base64.length * 3) / 4);
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
}

function loadImageElementWithCors(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read blob"));
        reader.readAsDataURL(blob);
    });
}

/** Load remote, blob, or data-URL images as an optimised JPEG data URL for PDF export. */
export async function fetchImageAsDataUrl(src, shrinkOpts = DEFAULT_PDF) {
    if (!src || typeof src !== "string") return null;

    if (src.startsWith("data:image")) {
        return shrinkDataUrlIfNeeded(src, shrinkOpts);
    }

    if (src.startsWith("blob:")) {
        try {
            const img = await loadImageElement(src);
            return drawToDataUrl(img, shrinkOpts);
        } catch {
            return null;
        }
    }

    const absolute = src.startsWith("/") ? `${window.location.origin}${src}` : src;

    try {
        const res = await fetch(absolute, { credentials: "include", mode: "cors" });
        if (res.ok) {
            const blob = await res.blob();
            if (blob.type.startsWith("image/")) {
                const dataUrl = await blobToDataUrl(blob);
                return shrinkDataUrlIfNeeded(dataUrl, shrinkOpts);
            }
        }
    } catch {
        /* try Image() next */
    }

    try {
        const img = await loadImageElementWithCors(absolute);
        return drawToDataUrl(img, shrinkOpts);
    } catch {
        return src;
    }
}

function drawToDataUrl(source, { maxWidth, maxHeight, quality, mimeType = "image/jpeg" }) {
    const { width, height } = fitWithin(
        source.naturalWidth || source.width,
        source.naturalHeight || source.height,
        maxWidth,
        maxHeight
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    return canvas.toDataURL(mimeType, quality);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

/**
 * Resize/compress a camera or gallery file before storing in form JSON.
 */
export async function compressImageFile(
    file,
    { maxWidth, maxHeight, quality, mimeType } = DEFAULT_PHOTO
) {
    if (!file?.type?.startsWith("image/")) {
        throw new Error("Not an image file");
    }

    const opts = {
        maxWidth: maxWidth ?? DEFAULT_PHOTO.maxWidth,
        maxHeight: maxHeight ?? DEFAULT_PHOTO.maxHeight,
        quality: quality ?? DEFAULT_PHOTO.quality,
        mimeType: mimeType ?? "image/jpeg",
    };

    if (file.size < 280 * 1024 && file.type === "image/jpeg") {
        return readFileAsDataUrl(file);
    }

    try {
        if (typeof createImageBitmap === "function") {
            const bitmap = await createImageBitmap(file);
            const dataUrl = drawToDataUrl(bitmap, opts);
            bitmap.close?.();
            return dataUrl;
        }
    } catch {
        /* fall through to Image() */
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await loadImageElement(objectUrl);
        return drawToDataUrl(img, opts);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

/** Smaller variant for header logos. */
export function compressLogoFile(file) {
    return compressImageFile(file, DEFAULT_LOGO);
}

/**
 * Downscale an existing data URL (e.g. legacy saves) before PDF capture.
 */
export async function shrinkDataUrlIfNeeded(
    dataUrl,
    { maxWidth, maxHeight, quality, thresholdBytes } = DEFAULT_PDF
) {
    if (!dataUrl?.startsWith("data:image")) return dataUrl;

    const opts = {
        maxWidth: maxWidth ?? DEFAULT_PDF.maxWidth,
        maxHeight: maxHeight ?? DEFAULT_PDF.maxHeight,
        quality: quality ?? DEFAULT_PDF.quality,
    };
    const limit = thresholdBytes ?? SHRINK_THRESHOLD_BYTES;

    if (estimateDataUrlBytes(dataUrl) <= limit) return dataUrl;

    try {
        const img = await loadImageElement(dataUrl);
        return drawToDataUrl(img, opts);
    } catch {
        return dataUrl;
    }
}

export async function prepareImagesForPdfExport(images = []) {
    const valid = (images || []).filter(
        (img) => typeof img === "string" && img.startsWith("data:image")
    );
    if (!valid.length) return [];
    return Promise.all(valid.map((img) => shrinkDataUrlIfNeeded(img)));
}

/** Smaller payloads for JSON save/upload (faster on mobile and slow networks). */
const SAVE_IMAGE_OPTS = {
    maxWidth: 768,
    maxHeight: 768,
    quality: 0.68,
    thresholdBytes: 100_000,
};

export async function prepareImagesForSave(images = []) {
    const valid = (images || []).filter(
        (img) => typeof img === "string" && img.startsWith("data:image")
    );
    if (!valid.length) return [];
    const needsWork = valid.filter(
        (img) => estimateDataUrlBytes(img) > SAVE_IMAGE_OPTS.thresholdBytes
    );
    if (!needsWork.length) return valid;
    const shrunk = await Promise.all(
        needsWork.map((img) => shrinkDataUrlIfNeeded(img, SAVE_IMAGE_OPTS))
    );
    const shrunkBySrc = new Map(needsWork.map((img, i) => [img, shrunk[i]]));
    return valid.map((img) => shrunkBySrc.get(img) ?? img);
}
