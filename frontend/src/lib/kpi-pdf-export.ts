import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type OhsPdfRow = {
  indicator: string;
  months: Record<string, string>;
  target: string;
  unit: string;
  higherIsBetter: boolean;
  ytd: number;
  variance: number | null;
  variancePct: number | null;
  onTrack: boolean | null;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const SUCCESS: [number, number, number] = [22, 130, 90];
const SUCCESS_BG: [number, number, number] = [220, 245, 230];
const DANGER: [number, number, number] = [180, 40, 40];
const DANGER_BG: [number, number, number] = [255, 230, 230];
const HEADER: [number, number, number] = [15, 55, 95];

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatSigned(value: number): string {
  const abs = formatNumber(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return "0";
}

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    onclone: (clonedDoc, cloned) => {
      cloned.querySelectorAll(".pdf-hide").forEach((node) => {
        (node as HTMLElement).style.display = "none";
      });
      clonedDoc.querySelectorAll("svg").forEach((svg) => {
        (svg as SVGElement).setAttribute("xmlns", "http://www.w3.org/2000/svg");
      });
      // Avoid clipped overflow during capture
      (cloned as HTMLElement).style.overflow = "visible";
      (cloned as HTMLElement).style.height = "auto";
    },
  });
}

/** Place a captured image on the PDF, starting a new page when needed. No canvas slicing. */
function addImageFitPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  margin: number,
  startY?: number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  let imgWidth = usableWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Scale down to fit a single page if needed
  if (imgHeight > maxHeight) {
    const scale = maxHeight / imgHeight;
    imgHeight = maxHeight;
    imgWidth = imgWidth * scale;
  }

  let y = startY ?? margin;
  const remaining = pageHeight - y - margin;
  if (remaining < imgHeight + 4) {
    pdf.addPage();
    y = margin;
  }

  // Center horizontally if scaled down
  const x = margin + (usableWidth - imgWidth) / 2;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight, undefined, "FAST");
  return y + imgHeight + 8;
}

async function addSectionsToPdf(
  pdf: jsPDF,
  root: HTMLElement,
  margin: number,
  startY: number,
): Promise<void> {
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>("[data-pdf-section]"),
  );

  const targets = sections.length > 0 ? sections : [root];
  let y = startY;

  for (const section of targets) {
    // Give charts a moment to settle layout before capture
    const canvas = await captureElement(section);
    y = addImageFitPage(pdf, canvas, margin, y);
  }
}

function applyTrackColors(
  data: {
    section: string;
    column: { index: number };
    row: { index: number };
    cell: { raw?: unknown; styles: Record<string, unknown> };
  },
  rows: OhsPdfRow[],
  columns: number[],
) {
  if (data.section !== "body") return;
  if (!columns.includes(data.column.index)) return;

  const row = rows[data.row.index];
  if (!row || row.onTrack === null) return;

  if (row.onTrack) {
    data.cell.styles.textColor = SUCCESS;
    data.cell.styles.fillColor = SUCCESS_BG;
    data.cell.styles.fontStyle = "bold";
  } else {
    data.cell.styles.textColor = DANGER;
    data.cell.styles.fillColor = DANGER_BG;
    data.cell.styles.fontStyle = "bold";
  }
}

export async function exportOhsReportPdf(options: {
  year: number;
  rows: OhsPdfRow[];
  chartRoot?: HTMLElement | null;
  filename?: string;
  title?: string;
  statsTitle?: string;
  scorecardTitle?: string;
  dashboardTitle?: string;
}) {
  const {
    year,
    rows,
    chartRoot,
    title = "Occupational Health & Safety Report",
    statsTitle = "Statistics",
    scorecardTitle = "Scorecard",
    dashboardTitle = "Dashboard",
  } = options;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const generatedAt = new Date().toLocaleString();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`Year: ${year}`, margin, 26);
  pdf.text(`Generated: ${generatedAt}`, margin, 32);
  pdf.setDrawColor(200);
  pdf.line(margin, 36, pageWidth - margin, 36);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(statsTitle, margin, 44);

  autoTable(pdf, {
    startY: 48,
    head: [["Indicator", ...MONTHS, "YTD"]],
    body: rows.map((row) => [
      row.indicator || "Untitled",
      ...MONTHS.map((m) => row.months[m] || "—"),
      formatNumber(row.ytd),
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      valign: "middle",
    },
    headStyles: {
      fillColor: HEADER,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      13: { fontStyle: "bold", halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  const statsEnd = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;

  let nextY = statsEnd + 12;
  if (nextY > pageHeight - 50) {
    pdf.addPage();
    nextY = 18;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(scorecardTitle, margin, nextY);

  autoTable(pdf, {
    startY: nextY + 4,
    head: [
      ["Indicator", "Target", "YTD", "Unit", "Better when", "Variance", "Variance %", "Status"],
    ],
    body: rows.map((row) => [
      row.indicator || "Untitled",
      row.target || "—",
      formatNumber(row.ytd),
      row.unit || "—",
      row.higherIsBetter ? "Higher" : "Lower",
      row.variance === null ? "—" : formatSigned(row.variance),
      row.variancePct === null ? "—" : `${formatSigned(row.variancePct)}%`,
      row.onTrack === null ? "Set target" : row.onTrack ? "On Track" : "Off Track",
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      valign: "middle",
      halign: "center",
    },
    headStyles: {
      fillColor: HEADER,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", halign: "left" },
      5: { fontStyle: "bold" },
      6: { fontStyle: "bold" },
      7: { fontStyle: "bold" },
    },
    didParseCell: (data) => {
      // Variance + Variance %
      applyTrackColors(data, rows, [5, 6]);

      // Status
      if (data.section === "body" && data.column.index === 7) {
        const value = String(data.cell.raw ?? "");
        if (value === "On Track") {
          data.cell.styles.textColor = SUCCESS;
          data.cell.styles.fillColor = SUCCESS_BG;
          data.cell.styles.fontStyle = "bold";
        } else if (value === "Off Track") {
          data.cell.styles.textColor = DANGER;
          data.cell.styles.fillColor = DANGER_BG;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  if (chartRoot) {
    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(`${dashboardTitle} · ${year}`, margin, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Dashboard charts for the selected year.", margin, 25);

    await addSectionsToPdf(pdf, chartRoot, margin, 30);
  }

  const filename = options.filename ?? `${title.replace(/\s+/g, "-")}-${year}.pdf`;
  pdf.save(filename);
}

export async function exportElementAsPdf(options: {
  element: HTMLElement;
  title: string;
  filename: string;
}) {
  const { element, title, filename } = options;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(title, margin, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 22);

  const sections = Array.from(element.querySelectorAll<HTMLElement>("[data-pdf-section]"));
  if (sections.length > 0) {
    await addSectionsToPdf(pdf, element, margin, 28);
  } else {
    const canvas = await captureElement(element);
    addImageFitPage(pdf, canvas, margin, 28);
  }

  pdf.save(filename);
}
