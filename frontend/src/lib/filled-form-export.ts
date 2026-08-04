import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import {
  AlignmentType,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

export type PdfExportOptions = {
  /** Scale the whole form onto a single A4 page (used for toolbox talks). */
  fitSinglePage?: boolean;
};

export type WordVisualExportOptions = {
  fitSinglePage?: boolean;
  title?: string;
};

/**
 * Trigger a real browser file download. Delays revoking the object URL so
 * Chrome/Safari don't cancel the download before it starts (common with .docx).
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const safeName = (filename || "download").replace(/[/\\?%*:|"<>]/g, "-").trim();
  const typed =
    blob.type && blob.type !== "application/octet-stream"
      ? blob
      : new Blob([blob], {
          type: safeName.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

  // Legacy Edge
  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (b: Blob, n: string) => boolean;
  };
  if (typeof nav.msSaveOrOpenBlob === "function") {
    nav.msSaveOrOpenBlob(typed, safeName);
    return;
  }

  const url = URL.createObjectURL(typed);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.style.display = "none";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
  );
  // Keep the blob URL alive until the browser has started the download.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

/** @deprecated use triggerBrowserDownload */
function triggerDownload(blob: Blob, filename: string) {
  triggerBrowserDownload(blob, filename);
}

export function safeDownloadBasename(name: string) {
  const cleaned = name.replace(/[^\w.\- ]+/g, "_").trim() || "filled-form";
  return cleaned.slice(0, 120);
}

/** Replace cream/amber signature backgrounds with white in a data-URL image. */
function whitenSignatureDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = image.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] ?? 0;
          const g = d[i + 1] ?? 0;
          const b = d[i + 2] ?? 0;
          const isCream =
            r >= 245 && g >= 235 && b >= 200 && b <= 250 && r >= g && g >= b - 5;
          if (isCream) {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = 255;
          }
        }
        ctx.putImageData(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function isLogoImage(img: HTMLImageElement) {
  const alt = (img.getAttribute("alt") || "").toLowerCase();
  if (alt.includes("logo")) return true;
  if (alt.includes("signature")) return false;
  const parent = img.parentElement;
  const parentText = (parent?.textContent || "").toLowerCase();
  if (parentText.includes("upload logo") || parentText.includes("left logo")) return true;
  // Header logo cells are typically the first/last cells of the top table.
  const td = img.closest("td");
  const tr = td?.parentElement;
  const table = td?.closest("table");
  if (!td || !tr || !table) return false;
  const cells = Array.from(tr.children);
  const idx = cells.indexOf(td);
  return idx === 0 || idx === cells.length - 1;
}

/** Ensure uploaded logos stay visible and sized correctly in PDF/Word captures. */
function prepareLogosForExport(root: HTMLElement) {
  root.querySelectorAll("img").forEach((imgEl) => {
    const img = imgEl as HTMLImageElement;
    if (!isLogoImage(img)) return;
    const src = img.getAttribute("src") || "";
    if (!src) return;
    img.style.display = "block";
    img.style.margin = "4px auto";
    img.style.maxHeight = "72px";
    img.style.maxWidth = "118px";
    img.style.width = "auto";
    img.style.height = "auto";
    img.style.objectFit = "contain";
    img.style.background = "#ffffff";
    img.style.backgroundColor = "#ffffff";
    img.style.opacity = "1";
    img.style.visibility = "visible";
    // Prevent parent amber/edit styles from washing out logos.
    const wrap = img.parentElement as HTMLElement | null;
    if (wrap) {
      wrap.style.background = "#ffffff";
      wrap.style.backgroundColor = "#ffffff";
      wrap.style.minHeight = "80px";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
    }
  });
}

/** Turn native checkboxes into bordered tick boxes html2canvas can see. */
function flattenCheckboxesForExport(root: HTMLElement) {
  root.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    const cb = input as HTMLInputElement;
    const box = document.createElement("span");
    const checked = cb.checked;
    box.textContent = checked ? "✓" : "";
    box.setAttribute(
      "style",
      [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:14px",
        "height:14px",
        "border:1.5px solid #000000",
        "box-sizing:border-box",
        "font-size:11px",
        "font-weight:700",
        "line-height:1",
        "vertical-align:middle",
        checked ? "background:#1e293b;color:#ffffff" : "background:#ffffff;color:#000000",
      ].join(";"),
    );
    cb.replaceWith(box);
  });
}

/** Apply black table/form borders like Site SHEQ downloads. */
function applyBlackBordersForExport(root: HTMLElement) {
  root.style.border = "2px solid #000000";
  root.style.boxSizing = "border-box";

  root.querySelectorAll("table").forEach((table) => {
    const t = table as HTMLElement;
    t.style.borderCollapse = "collapse";
    t.style.width = "100%";
    t.style.tableLayout = "fixed";
    t.style.border = "1px solid #000000";
  });

  root.querySelectorAll("th, td").forEach((cell) => {
    const elCell = cell as HTMLElement;
    elCell.style.border = "1px solid #000000";
    elCell.style.borderColor = "#000000";
    elCell.style.verticalAlign = elCell.style.verticalAlign || "middle";
  });

  // Section title bars / chrome dividers
  root.querySelectorAll<HTMLElement>("div, h2, h3, section").forEach((el) => {
    const cls = el.getAttribute("class") || "";
    if (/border-b|border-t|border-neutral|border-black/i.test(cls)) {
      if (/border-b/i.test(cls)) el.style.borderBottom = "1px solid #000000";
      if (/border-t/i.test(cls)) el.style.borderTop = "1px solid #000000";
      if (/border-2/i.test(cls) || /border-neutral-800/i.test(cls)) {
        el.style.borderColor = "#000000";
      }
    }
    if (/bg-neutral-100|font-semibold/i.test(cls) && /border-b/i.test(cls)) {
      el.style.backgroundColor = "#e5e5e5";
      el.style.color = "#111111";
      el.style.fontWeight = "700";
      el.style.borderBottom = "1px solid #000000";
    }
  });
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
    ),
  );
}

function compactSafeStartForExport(root: HTMLElement) {
  const form = root.querySelector<HTMLElement>(".safe-start-doc");
  if (!form) return;

  form.style.fontSize = "11px";
  form.querySelectorAll<HTMLElement>("th, td, p, div, label, span, input, textarea").forEach(
    (el) => {
      const pad = el.style.padding || getComputedStyle(el).padding;
      if (pad && pad !== "0px") {
        el.style.padding = "3px 5px";
      }
      if (/min-h-/i.test(el.getAttribute("class") || "")) {
        el.style.minHeight = "28px";
      }
    },
  );

  // Shrink hazard image row and signature pads so the whole form fits one A4 page.
  form.querySelectorAll<HTMLElement>("td .flex.h-16, .h-16").forEach((el) => {
    el.style.height = "44px";
    el.style.minHeight = "44px";
  });
  form.querySelectorAll("canvas").forEach((canvas) => {
    const el = canvas as HTMLElement;
    el.style.height = "36px";
    el.style.maxHeight = "36px";
  });
  form.querySelectorAll<HTMLElement>("textarea, input").forEach((el) => {
    el.style.minHeight = "26px";
    if (el.tagName === "TEXTAREA") {
      el.style.minHeight = "40px";
    }
  });
}

/** Tighten Site SHEQ layout so PDF/Word keeps tables readable without mid-row cuts. */
function compactSiteSheqForExport(form: HTMLElement | null) {
  if (!form) return;
  form.style.fontSize = "11px";
  form.style.lineHeight = "1.25";
  form.querySelectorAll("table").forEach((table) => {
    const t = table as HTMLElement;
    t.style.borderCollapse = "collapse";
    t.style.width = "100%";
    t.style.tableLayout = "fixed";
    t.style.border = "1px solid #000000";
  });
  form.querySelectorAll<HTMLElement>("th, td").forEach((el) => {
    el.style.padding = "4px 5px";
    el.style.border = "1px solid #000000";
    el.style.borderColor = "#000000";
  });
  form.querySelectorAll<HTMLElement>("input, textarea, select, div").forEach((el) => {
    if (/min-h-/i.test(el.getAttribute("class") || "")) {
      el.style.minHeight = "24px";
    }
  });
  form.querySelectorAll("textarea").forEach((el) => {
    (el as HTMLElement).style.minHeight = "40px";
  });
  // Section titles readable in capture
  form.querySelectorAll<HTMLElement>("div").forEach((el) => {
    const cls = el.getAttribute("class") || "";
    if (/bg-neutral-100|font-semibold/i.test(cls) && /border-b/i.test(cls)) {
      el.style.backgroundColor = "#e5e5e5";
      el.style.color = "#111111";
      el.style.fontWeight = "700";
      el.style.borderBottom = "1px solid #000000";
    }
  });
}

/** Keep SHEQ service/installation tables intact in PDF/Word capture. */
function compactSheqScoredReportForExport(form: HTMLElement | null) {
  if (!form) return;
  form.style.fontSize = "11px";
  form.style.lineHeight = "1.3";
  form.style.width = "100%";

  form.querySelectorAll(".pdf-hide").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });

  form.querySelectorAll("table").forEach((table) => {
    const t = table as HTMLElement;
    t.style.borderCollapse = "collapse";
    t.style.width = "100%";
    t.style.tableLayout = "fixed";
    t.style.pageBreakInside = "auto";
  });

  form.querySelectorAll<HTMLElement>("th, td").forEach((el) => {
    const cls = `${el.getAttribute("class") || ""} ${el.parentElement?.getAttribute("class") || ""}`;
    el.style.border = "1px solid #000000";
    el.style.borderColor = "#000000";
    el.style.padding = el.tagName === "TH" ? "4px 5px" : "3px 5px";
    el.style.verticalAlign = "top";
    el.style.wordBreak = "break-word";
    el.style.overflowWrap = "anywhere";
    el.style.lineHeight = "1.25";

    // Restore SHEQ table header / total colours after generic export tinting.
    if (cls.includes("bg-[#003B5C]")) {
      el.style.backgroundColor = "#003B5C";
      el.style.color = "#ffffff";
      el.style.fontWeight = "700";
    } else if (cls.includes("bg-[#DCEAF3]")) {
      el.style.backgroundColor = "#DCEAF3";
      el.style.color = "#111111";
      el.style.fontWeight = "700";
    } else if (cls.includes("bg-[#C5E6F3]")) {
      el.style.backgroundColor = "#C5E6F3";
      el.style.color = "#003B5C";
      el.style.fontWeight = "700";
    } else if (cls.includes("bg-[#A9DCF0]")) {
      el.style.backgroundColor = "#A9DCF0";
    } else if (cls.includes("bg-[#D7EEF7]")) {
      el.style.backgroundColor = "#D7EEF7";
      el.style.color = "#003B5C";
      el.style.fontWeight = "700";
    } else if (cls.includes("bg-red-100")) {
      el.style.backgroundColor = "#fee2e2";
    } else if (cls.includes("bg-red-50")) {
      el.style.backgroundColor = "#fef2f2";
    } else if (cls.includes("bg-neutral-50")) {
      el.style.backgroundColor = "#fafafa";
    }
  });

  form.querySelectorAll("tr").forEach((tr) => {
    (tr as HTMLElement).style.pageBreakInside = "avoid";
    (tr as HTMLElement).style.breakInside = "avoid";
  });

  // One section photo only — keep it readable but not page-dominating.
  form.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const alt = (img.getAttribute("alt") || "").toLowerCase();
    if (alt.includes("section") && alt.includes("photo")) {
      img.style.maxHeight = "160px";
      img.style.maxWidth = "280px";
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.display = "block";
    }
  });

  form.querySelectorAll("textarea, input").forEach((el) => {
    const node = el as HTMLElement;
    node.style.minHeight = el.tagName === "TEXTAREA" ? "28px" : "24px";
    node.style.background = "#ffffff";
    node.style.padding = "2px 4px";
  });

  // H&S status pills — restore solid selected colours wiped by generic button strip.
  const hsColors: Record<string, { bg: string; border: string; fg: string }> = {
    GREEN: { bg: "#059669", border: "#047857", fg: "#ffffff" },
    AMBER: { bg: "#F59E0B", border: "#D97706", fg: "#ffffff" },
    RED: { bg: "#DC2626", border: "#B91C1C", fg: "#ffffff" },
  };
  form.querySelectorAll<HTMLElement>("[data-hs-status]").forEach((btn) => {
    const status = (btn.getAttribute("data-hs-status") || "").toUpperCase();
    const selected = btn.getAttribute("data-hs-selected") === "true";
    const colors = hsColors[status];
    if (!colors) return;
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.gap = "8px";
    btn.style.borderRadius = "9999px";
    btn.style.borderWidth = "2px";
    btn.style.borderStyle = "solid";
    btn.style.padding = "8px 12px";
    btn.style.fontWeight = "700";
    btn.style.fontSize = "13px";
    if (selected) {
      btn.style.background = colors.bg;
      btn.style.backgroundColor = colors.bg;
      btn.style.borderColor = colors.border;
      btn.style.color = colors.fg;
    } else {
      btn.style.background = "#ffffff";
      btn.style.backgroundColor = "#ffffff";
      btn.style.borderColor =
        status === "GREEN" ? "#6EE7B7" : status === "AMBER" ? "#FCD34D" : "#FCA5A5";
      btn.style.color =
        status === "GREEN" ? "#065F46" : status === "AMBER" ? "#92400E" : "#991B1B";
    }
  });

  // Compliance dashboard chrome + bars — keep colours/layout for PDF/Word.
  form.querySelectorAll<HTMLElement>("[data-sheq-compliance-dashboard]").forEach((dash) => {
    dash.style.background = "#ffffff";
    dash.style.backgroundColor = "#ffffff";

    dash.querySelectorAll<HTMLElement>("[data-export-keep-together]").forEach((block) => {
      block.style.pageBreakInside = "avoid";
      block.style.breakInside = "avoid";
    });

    // Slightly tighten summary so it fits one page with the form header above.
    dash.querySelectorAll<HTMLElement>(".p-4").forEach((el) => {
      el.style.padding = "10px 12px";
      el.style.gap = "10px";
    });

    dash.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const cls = el.getAttribute("class") || "";
      if (cls.includes("bg-[#003B5C]")) {
        el.style.backgroundColor = "#003B5C";
        el.style.color = "#ffffff";
        el.style.fontWeight = "700";
      } else if (cls.includes("bg-[#F8FAFC]")) {
        el.style.backgroundColor = "#F8FAFC";
      } else if (cls.includes("bg-[#F1F5F9]")) {
        el.style.backgroundColor = "#F1F5F9";
      } else if (cls.includes("bg-neutral-100")) {
        el.style.backgroundColor = "#f5f5f5";
      }
      if (cls.includes("text-[#003B5C]")) {
        el.style.color = "#003B5C";
      }
    });

    // Keep bar tracks clipping so fills render as solid bars in html2canvas.
    dash.querySelectorAll<HTMLElement>("[data-dist-track]").forEach((track) => {
      track.style.overflow = "hidden";
      track.style.height = "14px";
      track.style.backgroundColor = track.style.backgroundColor || "#f5f5f5";
      track.style.border = track.style.border || "1px solid rgba(0,0,0,0.1)";
      track.style.borderRadius = "2px";
    });
    dash.querySelectorAll<HTMLElement>("[data-dist-fill]").forEach((fill) => {
      const w = fill.style.width;
      const bg = fill.style.backgroundColor;
      if (w) fill.style.width = w;
      if (bg) fill.style.backgroundColor = bg;
      fill.style.height = "100%";
      fill.style.display = "block";
    });
  });
}

/** Replace <select> with static score text so PDF/Word capture shows A/B/C clearly. */
function flattenSelectsForExport(root: HTMLElement) {
  root.querySelectorAll("select").forEach((select) => {
    const el = select as HTMLSelectElement;
    const value = el.value || "";
    const label =
      el.options[el.selectedIndex]?.text?.trim() ||
      value ||
      " ";
    const replacement = document.createElement("div");
    replacement.textContent = value || " ";
    const scoreStyle =
      value === "A" || value === "3"
        ? "background:#dcfce7;color:#14532d"
        : value === "B" || value === "2"
          ? "background:#fef9c3;color:#713f12"
          : value === "C" || value === "1"
            ? "background:#fee2e2;color:#7f1d1d"
            : value === "NA" || value === "N/A" || value === "NIU"
              ? "background:#f1f5f9;color:#334155"
              : "background:#ffffff;color:#404040";
    replacement.setAttribute(
      "style",
      [
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "min-height:40px",
        "width:100%",
        "font-weight:700",
        "font-size:13px",
        scoreStyle,
      ].join(";"),
    );
    replacement.setAttribute("title", label);
    el.replaceWith(replacement);
  });
}

async function prepareNodeForExport(node: HTMLElement) {
  node.style.overflow = "visible";
  node.style.height = "auto";
  node.style.maxHeight = "none";
  node.style.opacity = "1";
  node.style.position = "static";
  node.style.background = "#ffffff";
  node.style.backgroundColor = "#ffffff";

  // Prevent overflow wrappers (e.g. LOLER overflow-x-auto) from clipping table bottoms.
  node.querySelectorAll<HTMLElement>("*").forEach((el) => {
    // Keep compliance bar tracks clipped so fills render correctly in PDF/Word.
    if (
      el.hasAttribute("data-dist-track") ||
      (el.closest("[data-sheq-compliance-dashboard]") &&
        (el.classList.contains("h-4") || el.classList.contains("overflow-hidden")))
    ) {
      return;
    }
    const style = getComputedStyle(el);
    if (
      style.overflow === "hidden" ||
      style.overflow === "auto" ||
      style.overflow === "scroll" ||
      style.overflowX === "auto" ||
      style.overflowX === "scroll" ||
      style.overflowY === "hidden"
    ) {
      el.style.overflow = "visible";
      el.style.overflowX = "visible";
      el.style.overflowY = "visible";
    }
    if (style.maxHeight !== "none" && style.maxHeight !== "0px") {
      el.style.maxHeight = "none";
    }
  });

  node.querySelectorAll("button").forEach((btn) => {
    const elBtn = btn as HTMLButtonElement;
    // Preserve H&S status pills (GREEN / AMBER / RED) for PDF/Word.
    if (elBtn.dataset.hsStatus) {
      elBtn.style.boxShadow = "none";
      elBtn.style.outline = "none";
      elBtn.style.cursor = "default";
      return;
    }
    // Keep logo upload buttons as plain containers; strip chrome only.
    elBtn.style.border = "none";
    elBtn.style.background = "transparent";
    elBtn.style.boxShadow = "none";
    elBtn.style.outline = "none";
    elBtn.style.cursor = "default";
    elBtn.style.padding = elBtn.querySelector("img") ? "4px" : "0";
  });

  node.querySelectorAll(".pdf-hide").forEach((hidden) => {
    (hidden as HTMLElement).style.display = "none";
  });

  // Hide edit-only controls (Remove logo, Upload hints) but keep logo images.
  node.querySelectorAll("button").forEach((btn) => {
    const elBtn = btn as HTMLButtonElement;
    if (elBtn.dataset.hsStatus) return;
    const text = (btn.textContent || "").trim().toLowerCase();
    if (text === "remove" || text.includes("upload logo")) {
      const hasImg = Boolean(btn.querySelector("img"));
      if (!hasImg) elBtn.style.display = "none";
    }
  });

  // Only strip edit-tint amber (e.g. bg-amber-50), not H&S status / dashboard.
  node.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.closest("[data-hs-status]") || el.closest("[data-sheq-compliance-dashboard]")) {
      return;
    }
    const className = el.getAttribute("class") || "";
    if (/\bbg-amber-50\b/i.test(className) || /\bbg-amber-100\/?\d*\b/i.test(className)) {
      el.style.background = "#ffffff";
      el.style.backgroundColor = "#ffffff";
    }
  });

  applyBlackBordersForExport(node);

  node.querySelectorAll("th, td").forEach((cell) => {
    const elCell = cell as HTMLElement;
    const className = elCell.getAttribute("class") || "";
    const parentClass = elCell.parentElement?.getAttribute("class") || "";
    const combined = `${className} ${parentClass}`;

    // Apply header colours from cell or parent row (tr often holds bg/text classes).
    if (/bg-slate-700|bg-slate-800|bg-sky-700|bg-sky-800/i.test(combined)) {
      elCell.style.backgroundColor = /bg-sky-800/i.test(combined)
        ? "#075985"
        : /bg-sky-700/i.test(combined)
          ? "#0369a1"
          : /bg-slate-800/i.test(combined)
            ? "#1e293b"
            : "#334155";
      elCell.style.color = "#ffffff";
      return;
    }

    const keepTint =
      /bg-(green|yellow|red|sky|slate|amber|orange|emerald|blue)-/i.test(combined) ||
      /text-(green|yellow|red|sky|white)/i.test(combined);
    if (!keepTint) {
      if (elCell.tagName === "TH") {
        elCell.style.backgroundColor = "#e5e5e5";
        elCell.style.color = "#111111";
      } else if (!elCell.querySelector("img")) {
        // Don't force white over logo cells that already have white from prepareLogos.
        if (!elCell.style.backgroundColor || elCell.style.backgroundColor === "transparent") {
          elCell.style.backgroundColor = "#ffffff";
        }
      }
    }
  });

  const isSiteSheq = Boolean(node.querySelector(".site-sheq-doc"));
  if (isSiteSheq) {
    compactSiteSheqForExport(node.querySelector(".site-sheq-doc") as HTMLElement);
  }

  const sheqScored = node.querySelector(".sheq-scored-report-doc") as HTMLElement | null;
  if (sheqScored || node.classList.contains("sheq-scored-report-doc")) {
    compactSheqScoredReportForExport(
      sheqScored || (node.classList.contains("sheq-scored-report-doc") ? node : null),
    );
  }

  node.querySelectorAll("img[alt='Presenter signature']").forEach((img) => {
    const wrap = img.parentElement as HTMLElement | null;
    if (wrap) {
      wrap.style.border = "none";
      wrap.style.background = "transparent";
      wrap.style.boxShadow = "none";
      wrap.style.minHeight = "64px";
    }
  });

  compactSafeStartForExport(node);
  flattenSelectsForExport(node);
  flattenCheckboxesForExport(node);
  prepareLogosForExport(node);

  // Whiten cream backgrounds on signatures only — never on logos.
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const el = img as HTMLImageElement;
      const src = el.getAttribute("src") || "";
      if (!src.startsWith("data:image")) return;
      if (isLogoImage(el)) {
        el.style.background = "#ffffff";
        el.style.backgroundColor = "#ffffff";
        return;
      }
      const alt = (el.getAttribute("alt") || "").toLowerCase();
      const looksLikeSignature =
        alt.includes("signature") ||
        /signature/i.test(el.closest("td,div,label")?.textContent || "");
      if (!looksLikeSignature) return;
      const clean = await whitenSignatureDataUrl(src);
      el.setAttribute("src", clean);
      el.style.background = "#ffffff";
      el.style.backgroundColor = "#ffffff";
    }),
  );

  await waitForImages(node);
}

type CapturedCanvas = HTMLCanvasElement & {
  __breakYs?: number[];
  __segmentBottoms?: number[];
  __segments?: { top: number; bottom: number }[];
};

/**
 * Atomic export units — each table row / standalone block.
 * Page cuts are allowed only after these bottoms (never mid-row).
 * Keep-together blocks (e.g. compliance dashboard) are a single unit.
 */
function collectSegmentsCss(root: HTMLElement): { top: number; bottom: number }[] {
  const rootRect = root.getBoundingClientRect();
  const segs: { top: number; bottom: number }[] = [];
  const keepTogetherSel = "[data-export-keep-together]";

  const pushEl = (el: Element) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.height < 1) return;
    const top = Math.round(rect.top - rootRect.top);
    const bottom = Math.round(rect.bottom - rootRect.top);
    if (bottom > top && bottom > 2) segs.push({ top, bottom });
  };

  const insideKeepTogether = (el: Element) => {
    const host = el.closest(keepTogetherSel);
    return Boolean(host && host !== el);
  };

  // Atomic keep-together blocks first (whole dashboard, notes groups, etc.).
  root.querySelectorAll(keepTogetherSel).forEach((el) => pushEl(el));

  root.querySelectorAll("tr").forEach((tr) => {
    if (insideKeepTogether(tr)) return;
    pushEl(tr);
  });

  root.querySelectorAll("[data-export-break]").forEach((el) => {
    if ((el as HTMLElement).tagName === "TR") return;
    if (el.closest("tr")) return;
    if (el.querySelector("tr")) return;
    if (insideKeepTogether(el)) return;
    // Outer keep-together nodes are already pushed above.
    if ((el as HTMLElement).matches?.(keepTogetherSel)) return;
    pushEl(el);
  });

  const doc =
    root.classList.contains("sheq-scored-report-doc")
      ? root
      : root.querySelector(".sheq-scored-report-doc");
  if (doc) {
    Array.from(doc.children).forEach((child) => {
      if ((child as HTMLElement).querySelector?.("tr")) return;
      if (insideKeepTogether(child)) return;
      if ((child as HTMLElement).matches?.(keepTogetherSel)) return;
      pushEl(child);
    });
  }

  segs.sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  // Drop nested segments contained inside a larger block (keeps dashboard whole).
  const unique: { top: number; bottom: number }[] = [];
  for (const seg of segs) {
    const containedInLarger = segs.some(
      (other) =>
        other !== seg &&
        other.top <= seg.top &&
        other.bottom >= seg.bottom &&
        other.bottom - other.top > seg.bottom - seg.top,
    );
    if (containedInLarger) continue;
    const prev = unique[unique.length - 1];
    if (prev && prev.top === seg.top && prev.bottom === seg.bottom) continue;
    unique.push(seg);
  }
  return unique;
}

/**
 * Pack segments into page end offsets. Never cuts mid-segment.
 * Avoids orphaning short header rows at the bottom of a page.
 * Keep-together blocks that don't fit in remaining space move to the next page
 * (never mid-sliced unless taller than a full page).
 */
function packPageEndYsFromSegments(
  segments: { top: number; bottom: number }[],
  totalHeight: number,
  pageHeight: number,
): number[] {
  const ends: number[] = [];
  if (pageHeight <= 0 || totalHeight <= 0) return ends;

  let pageStart = 0;
  let fitted = pageStart;
  const shortMax = Math.max(28, Math.round(pageHeight * 0.045));

  const flush = (y: number) => {
    const cut = Math.min(totalHeight, Math.max(pageStart + 1, y));
    if (cut > pageStart) ends.push(cut);
    pageStart = cut;
    fitted = pageStart;
  };

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    if (seg.bottom <= pageStart + 1) continue;

    const height = seg.bottom - seg.top;
    const fitsRemaining = seg.bottom - pageStart <= pageHeight;
    const fitsFullPage = height <= pageHeight;

    if (fitsRemaining) {
      const next = segments[i + 1];
      // Don't leave a short header alone at the page bottom.
      if (
        height <= shortMax &&
        next &&
        next.bottom - pageStart > pageHeight &&
        fitted > pageStart
      ) {
        flush(fitted);
        i -= 1;
        continue;
      }
      fitted = seg.bottom;
      continue;
    }

    // Doesn't fit in remaining space — finish current page and retry on a fresh one.
    if (fitted > pageStart) {
      flush(fitted);
      i -= 1;
      continue;
    }

    // Nothing else on this page, and segment is larger than a full page: forced chops.
    if (!fitsFullPage) {
      while (seg.bottom - pageStart > pageHeight) {
        flush(pageStart + pageHeight);
      }
      fitted = seg.bottom;
      continue;
    }

    // Segment fits a full page but pageStart is somehow mid-block — advance to its end.
    fitted = seg.bottom;
  }

  return ends;
}

/**
 * If a page slice cuts through open table column lines, stroke a closing
 * horizontal border so the table doesn't look unfinished.
 */
function sealOpenTableBottom(slice: HTMLCanvasElement) {
  const ctx = slice.getContext("2d", { willReadFrequently: true });
  if (!ctx || slice.height < 4) return;
  try {
    const y = slice.height - 2;
    const row = ctx.getImageData(0, y, slice.width, 1).data;
    let darkRuns = 0;
    let inDark = false;
    for (let x = 0; x < slice.width; x += 2) {
      const i = x * 4;
      const r = row[i] ?? 255;
      const g = row[i + 1] ?? 255;
      const b = row[i + 2] ?? 255;
      const dark = r < 100 && g < 100 && b < 100;
      if (dark && !inDark) {
        darkRuns += 1;
        inDark = true;
      } else if (!dark) {
        inDark = false;
      }
    }
    if (darkRuns < 3) return;
  } catch {
    return;
  }
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(2, Math.round(slice.width / 400));
  ctx.beginPath();
  ctx.moveTo(0, slice.height - 1);
  ctx.lineTo(slice.width, slice.height - 1);
  ctx.stroke();
}

async function captureElement(el: HTMLElement): Promise<CapturedCanvas> {
  const mount = document.createElement("div");
  mount.setAttribute("aria-hidden", "true");
  mount.style.cssText =
    "position:fixed;left:0;top:0;width:794px;z-index:-1;opacity:0.01;pointer-events:none;background:#ffffff;overflow:visible;";
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.width = "794px";
  clone.style.maxWidth = "794px";
  clone.style.background = "#ffffff";
  clone.style.boxSizing = "border-box";
  mount.appendChild(clone);
  document.body.appendChild(mount);

  try {
    await prepareNodeForExport(clone);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const width = 794;
    clone.style.width = `${width}px`;
    clone.style.paddingBottom = "16px";

    const cssHeight = Math.max(
      clone.scrollHeight,
      clone.offsetHeight,
      Math.ceil(clone.getBoundingClientRect().height),
      1,
    );
    const segmentsCss = collectSegmentsCss(clone);
    const scale = 2;

    const canvas = (await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width,
      height: cssHeight,
      windowWidth: width,
      windowHeight: cssHeight,
      scrollX: 0,
      scrollY: 0,
    })) as CapturedCanvas;

    const expected = cssHeight * scale;
    const ratio =
      Math.abs(canvas.height - expected) <= scale * 4
        ? scale
        : canvas.height / Math.max(1, cssHeight);

    // Keep the row's bottom border on the same page.
    const borderFudge = Math.max(1, Math.round(ratio));
    canvas.__segments = segmentsCss.map((seg) => ({
      top: Math.max(0, Math.round(seg.top * ratio)),
      bottom: Math.min(canvas.height, Math.round(seg.bottom * ratio) + borderFudge),
    }));
    canvas.__segmentBottoms = canvas.__segments.map((s) => s.bottom);
    canvas.__breakYs = canvas.__segmentBottoms;
    return canvas;
  } finally {
    mount.remove();
  }
}

/** Slice a tall canvas into page-height chunks at segment bottoms only. */
function sliceCanvasPages(
  canvas: HTMLCanvasElement,
  pageHeightPx: number,
): HTMLCanvasElement[] {
  const segments = (canvas as CapturedCanvas).__segments;
  const segmentBottoms =
    (canvas as CapturedCanvas).__segmentBottoms ??
    (canvas as CapturedCanvas).__breakYs ??
    [];

  const pageH = Math.max(1, Math.floor(pageHeightPx));
  let pageEnds =
    segments && segments.length > 0
      ? packPageEndYsFromSegments(segments, canvas.height, pageH)
      : segmentBottoms.length > 0
        ? packPageEndYsFromSegments(
            segmentBottoms.map((b) => ({ top: b - 1, bottom: b })),
            canvas.height,
            pageH,
          )
        : [];

  if (pageEnds.length === 0 && canvas.height > pageH) {
    for (let y = pageH; y < canvas.height; y += pageH) pageEnds.push(y);
  }

  const cuts = [0, ...pageEnds];
  if (cuts[cuts.length - 1]! < canvas.height) cuts.push(canvas.height);

  const pages: HTMLCanvasElement[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const top = cuts[i]!;
    const bottom = cuts[i + 1]!;
    if (bottom <= top) continue;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.ceil(bottom - top));
    const ctx = slice.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, -top);
    sealOpenTableBottom(slice);
    pages.push(slice);
  }

  return pages.length > 0 ? pages : [canvas];
}

/** PDF from a rendered form element. Toolbox / RAMS / Safe Start use fitSinglePage. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {},
) {
  const canvas = await captureElement(element);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isSafeStart = Boolean(
    element.classList?.contains("safe-start-doc") ||
      element.querySelector?.(".safe-start-doc"),
  );
  // Tighter margins for Safe Start so the full form fits one A4 page more clearly.
  const margin = options.fitSinglePage && isSafeStart ? 5 : options.fitSinglePage ? 6 : 8;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const footerReserve = options.fitSinglePage ? 6 : 8;
  const usableHeight = pageHeight - margin * 2 - footerReserve;

  if (options.fitSinglePage) {
    let imgWidth = usableWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;
    if (imgHeight > usableHeight) {
      const scale = usableHeight / imgHeight;
      imgHeight = usableHeight;
      imgWidth = imgWidth * scale;
    }
    const x = margin + (usableWidth - imgWidth) / 2;
    const y = margin + Math.max(0, (usableHeight - imgHeight) / 2);
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      x,
      y,
      imgWidth,
      imgHeight,
      undefined,
      "FAST",
    );
    // Guarantee a single page even if the library added extras.
    while (pdf.getNumberOfPages() > 1) {
      pdf.deletePage(pdf.getNumberOfPages());
    }
  } else {
    const isSheqScored = Boolean(
      element.classList?.contains("sheq-scored-report-doc") ||
        element.querySelector?.(".sheq-scored-report-doc"),
    );
    const imgWidthMm = usableWidth;
    // Slightly shorter page body so row bottoms never collide with the footer.
    const heightFactor = isSheqScored ? 0.96 : 1;
    const pageHeightPx =
      ((usableHeight * heightFactor) * canvas.width) / imgWidthMm;
    const pages = sliceCanvasPages(canvas, pageHeightPx);

    pages.forEach((slice, index) => {
      if (index > 0) pdf.addPage();
      const sliceHeightMm = (slice.height * imgWidthMm) / canvas.width;
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        margin,
        margin,
        imgWidthMm,
        sliceHeightMm,
        undefined,
        "FAST",
      );
    });
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text(`Page ${i} of ${total}`, pageWidth / 2, pageHeight - 6, {
      align: "center",
    });
  }

  const blob = pdf.output("blob");
  triggerDownload(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

function downscaleCanvas(
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);
  if (scale >= 0.999) return canvas;
  const page = document.createElement("canvas");
  page.width = Math.max(1, Math.round(canvas.width * scale));
  page.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = page.getContext("2d");
  if (!ctx) throw new Error("Unable to prepare Word page");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.drawImage(canvas, 0, 0, page.width, page.height);
  return page;
}

/** JPEG is smaller/more reliable than PNG for large form captures in .docx. */
function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.82): string {
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    throw new Error("Unable to encode form image for Word");
  }
}

/**
 * Build a visual .docx blob that matches the on-screen filled form.
 */
export async function buildElementAsWordVisualBlob(
  element: HTMLElement,
  filename: string,
  options: WordVisualExportOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const canvas = await captureElement(element);
  if (!canvas.width || !canvas.height) {
    throw new Error("Form capture was empty — try again");
  }

  const wordImageWidthPx = 620;
  const a4UsableHeightPx = Math.round((wordImageWidthPx * 297) / 210) - 48;

  let pageCanvases: HTMLCanvasElement[];
  if (options.fitSinglePage) {
    // Keep a readable single page without blowing Word's image size limits.
    pageCanvases = [
      downscaleCanvas(canvas, wordImageWidthPx * 2.2, a4UsableHeightPx * 2.4),
    ];
  } else {
    const pageHeightPx = (a4UsableHeightPx * canvas.width) / wordImageWidthPx;
    pageCanvases = sliceCanvasPages(canvas, pageHeightPx).map((slice) =>
      downscaleCanvas(slice, wordImageWidthPx * 2.2, a4UsableHeightPx * 2.2),
    );
  }

  if (pageCanvases.length === 0) {
    throw new Error("Unable to prepare Word pages");
  }

  const safeTitle = (options.title || "Filled form").slice(0, 80);
  const children: Paragraph[] = [];
  for (let i = 0; i < pageCanvases.length; i += 1) {
    const slice = pageCanvases[i];
    if (!slice) continue;
    const dataUrl = canvasToJpegDataUrl(slice);
    const displayWidth = wordImageWidthPx;
    const displayHeight = Math.max(
      40,
      Math.min(
        1000,
        Math.round((slice.height * displayWidth) / slice.width),
      ),
    );
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, before: 0, line: 240 },
        children: [
          new ImageRun({
            type: "jpg",
            data: dataUrl,
            transformation: { width: displayWidth, height: displayHeight },
            altText: {
              name: `form-page-${i + 1}`,
              title: safeTitle,
              description: `Page ${i + 1} of filled form`,
            },
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "Sitemate",
    title: safeTitle,
    description: "Exported filled site pack form",
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 864, left: 720 },
            pageNumbers: { start: 1 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 18, color: "666666" }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: "666666",
                  }),
                  new TextRun({ text: " of ", size: 18, color: "666666" }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: "666666",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  if (!blob || blob.size < 64) {
    throw new Error("Word file was empty — try Download Word again");
  }
  const outName = filename.endsWith(".docx")
    ? filename
    : `${filename.replace(/\.doc$/i, "")}.docx`;
  return { blob, filename: outName };
}

/** Build visual Word blob then trigger browser download. */
export async function downloadElementAsWordVisual(
  element: HTMLElement,
  filename: string,
  options: WordVisualExportOptions = {},
) {
  const { blob, filename: outName } = await buildElementAsWordVisualBlob(
    element,
    filename,
    options,
  );
  triggerBrowserDownload(blob, outName);
}
