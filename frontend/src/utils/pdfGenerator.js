import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TARGET_BYTES = 2 * 1024 * 1024;
const ORPHAN_PAGE_FRACTION = 0.28;
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
    const chartRoot = root?.querySelector?.("[data-pdf-chart]");
    if (!chartRoot) return Promise.resolve();

    const started = Date.now();
    return new Promise((resolve) => {
        const tick = () => {
            const svg = chartRoot.querySelector("svg");
            const hasBars =
                svg &&
                (svg.querySelector(".recharts-bar-rectangle") ||
                    svg.querySelector("path.recharts-rectangle") ||
                    svg.querySelector(".recharts-layer.recharts-bar"));
            if (hasBars || Date.now() - started >= timeoutMs) {
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
        if (s.startsWith("/")) {
            img.setAttribute("src", `${window.location.origin}${s}`);
        }
    });
}

function html2canvasOnClone(_document, clonedElement) {
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
        .concern-pdf-export h1,
        .concern-pdf-export input,
        .concern-pdf-export div,
        .concern-pdf-export label,
        .concern-pdf-export p,
        .concern-pdf-export textarea {
            font-weight: inherit !important;
        }
        .concern-pdf-export .concern-report-header,
        .concern-pdf-export .pdf-header.concern-report-header {
            display: block !important;
            position: relative !important;
        }
        .concern-pdf-export .concern-header-logo-slot {
            position: absolute !important;
            top: 0 !important;
            right: 0 !important;
            z-index: 1 !important;
        }
        .concern-pdf-export .concern-header-title {
            text-align: center !important;
            width: 100% !important;
            padding: 0 200px 0 16px !important;
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
        .concern-pdf-export .pdf-logo-box {
            width: auto !important;
            min-width: 180px !important;
            max-width: 240px !important;
            height: auto !important;
            min-height: 64px !important;
            max-height: 96px !important;
            overflow: visible !important;
            padding: 4px 10px !important;
            flex-shrink: 0 !important;
        }
        .concern-pdf-export .pdf-header-logo {
            display: block !important;
            max-height: 84px !important;
            max-width: 220px !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin-left: auto !important;
            margin-right: 0 !important;
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

function applyOrphanPageMerge(imgWidth, imgHeight, availableWidth, availableHeight, onePageOnly) {
    if (onePageOnly) return { imgWidth, imgHeight, singlePage: true };
    if (imgHeight <= availableHeight) return { imgWidth, imgHeight, singlePage: true };

    const fullPages = Math.floor(imgHeight / availableHeight);
    const remainder = imgHeight - fullPages * availableHeight;
    const pagesIfSplit = Math.ceil(imgHeight / availableHeight);

    if (pagesIfSplit === 2 && remainder > 0 && remainder < availableHeight * ORPHAN_PAGE_FRACTION) {
        const fit = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
        return {
            imgWidth: imgWidth * fit,
            imgHeight: imgHeight * fit,
            singlePage: true,
        };
    }

    return { imgWidth, imgHeight, singlePage: false };
}

function resolveLayout(options) {
    const marginX = options.marginX !== undefined ? options.marginX : 12;
    const legacyY = options.marginY;
    const headerInsetMm =
        options.headerInsetMm !== undefined ? options.headerInsetMm : legacyY !== undefined ? legacyY : 11;
    const footerInsetMm =
        options.footerInsetMm !== undefined ? options.footerInsetMm : legacyY !== undefined ? legacyY : 13;
    return { marginX, headerInsetMm, footerInsetMm };
}

async function captureElement(element, captureOpts) {
    const { scale, jpegQuality } = pickCaptureOptions(element, captureOpts);
    const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: false,
        scale,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
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
function drawPdfHeaderFooter(pdf, options, pageNum, totalPages, layout, runningHeaderText = "") {
    if (options.skipBuiltInFooter) return;

    const { marginX, headerInsetMm, footerInsetMm } = layout;
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
    const footerLineY = pageHeight - contentBottom + 4;
    const footerTextY = pageHeight - contentBottom + 8.5;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, contentTop, "F");
    pdf.rect(0, pageHeight - contentBottom, pageWidth, contentBottom, "F");
    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.2);
    pdf.line(contentLeft, contentTop - 0.5, pageWidth - contentRight, contentTop - 0.5);
    pdf.line(contentLeft, footerLineY, pageWidth - contentRight, footerLineY);

    if (runningHeaderText) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 48, 73);
        const maxHeaderWidth = pageWidth - contentLeft - contentRight - 4;
        const headerLines = pdf.splitTextToSize(runningHeaderText, maxHeaderWidth);
        pdf.text(headerLines, pageWidth / 2, 6.5, { align: "center" });
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text(currentDate, contentLeft + 2, footerTextY);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - contentRight - 2, footerTextY, { align: "right" });
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

    blocks.forEach((block, blockIndex) => {
        const { canvas } = capturedBlocks[blockIndex];
        const imgWidth = availableWidth;
        const imgHeightMm = (canvas.height * imgWidth) / canvas.width;

        if (block.hasAttribute("data-pdf-break-before") && cursorY > contentTop + 0.5) {
            pdf.addPage();
            pageCount += 1;
            cursorY = contentTop;
        }

        if (imgHeightMm <= availableHeight) {
            ensureSpace(imgHeightMm + blockGapMm);
            const imgData = canvasToJpeg(canvas, jpegQuality, perBlockByteCap, minJpegQuality);
            pdf.addImage(imgData, "JPEG", contentLeft, cursorY, imgWidth, imgHeightMm, undefined, imageCompression);
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
            pdf.addImage(imgData, "JPEG", contentLeft, cursorY, imgWidth, sliceHeightMm, undefined, imageCompression);
            srcY += slicePx;
            cursorY = contentTop + sliceHeightMm;
        }
        cursorY += blockGapMm;
    });

    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
        pdf.setPage(p);
        drawPdfHeaderFooter(pdf, options, p, totalPages, layout, runningHeaderText);
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

    const canvas = await html2canvas(root, {
        useCORS: true,
        allowTaint: false,
        scale,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: root.scrollWidth,
        windowHeight: root.scrollHeight,
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

    const merged = applyOrphanPageMerge(imgWidth, imgHeight, availableWidth, availableHeight, onePageOnly);
    imgWidth = merged.imgWidth;
    imgHeight = merged.imgHeight;
    const forceSinglePage = merged.singlePage;

    const imgData = canvasToJpeg(canvas, jpegQuality, targetMaxBytes);
    const totalPages = forceSinglePage ? 1 : Math.max(1, Math.ceil(imgHeight / availableHeight));

    const xPos = contentLeft + (availableWidth - imgWidth) / 2;
    const yStart = contentTop;

    pdf.addImage(imgData, "JPEG", xPos, yStart, imgWidth, imgHeight, undefined, "FAST");
    drawPdfHeaderFooter(pdf, options, 1, totalPages, layout);

    if (!forceSinglePage && !onePageOnly) {
        let heightLeft = imgHeight - availableHeight;
        let currentPage = 2;
        while (heightLeft > 0) {
            const yPos = contentTop - availableHeight * (currentPage - 1);
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", xPos, yPos, imgWidth, imgHeight, undefined, "FAST");
            drawPdfHeaderFooter(pdf, options, currentPage, totalPages, layout);
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
 * @param {boolean} [options.skipBuiltInFooter] - Omit generated date/page footer (form supplies its own)
 */
export const downloadPdfFromRef = async (printRef, fileName = "document", onComplete = null, options = {}) => {
    if (!printRef?.current) {
        console.error("No print reference provided for PDF generation.");
        return;
    }

    try {
        if (!options.skipPreCaptureWaits) {
            await waitForImages(printRef.current, 8000, options);
            await waitForChart(printRef.current, options.chartWaitTimeoutMs ?? 2000);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }

        const root = printRef.current;
        const useBlocks =
            options.paginateBlocks === true ||
            (options.paginateBlocks !== false && getTopLevelPdfBlocks(root).length > 0);

        if (useBlocks) {
            await downloadPdfPaginatedByBlocks(root, fileName, onComplete, options);
        } else {
            await downloadPdfSingleCanvas(root, fileName, onComplete, options);
        }
    } catch (err) {
        console.error("PDF generation failed:", err);
        if (onComplete) onComplete(err);
    }
};
