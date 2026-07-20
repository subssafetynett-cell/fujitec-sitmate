import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { inlineImagesForPdfCapture, absolutizeImageSrc } from "./compressImage";
import brandLogoLeftUrl from "../assets/pdf-logo-left.png";
import brandLogoRightUrl from "../assets/pdf-logo-right.png";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
// Header/footer bands on every exported page (branded logos + download date)
// Header band: 6mm top margin + 10mm logo row + 6mm gap before the content starts.
const HEADER_LOGO_TOP_MM = 6;
const HEADER_LOGO_HEIGHT_MM = 10;
const HEADER_GAP_BELOW_LOGO_MM = 6;
const MIN_HEADER_INSET_MM = HEADER_LOGO_TOP_MM + HEADER_LOGO_HEIGHT_MM + HEADER_GAP_BELOW_LOGO_MM;
const MIN_FOOTER_INSET_MM = 12;

let cachedBrandLogos = null;

/** Load both brand logos once and convert to PNG data URLs jsPDF can embed. */
export async function loadBrandLogos() {
    if (cachedBrandLogos) return cachedBrandLogos;
    const load = (src) =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth || 1;
                    canvas.height = img.naturalHeight || 1;
                    canvas.getContext("2d").drawImage(img, 0, 0);
                    resolve({
                        dataUrl: canvas.toDataURL("image/png"),
                        width: img.naturalWidth || 1,
                        height: img.naturalHeight || 1,
                    });
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        });
    const [left, right] = await Promise.all([load(brandLogoLeftUrl), load(brandLogoRightUrl)]);
    cachedBrandLogos = { left, right };
    return cachedBrandLogos;
}
const DEFAULT_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TARGET_BYTES = 2 * 1024 * 1024;
const BLOCK_GAP_MM = 2;

function blockHasLayout(el) {
    const w = el.offsetWidth || el.scrollWidth || el.clientWidth;
    const h = el.offsetHeight || el.scrollHeight || el.clientHeight;
    return w > 0 && h > 0;
}

function getTopLevelPdfBlocks(root) {
    const all = Array.from(root.querySelectorAll("[data-pdf-block]"));
    return all.filter((el) => {
        let parent = el.parentElement;
        while (parent && parent !== root) {
            if (parent.hasAttribute("data-pdf-block")) return false;
            parent = parent.parentElement;
        }
        return blockHasLayout(el);
    });
}

async function mapWithConcurrency(items, mapper, concurrency = 2) {
    if (items.length === 0) return [];
    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(items[index], index);
        }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

function waitForChart(root, timeoutMs = 2000) {
    const chartRoots = root?.querySelectorAll?.("[data-pdf-chart]");
    const roots =
        chartRoots && chartRoots.length > 0
            ? Array.from(chartRoots)
            : root?.querySelector?.("[data-pdf-chart]")
              ? [root.querySelector("[data-pdf-chart]")]
              : [];

    if (roots.length === 0) return Promise.resolve();

    const chartSvgReady = (svg) =>
        svg &&
        (svg.querySelector(".recharts-bar-rectangle") ||
            svg.querySelector("path.recharts-rectangle") ||
            svg.querySelector(".recharts-layer.recharts-bar") ||
            svg.querySelector("path.recharts-curve") ||
            svg.querySelector(".recharts-line-curve") ||
            svg.querySelector(".recharts-pie-sector") ||
            svg.querySelector("path.recharts-sector"));

    const started = Date.now();
    return new Promise((resolve) => {
        const tick = () => {
            const ready = roots.every((chartRoot) => chartSvgReady(chartRoot.querySelector("svg")));
            if (ready || Date.now() - started >= timeoutMs) {
                resolve();
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function waitForImages(root, timeoutMs = 8000, options = {}) {
    if (!root) return Promise.resolve();
    const imgs = Array.from(root.querySelectorAll("img")).filter((img) => img.getAttribute("src"));
    if (imgs.length === 0) return Promise.resolve();

    const effectiveTimeout = options.imageWaitTimeoutMs ?? timeoutMs;
    const allDataUrls = imgs.every((img) => {
        const src = img.getAttribute("src") || "";
        return src.startsWith("data:") || src.startsWith("blob:");
    });
    if (allDataUrls && !options.requireImageDecode) return Promise.resolve();

    const waitOne = (img) =>
        new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
                resolve();
                return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
        });

    return Promise.race([
        Promise.all(imgs.map(waitOne)),
        new Promise((resolve) => setTimeout(resolve, effectiveTimeout)),
    ]);
}

/** Ensure export subtree is visible in html2canvas clone (hidden/off-screen ancestors). */
function ensurePdfExportVisible(clonedRoot) {
    if (!clonedRoot?.querySelectorAll) return;
    const exportRoot =
        clonedRoot.classList?.contains("pdf-export-root")
            ? clonedRoot
            : clonedRoot.querySelector(".pdf-export-root") || clonedRoot;
    [exportRoot].forEach((root) => {
        root.style.visibility = "visible";
        root.style.opacity = "1";
        root.style.display = root.style.display || "block";
    });
    exportRoot.querySelectorAll("*").forEach((el) => {
        if (el.classList?.contains("pdf-hide-on-export")) return;
        el.style.visibility = "visible";
        if (el.tagName === "IMG" || el.classList?.contains("pdf-upload-photo")) {
            el.style.opacity = "1";
            el.style.display = "block";
        }
    });
}

function absolutizeMediaUrlsInClone(_document, clonedRoot) {
    if (!clonedRoot?.querySelectorAll) return;
    clonedRoot.querySelectorAll("img[src]").forEach((img) => {
        const s = img.getAttribute("src");
        if (!s || s.startsWith("data:") || s.startsWith("blob:") || /^https?:\/\//i.test(s)) return;
        const absolute = absolutizeImageSrc(s);
        if (absolute) img.setAttribute("src", absolute);
    });
}

function captureDimensions(element) {
    // Use the visible box width (not scrollWidth): oversized children (e.g. wide images
    // constrained only in the export clone) inflate scrollWidth and would leave a white
    // strip on the right of the capture, making content look left-aligned in the PDF.
    const width = Math.max(element.offsetWidth, element.clientWidth, 1);
    const height = Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight, 1);
    return { width, height };
}

export function html2canvasOnClone(_document, clonedElement) {
    absolutizeMediaUrlsInClone(_document, clonedElement);
    ensurePdfExportVisible(clonedElement);
    const style = _document.createElement("style");
    style.textContent = `
        [data-pdf-block] { break-inside: avoid !important; page-break-inside: avoid !important; }
        .pdf-hide-on-export { display: none !important; }
        .pdf-export-root { padding: 12px !important; visibility: visible !important; opacity: 1 !important; }
        .pdf-export-root [data-pdf-block] { margin-bottom: 0 !important; }
        .pdf-upload-photo,
        .pdf-upload-photo img,
        .pdf-export-root img {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            max-width: 100% !important;
        }
        .pdf-export-root.sheq-pdf-export,
        .pdf-export-root.sheq-pdf-export .MuiPaper-root {
            background: #ffffff !important;
            color: #111827 !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-header-row,
        .pdf-export-root.sheq-pdf-export .sheq-pdf-grid-row {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-col-25 {
            width: 25% !important;
            max-width: 25% !important;
            flex: 0 0 25% !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-col-33 {
            width: 33.33% !important;
            max-width: 33.33% !important;
            flex: 0 0 33.33% !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-col-34 {
            width: 34% !important;
            max-width: 34% !important;
            flex: 0 0 34% !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-col-50 {
            width: 50% !important;
            max-width: 50% !important;
            flex: 0 0 50% !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-4col-row,
        .pdf-export-root.sheq-pdf-export .sheq-pdf-summary-row {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-section-photos-row {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 16px !important;
            align-items: flex-start !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-section-photo-thumb {
            width: 240px !important;
            height: 180px !important;
            flex: 0 0 240px !important;
            border-radius: 10px !important;
            overflow: hidden !important;
            border: 1px solid #e5e7eb !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-section-photo-thumb img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-page-one,
        .pdf-export-root.sheq-pdf-export .sheq-pdf-chart-page {
            background: #ffffff !important;
            overflow: visible !important;
        }
        .pdf-export-root.sheq-pdf-export .MuiTableCell-root {
            border-color: #e2e8f0 !important;
        }
        .pdf-export-root.sheq-pdf-export .MuiTableHead-root .MuiTableCell-root {
            color: #ffffff !important;
            background-color: #003049 !important;
        }
        .pdf-export-root.sheq-pdf-export .sheq-pdf-page-one .MuiTypography-root {
            color: #111827 !important;
        }
        .pdf-export-root.sheq-pdf-export .MuiTypography-root {
            color: #111827 !important;
        }
        [data-pdf-chart] .recharts-wrapper,
        [data-pdf-chart] .recharts-surface,
        [data-pdf-chart] svg { overflow: visible !important; }
        .pdf-header-logo { display: block !important; margin-left: auto !important; margin-right: auto !important; }
        .sif-pdf-export .sif-checkbox-cell {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            justify-content: space-between !important;
        }
        .sif-pdf-export .sif-yesno-cell {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            width: 20% !important;
            max-width: 20% !important;
            flex: 0 0 20% !important;
        }
        .sif-pdf-export .sif-form-row > *:first-child {
            width: 70% !important;
            max-width: 70% !important;
            flex: 0 0 70% !important;
        }
        .sif-pdf-export .sif-form-row > *:not(:first-child) {
            width: 10% !important;
            max-width: 10% !important;
            flex: 0 0 10% !important;
        }
        .sif-pdf-export .sif-skills-row {
            display: flex !important;
            flex-wrap: nowrap !important;
        }
        .sif-pdf-export.sif-pdf-page,
        .sif-pdf-export .sif-pdf-page {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
        .sif-pdf-export .sif-form-row {
            display: flex !important;
            flex-wrap: nowrap !important;
        }
        .sif-pdf-export .MuiTypography-root,
        .sif-pdf-export .MuiInputBase-input {
            color: #111827 !important;
        }
        .sif-pdf-export img,
        .sif-pdf-export .pdf-signature-img {
            image-rendering: -webkit-optimize-contrast;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        .sif-pdf-export .pdf-signature-img {
            max-height: 52px !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
        }
        .sif-pdf-export .sif-page3-body {
            width: 100% !important;
        }
        .concern-pdf-export,
        .concern-pdf-export .MuiPaper-root {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: geometricPrecision !important;
            font-synthesis: none !important;
        }
        .concern-pdf-export * {
            font-synthesis: none !important;
        }
        .concern-pdf-export .concern-report-header,
        .concern-pdf-export .pdf-header.concern-report-header {
            display: block !important;
            position: relative !important;
        }
        .concern-pdf-export .concern-header-title {
            text-align: center !important;
            width: 100% !important;
            padding: 0 16px !important;
            box-sizing: border-box !important;
        }
        .concern-pdf-export .concern-header-title h1 {
            text-align: center !important;
            margin: 0 auto !important;
        }
        .concern-pdf-export .concern-signature-block {
            display: flex !important;
            justify-content: flex-end !important;
            width: 100% !important;
        }
        .concern-pdf-export .concern-signature-block > div {
            text-align: right !important;
            margin-left: auto !important;
            max-width: 320px !important;
        }
        .concern-pdf-export .pdf-upload-photo img {
            max-height: 280px !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
        }
        .concern-pdf-export .pdf-signature-img {
            max-height: 64px !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
            margin-left: auto !important;
            margin-right: 0 !important;
            display: block !important;
        }
        .weekly-pdf-export .pdf-header {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
        }
        .weekly-pdf-export .pdf-header-logo {
            display: block !important;
            max-height: 72px !important;
            max-width: 160px !important;
            object-fit: contain !important;
        }
        .pdf-export-root.kpi-report-export {
            overflow: visible !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            padding: 0 !important;
        }
        .pdf-export-root.kpi-report-export [data-pdf-block] {
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding-bottom: 6px !important;
        }
        .pdf-export-root.kpi-report-export h1,
        .pdf-export-root.kpi-report-export p {
            line-height: 1.45 !important;
            overflow: visible !important;
        }
        .pdf-export-root.kpi-report-export table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
        }
        .pdf-export-root.kpi-report-export th,
        .pdf-export-root.kpi-report-export td {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            word-wrap: break-word !important;
            white-space: normal !important;
        }
    `;
    _document.head.appendChild(style);
}

function warnIfOversized(pdf, maxOutputBytes) {
    const cap = maxOutputBytes ?? MAX_OUTPUT_BYTES;
    const out = pdf.output("arraybuffer");
    if (out.byteLength > cap) {
        console.warn(
            `PDF output is ${(out.byteLength / (1024 * 1024)).toFixed(2)} MB (cap ${(cap / (1024 * 1024)).toFixed(2)} MB).`
        );
    }
}

function pickCaptureOptions(element, overrides = {}) {
    const w = element?.scrollWidth || 1000;
    const h = element?.scrollHeight || 1000;
    const megapixels = (w * h) / 1e6;
    let scale = overrides.scale ?? 1.45;
    if (overrides.scale == null) {
        if (megapixels > 3.5) scale = 1.25;
        if (megapixels > 8) scale = 1.05;
    }
    let jpegQuality = overrides.jpegQuality ?? 0.74;
    if (overrides.jpegQuality == null) {
        if (megapixels > 5) jpegQuality = 0.68;
        if (megapixels > 10) jpegQuality = 0.62;
    }
    return { scale, jpegQuality };
}

/** Content that fits on one page stays on one page; anything taller flows onto more pages unshrunk. */
function applyOrphanPageMerge(imgWidth, imgHeight, availableHeight, onePageOnly) {
    if (onePageOnly) return { imgWidth, imgHeight, singlePage: true };
    return { imgWidth, imgHeight, singlePage: imgHeight <= availableHeight };
}

/** True when branded header logos should be omitted (e.g. Performance Monitoring downloads). */
export function shouldSkipBrandLogos(options = {}) {
    if (options.skipBrandLogos === true) return true;
    if (options.skipBrandLogos === false) return false;
    try {
        if (typeof window === "undefined") return false;
        return new URLSearchParams(window.location.search).get("hideHeaderLogos") === "true";
    } catch {
        return false;
    }
}

function withResolvedPdfOptions(options = {}) {
    return {
        ...options,
        skipBrandLogos: shouldSkipBrandLogos(options),
    };
}

function resolveLayout(options) {
    const marginX = options.marginX !== undefined ? options.marginX : 12;
    const legacyY = options.marginY;
    const requestedHeader =
        options.headerInsetMm !== undefined ? options.headerInsetMm : legacyY !== undefined ? legacyY : 11;
    const requestedFooter =
        options.footerInsetMm !== undefined ? options.footerInsetMm : legacyY !== undefined ? legacyY : 13;
    const skipBrandLogos = shouldSkipBrandLogos(options);
    // Reserve room for the branded logo header (unless omitted) and dated footer on every page.
    const minHeader = skipBrandLogos
        ? options.useRunningHeader
            ? 12
            : 8
        : MIN_HEADER_INSET_MM;
    const headerInsetMm = Math.max(requestedHeader, minHeader);
    const footerInsetMm = Math.max(requestedFooter, MIN_FOOTER_INSET_MM);
    return { marginX, headerInsetMm, footerInsetMm, skipBrandLogos };
}

async function captureElement(element, captureOpts) {
    const { scale, jpegQuality } = pickCaptureOptions(element, captureOpts);
    const { width, height } = captureDimensions(element);
    const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: false,
        scale,
        logging: false,
        backgroundColor: "#ffffff",
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        onclone: html2canvasOnClone,
    });
    return { canvas, jpegQuality };
}

function canvasToJpeg(canvas, quality, targetMaxBytes, minQuality = 0.5) {
    let q = quality;
    let data = canvas.toDataURL("image/jpeg", q);
    const cap = targetMaxBytes;
    const floor = Math.min(quality, Math.max(0.5, minQuality));
    while (q > floor + 0.001 && data.length > cap) {
        q = Math.max(floor, q - 0.04);
        data = canvas.toDataURL("image/jpeg", q);
    }
    return data;
}

function cropCanvasSlice(source, srcY, srcHeight) {
    const slice = document.createElement("canvas");
    slice.width = source.width;
    slice.height = srcHeight;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(source, 0, srcY, source.width, srcHeight, 0, 0, source.width, srcHeight);
    return slice;
}

/**
 * Renders marked sections (`[data-pdf-block]`) one after another with page breaks between
 * sections instead of slicing one tall screenshot (avoids cutting rows in half).
 */
function drawBrandLogo(pdf, logo, x, y, maxWidthMm, maxHeightMm, align = "left") {
    if (!logo?.dataUrl) return;
    const ratio = logo.width / Math.max(logo.height, 1);
    let h = maxHeightMm;
    let w = h * ratio;
    if (w > maxWidthMm) {
        w = maxWidthMm;
        h = w / ratio;
    }
    const drawX = align === "right" ? x - w : x;
    const drawY = y + (maxHeightMm - h) / 2;
    pdf.addImage(logo.dataUrl, "PNG", drawX, drawY, w, h, undefined, "FAST");
}

function drawPdfHeaderFooter(pdf, options, pageNum, totalPages, layout, runningHeaderText = "", logos = null) {
    const { marginX, headerInsetMm, footerInsetMm, skipBrandLogos } = layout;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentLeft = marginX;
    const contentRight = marginX;
    const contentTop = headerInsetMm;
    const contentBottom = footerInsetMm;
    const currentDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const footerLineY = pageHeight - contentBottom + 3;
    const footerTextY = pageHeight - contentBottom + 7.5;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, contentTop, "F");
    pdf.rect(0, pageHeight - contentBottom, pageWidth, contentBottom, "F");

    const logoBandTop = skipBrandLogos ? Math.max(4, contentTop / 2 - 2) : HEADER_LOGO_TOP_MM;
    const logoMaxHeight = HEADER_LOGO_HEIGHT_MM;
    const logoMaxWidth = 48;

    if (!skipBrandLogos) {
        // Branded logos on every page: left + right of the header band,
        // with standard spacing above the logos and below them before the content.
        drawBrandLogo(pdf, logos?.left, contentLeft, logoBandTop, logoMaxWidth, logoMaxHeight, "left");
        drawBrandLogo(pdf, logos?.right, pageWidth - contentRight, logoBandTop, logoMaxWidth, logoMaxHeight, "right");
    }

    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.2);
    pdf.line(contentLeft, contentTop - 3, pageWidth - contentRight, contentTop - 3);
    pdf.line(contentLeft, footerLineY, pageWidth - contentRight, footerLineY);

    if (runningHeaderText) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 48, 73);
        const sideReserve = skipBrandLogos ? 0 : 2 * (logoMaxWidth + 6);
        const maxHeaderWidth = pageWidth - contentLeft - contentRight - sideReserve;
        const headerLines = pdf.splitTextToSize(runningHeaderText, Math.max(maxHeaderWidth, 40));
        pdf.text(headerLines, pageWidth / 2, logoBandTop + logoMaxHeight / 2 + 1, { align: "center" });
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text(currentDate, contentLeft + 2, footerTextY);
    if (!options.skipBuiltInFooter) {
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - contentRight - 2, footerTextY, { align: "right" });
    }
}

async function downloadPdfPaginatedByBlocks(root, fileName, onComplete, options) {
    const layout = resolveLayout(options);
    const { marginX, headerInsetMm, footerInsetMm } = layout;
    const blockScale = options.blockScale ?? 2;
    const jpegQuality = options.jpegQuality ?? 0.85;
    const minJpegQuality = options.minJpegQuality ?? 0.5;
    const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_BYTES;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    const blockGapMm = options.blockGapMm ?? BLOCK_GAP_MM;
    const imageCompression = options.imageCompression ?? "FAST";
    const contentWidthRatio = Math.min(1, Math.max(0.5, options.contentWidthRatio ?? 1));

    const blocks = getTopLevelPdfBlocks(root);
    const captureConcurrency = options.captureConcurrency ?? 2;
    const perBlockByteCap = Math.max(
        options.sliceByteBudget ?? 0,
        Math.floor((targetMaxBytes / Math.max(blocks.length, 1)) * 1.15)
    );

    if (blocks.length === 0) {
        return downloadPdfSingleCanvas(root, fileName, onComplete, options);
    }

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentLeft = marginX;
    const contentRight = marginX;
    const availableWidth = pageWidth - contentLeft - contentRight;
    const contentTop = headerInsetMm;
    const contentBottom = footerInsetMm;
    const availableHeight = pageHeight - contentTop - contentBottom;

    let cursorY = contentTop;
    let pageCount = 1;

    const ensureSpace = (neededMm) => {
        if (cursorY + neededMm <= pageHeight - contentBottom) return;
        pdf.addPage();
        pageCount += 1;
        cursorY = contentTop;
    };

    const runningHeaderText =
        options.runningHeaderText ||
        (options.useRunningHeader ? root.getAttribute("data-pdf-form-title") || "" : "");

    const capturedBlocks = await mapWithConcurrency(
        blocks,
        (block) => captureElement(block, { scale: blockScale, jpegQuality }),
        captureConcurrency
    );

    // Keep one consistent scale for the whole document and center each block horizontally.
    const rootCssWidth = Math.max(root.offsetWidth || 0, root.clientWidth || 0, 1);
    const mmPerCssPx = availableWidth / rootCssWidth;

    blocks.forEach((block, blockIndex) => {
        const { canvas } = capturedBlocks[blockIndex];
        const blockCssWidth = canvas.width / blockScale;
        const imgWidth = Math.min(
            availableWidth * contentWidthRatio,
            blockCssWidth * mmPerCssPx * contentWidthRatio
        );
        const imgX = contentLeft + (availableWidth - imgWidth) / 2;
        const imgHeightMm = (canvas.height * imgWidth) / canvas.width;

        if (block.hasAttribute("data-pdf-break-before") && cursorY > contentTop + 0.5) {
            pdf.addPage();
            pageCount += 1;
            cursorY = contentTop;
        }

        if (imgHeightMm <= availableHeight) {
            ensureSpace(imgHeightMm + blockGapMm);
            const imgData = canvasToJpeg(canvas, jpegQuality, perBlockByteCap, minJpegQuality);
            pdf.addImage(imgData, "JPEG", imgX, cursorY, imgWidth, imgHeightMm, undefined, imageCompression);
            cursorY += imgHeightMm + blockGapMm;
            return;
        }

        if (options.fitBlockToPage) {
            const fit = availableHeight / imgHeightMm;
            const fittedW = imgWidth * fit;
            const fittedH = availableHeight;
            const xOff = contentLeft + (availableWidth - fittedW) / 2;
            ensureSpace(fittedH + blockGapMm);
            const imgData = canvasToJpeg(canvas, jpegQuality, perBlockByteCap, minJpegQuality);
            pdf.addImage(imgData, "JPEG", xOff, cursorY, fittedW, fittedH, undefined, imageCompression);
            cursorY += fittedH + blockGapMm;
            return;
        }

        // Tall block: slice at page boundaries (kept within one section)
        const pxPerMm = canvas.height / imgHeightMm;
        const pageSlicePx = Math.floor(availableHeight * pxPerMm);
        let srcY = 0;

        while (srcY < canvas.height) {
            const remainingPx = canvas.height - srcY;
            const slicePx = Math.min(pageSlicePx, remainingPx);
            const sliceHeightMm = slicePx / pxPerMm;

            if (srcY > 0) {
                pdf.addPage();
                pageCount += 1;
                cursorY = contentTop;
            } else {
                ensureSpace(sliceHeightMm);
            }

            const sliceCanvas = cropCanvasSlice(canvas, srcY, slicePx);
            const imgData = canvasToJpeg(sliceCanvas, jpegQuality, perBlockByteCap, minJpegQuality);
            pdf.addImage(imgData, "JPEG", imgX, cursorY, imgWidth, sliceHeightMm, undefined, imageCompression);
            srcY += slicePx;
            cursorY = contentTop + sliceHeightMm;
        }
        cursorY += blockGapMm;
    });

    const logos = layout.skipBrandLogos ? null : await loadBrandLogos();
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
        pdf.setPage(p);
        drawPdfHeaderFooter(pdf, options, p, totalPages, layout, runningHeaderText, logos);
    }

    warnIfOversized(pdf, maxOutputBytes);

    pdf.save(`${fileName}.pdf`);
    if (onComplete) onComplete();
}

async function downloadPdfSingleCanvas(root, fileName, onComplete, options) {
    const { onePageOnly = false } = options;
    const layout = resolveLayout(options);
    const { marginX, headerInsetMm, footerInsetMm } = layout;
    const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_BYTES;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    const { scale, jpegQuality } = pickCaptureOptions(root, {
        scale: options.blockScale,
        jpegQuality: options.jpegQuality,
    });

    const { width, height } = captureDimensions(root);
    const canvas = await html2canvas(root, {
        useCORS: true,
        allowTaint: false,
        scale,
        logging: false,
        backgroundColor: "#ffffff",
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        onclone: html2canvasOnClone,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentLeft = marginX;
    const contentRight = marginX;
    const availableWidth = pageWidth - contentLeft - contentRight;
    const contentTop = headerInsetMm;
    const contentBottom = footerInsetMm;
    const availableHeight = pageHeight - contentTop - contentBottom;

    let imgWidth = availableWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (onePageOnly && imgHeight > availableHeight) {
        const r = availableHeight / imgHeight;
        imgHeight = availableHeight;
        imgWidth *= r;
    }

    const merged = applyOrphanPageMerge(imgWidth, imgHeight, availableHeight, onePageOnly);
    imgWidth = merged.imgWidth;
    imgHeight = merged.imgHeight;
    const forceSinglePage = merged.singlePage;

    const imgData = canvasToJpeg(canvas, jpegQuality, targetMaxBytes);
    const totalPages = forceSinglePage ? 1 : Math.max(1, Math.ceil(imgHeight / availableHeight));

    const xPos = contentLeft + (availableWidth - imgWidth) / 2;
    const yStart = contentTop;

    const logos = layout.skipBrandLogos ? null : await loadBrandLogos();

    pdf.addImage(imgData, "JPEG", xPos, yStart, imgWidth, imgHeight, undefined, "FAST");
    drawPdfHeaderFooter(pdf, options, 1, totalPages, layout, "", logos);

    if (!forceSinglePage && !onePageOnly) {
        let heightLeft = imgHeight - availableHeight;
        let currentPage = 2;
        while (heightLeft > 0) {
            const yPos = contentTop - availableHeight * (currentPage - 1);
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", xPos, yPos, imgWidth, imgHeight, undefined, "FAST");
            drawPdfHeaderFooter(pdf, options, currentPage, totalPages, layout, "", logos);
            heightLeft -= availableHeight;
            currentPage += 1;
        }
    }

    warnIfOversized(pdf, maxOutputBytes);

    pdf.save(`${fileName}.pdf`);
    if (onComplete) onComplete();
}

/**
 * @param {object} [options]
 * @param {boolean} [options.paginateBlocks] - Capture each `[data-pdf-block]` as its own unit (clean page breaks)
 * @param {number} [options.blockScale] - html2canvas scale for block mode (default 2)
 * @param {number} [options.jpegQuality] - JPEG quality 0–1 (default 0.85 in block mode)
 * @param {number} [options.targetMaxBytes] - Soft size target per slice (~2 MB default)
 * @param {number} [options.maxOutputBytes] - Warn if final PDF exceeds this (default 5 MB)
 * @param {boolean} [options.skipBuiltInFooter] - Omit "Page x of y"
 * @param {boolean} [options.skipBrandLogos] - Omit left/right branded header logos (also auto from ?hideHeaderLogos=true)
 */
export const downloadPdfFromRef = async (printRef, fileName = "document", onComplete = null, options = {}) => {
    if (!printRef?.current) {
        console.error("No print reference provided for PDF generation.");
        return;
    }

    const resolvedOptions = withResolvedPdfOptions(options);

    try {
        if (!resolvedOptions.skipPreCaptureWaits) {
            await inlineImagesForPdfCapture(printRef.current, resolvedOptions.imageShrinkOpts);
            await waitForImages(printRef.current, 8000, resolvedOptions);
            await waitForChart(printRef.current, resolvedOptions.chartWaitTimeoutMs ?? 2000);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }

        const root = printRef.current;
        const useBlocks =
            resolvedOptions.paginateBlocks === true ||
            (resolvedOptions.paginateBlocks !== false && getTopLevelPdfBlocks(root).length > 0);

        if (useBlocks) {
            await downloadPdfPaginatedByBlocks(root, fileName, onComplete, resolvedOptions);
        } else {
            await downloadPdfSingleCanvas(root, fileName, onComplete, resolvedOptions);
        }
    } catch (err) {
        console.error("PDF generation failed:", err);
        if (onComplete) onComplete(err);
    }
};
