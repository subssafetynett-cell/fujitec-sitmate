import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_TARGET_BYTES = 2 * 1024 * 1024;
const ORPHAN_PAGE_FRACTION = 0.28;
const BLOCK_GAP_MM = 2;

function getTopLevelPdfBlocks(root) {
    const all = Array.from(root.querySelectorAll("[data-pdf-block]"));
    return all.filter((el) => {
        let parent = el.parentElement;
        while (parent && parent !== root) {
            if (parent.hasAttribute("data-pdf-block")) return false;
            parent = parent.parentElement;
        }
        return el.offsetWidth > 0 && el.offsetHeight > 0;
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

function waitForImages(root, timeoutMs = 8000) {
    if (!root) return Promise.resolve();
    const imgs = Array.from(root.querySelectorAll("img")).filter((img) => img.getAttribute("src"));
    if (imgs.length === 0) return Promise.resolve();

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
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
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
    const style = _document.createElement("style");
    style.textContent = `
        [data-pdf-block] { break-inside: avoid !important; page-break-inside: avoid !important; }
        .pdf-hide-on-export { display: none !important; }
        .pdf-export-root { padding: 12px !important; }
        .pdf-export-root [data-pdf-block] { margin-bottom: 0 !important; }
        [data-pdf-chart] .recharts-wrapper,
        [data-pdf-chart] .recharts-surface,
        [data-pdf-chart] svg { overflow: visible !important; }
        .pdf-header-logo { display: block !important; margin-left: auto !important; margin-right: auto !important; }
    `;
    _document.head.appendChild(style);
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

function canvasToJpeg(canvas, quality, targetMaxBytes) {
    let q = quality;
    let data = canvas.toDataURL("image/jpeg", q);
    const cap = targetMaxBytes * 0.55;
    while (q >= 0.5 && data.length > cap) {
        q -= 0.05;
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
async function downloadPdfPaginatedByBlocks(root, fileName, onComplete, options) {
    const { marginX, headerInsetMm, footerInsetMm } = resolveLayout(options);
    const blockScale = options.blockScale ?? 2;
    const jpegQuality = options.jpegQuality ?? 0.85;
    const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_BYTES;
    const blockGapMm = options.blockGapMm ?? BLOCK_GAP_MM;

    const blocks = getTopLevelPdfBlocks(root);
    const captureConcurrency = options.captureConcurrency ?? 2;

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

    const capturedBlocks = await mapWithConcurrency(
        blocks,
        (block) => captureElement(block, { scale: blockScale, jpegQuality }),
        captureConcurrency
    );

    for (const { canvas } of capturedBlocks) {
        const imgWidth = availableWidth;
        const imgHeightMm = (canvas.height * imgWidth) / canvas.width;

        if (imgHeightMm <= availableHeight) {
            ensureSpace(imgHeightMm + blockGapMm);
            const imgData = canvasToJpeg(canvas, jpegQuality, targetMaxBytes);
            pdf.addImage(imgData, "JPEG", contentLeft, cursorY, imgWidth, imgHeightMm, undefined, "FAST");
            cursorY += imgHeightMm + blockGapMm;
            continue;
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
            const imgData = canvasToJpeg(sliceCanvas, jpegQuality, targetMaxBytes);
            pdf.addImage(imgData, "JPEG", contentLeft, cursorY, imgWidth, sliceHeightMm, undefined, "FAST");
            srcY += slicePx;
            cursorY = contentTop + sliceHeightMm;
        }
        cursorY += blockGapMm;
    }

    const currentDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const footerLineY = pageHeight - contentBottom + 4;
    const footerTextY = pageHeight - contentBottom + 8.5;
    const totalPages = pdf.getNumberOfPages();

    for (let p = 1; p <= totalPages; p += 1) {
        pdf.setPage(p);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, contentTop, "F");
        pdf.rect(0, pageHeight - contentBottom, pageWidth, contentBottom, "F");
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.2);
        pdf.line(contentLeft, contentTop - 0.5, pageWidth - contentRight, contentTop - 0.5);
        pdf.line(contentLeft, footerLineY, pageWidth - contentRight, footerLineY);
        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text(currentDate, contentLeft + 2, footerTextY);
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth - contentRight - 2, footerTextY, { align: "right" });
    }

    const out = pdf.output("arraybuffer");
    if (out.byteLength > MAX_OUTPUT_BYTES) {
        console.warn(
            `PDF output is ${(out.byteLength / (1024 * 1024)).toFixed(2)} MB (cap ${MAX_OUTPUT_BYTES / (1024 * 1024)} MB).`
        );
    }

    pdf.save(`${fileName}.pdf`);
    if (onComplete) onComplete();
}

async function downloadPdfSingleCanvas(root, fileName, onComplete, options) {
    const { onePageOnly = false } = options;
    const { marginX, headerInsetMm, footerInsetMm } = resolveLayout(options);
    const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_BYTES;

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

    const currentDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const footerLineY = pageHeight - contentBottom + 4;
    const footerTextY = pageHeight - contentBottom + 8.5;

    const drawHeaderFooter = (pageNum) => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, contentTop, "F");
        pdf.rect(0, pageHeight - contentBottom, pageWidth, contentBottom, "F");
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.2);
        pdf.line(contentLeft, contentTop - 0.5, pageWidth - contentRight, contentTop - 0.5);
        pdf.line(contentLeft, footerLineY, pageWidth - contentRight, footerLineY);
        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text(currentDate, contentLeft + 2, footerTextY);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - contentRight - 2, footerTextY, { align: "right" });
    };

    const xPos = contentLeft + (availableWidth - imgWidth) / 2;
    const yStart = contentTop;

    pdf.addImage(imgData, "JPEG", xPos, yStart, imgWidth, imgHeight, undefined, "FAST");
    drawHeaderFooter(1);

    if (!forceSinglePage && !onePageOnly) {
        let heightLeft = imgHeight - availableHeight;
        let currentPage = 2;
        while (heightLeft > 0) {
            const yPos = contentTop - availableHeight * (currentPage - 1);
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", xPos, yPos, imgWidth, imgHeight, undefined, "FAST");
            drawHeaderFooter(currentPage);
            heightLeft -= availableHeight;
            currentPage += 1;
        }
    }

    const out = pdf.output("arraybuffer");
    if (out.byteLength > MAX_OUTPUT_BYTES) {
        console.warn(
            `PDF output is ${(out.byteLength / (1024 * 1024)).toFixed(2)} MB (cap ${MAX_OUTPUT_BYTES / (1024 * 1024)} MB).`
        );
    }

    pdf.save(`${fileName}.pdf`);
    if (onComplete) onComplete();
}

/**
 * @param {object} [options]
 * @param {boolean} [options.paginateBlocks] - Capture each `[data-pdf-block]` as its own unit (clean page breaks)
 * @param {number} [options.blockScale] - html2canvas scale for block mode (default 2)
 * @param {number} [options.jpegQuality] - JPEG quality 0–1 (default 0.85 in block mode)
 * @param {number} [options.targetMaxBytes] - Soft size target per slice (~2 MB default)
 */
export const downloadPdfFromRef = async (printRef, fileName = "document", onComplete = null, options = {}) => {
    if (!printRef?.current) {
        console.error("No print reference provided for PDF generation.");
        return;
    }

    try {
        await waitForImages(printRef.current);
        await waitForChart(printRef.current);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

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
