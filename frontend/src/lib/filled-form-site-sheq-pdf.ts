import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SitePackDocument } from "@/data/sheq";
import {
  safeDownloadBasename,
  triggerBrowserDownload,
} from "@/lib/filled-form-export";

const STANDARDS = [
  {
    title: "ST 1 – Work at Heights: Scaffolding & Edge protection",
    detail:
      "(scaffold structure, fall protection, car top, voids, protection from falling objects)",
  },
  {
    title: "ST 2 – Lifting Operations & Manual Handling",
    detail:
      "(Guide rails, RAMS, Sling/Platform/Doors, Control Panel, Hydraulic Unit, Lift Car – lifting technique, lifting equipment)",
  },
  {
    title: "ST 3 – Temporary Access",
    detail:
      "(Hoardings, Scaffold towers, ladders, step & podium ladders, protecting others)",
  },
  {
    title: "ST 4 – Electricity",
    detail:
      "(Temp electrical power & lighting, permanent electrical supply, safe working with electricity, PAT)",
  },
  {
    title: "ST 5 – Accessing / Egressing & Working in the Pit",
    detail: "(entrance protection, ladder, pit hazards)",
  },
  {
    title: "ST 6 – Working in Lift Shaft / LMR",
    detail: "(access/egress, fall protection, housekeeping, lift equipment)",
  },
  {
    title: "ST 7 – Housekeeping & Welfare",
    detail:
      "(site housekeeping standards, storage area and lift equipment protection, site welfare)",
  },
  {
    title: "ST 8 – Personal Protective Equipment",
    detail: "(quality & compliance, risk based provision, task PPE)",
  },
  {
    title: "ST 9 – Project Planning Documentation",
    detail:
      "(Risk review process, method statements / risk assessment, key permits & completion of records)",
  },
  {
    title: "ST 10 – Supervision & Project Management",
    detail:
      "(Supervision, training & competence, team m/s briefing, toolbox talks, improvement plan review)",
  },
  {
    title: "ST 11 – Site Welfare",
    detail: "(Canteen, Toilets, Drying Room, First Aid, Fire etc.)",
  },
  {
    title: "ST 12 – Occupational Health",
    detail:
      "(COSHH, HAVs, Noise, Dust, Dermatitis, Weils, Drugs & Alcohol, Stress / Mental Health, Asbestos)",
  },
  {
    title: "ST 13 – Tools & Equipment",
    detail: "(Hand tools, Portable power tools, lighting, HAVs, Noise, Dust)",
  },
  {
    title: "ST 14 – Fire, Accident & Near Miss Reporting",
    detail:
      "(fire arrangements & procedures, escape procedures, first aid, accident reporting procedure, accident book, near miss cards)",
  },
  {
    title: "ST 15 – Environmental Management",
    detail:
      "(sustainability, pollution incident response, waste management, hazardous waste, nuisance)",
  },
  {
    title: "ST 16 – Quality Management",
    detail: "(Shaft survey, plumbing guiderails, plumbing doors, testing & commissioning)",
  },
  {
    title: "ST 17 – Hoardings",
    detail: "Hoardings installed securely, doors with locks & structurally robust",
  },
  {
    title: "ST 18 – Lift Motor Room",
    detail: "Safety signs, LOTO arrangements, oil resistant floors, safe working space etc.",
  },
  {
    title: "ST 19 – Lift Shaft & Pit",
    detail: "All fall risks protected, pits clean and free of water, oil, rubbish etc",
  },
  {
    title: "ST 20 – Site Requirements",
    detail:
      "Operatives following site requirements, policies and procedures including Hot Works Permits etc.",
  },
];

function scoreLabel(raw: string) {
  const v = (raw || "").toUpperCase();
  if (v === "Y") return "A";
  if (v === "N") return "C";
  if (v === "A" || v === "B" || v === "C" || v === "NA") return v === "NA" ? "N/A" : v;
  return "";
}

function scoreFill(raw: string) {
  const v = scoreLabel(raw);
  if (v === "A") return [220, 252, 231] as [number, number, number];
  if (v === "B") return [254, 249, 195] as [number, number, number];
  if (v === "C") return [254, 226, 226] as [number, number, number];
  if (v === "N/A") return [241, 245, 249] as [number, number, number];
  return [255, 255, 255] as [number, number, number];
}

function isTicked(value: string) {
  const v = (value || "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Draw a square checkbox (Helvetica cannot render ✓ reliably). */
function drawCheckbox(
  pdf: jsPDF,
  cx: number,
  cy: number,
  checked: boolean,
  size = 3.6,
) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  pdf.setLineWidth(0.35);
  pdf.setDrawColor(30, 30, 30);
  if (checked) {
    pdf.setFillColor(30, 41, 59);
    pdf.rect(x, y, size, size, "FD");
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.55);
    pdf.line(x + size * 0.18, y + size * 0.52, x + size * 0.4, y + size * 0.78);
    pdf.line(x + size * 0.4, y + size * 0.78, x + size * 0.82, y + size * 0.22);
  } else {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y, size, size, "FD");
  }
}

function drawCheckboxInCell(
  pdf: jsPDF,
  cell: { x: number; y: number; width: number; height: number },
  checked: boolean,
) {
  drawCheckbox(pdf, cell.x + cell.width / 2, cell.y + cell.height / 2, checked);
}

type PdfLogo = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  widthPx: number;
  heightPx: number;
};

/** Load uploaded/template logo into a format jsPDF can embed reliably. */
async function prepareLogoForPdf(src: string | undefined): Promise<PdfLogo | null> {
  if (!src || (!src.startsWith("data:image") && !/^https?:\/\//i.test(src) && !src.startsWith("/"))) {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 1;
        const h = img.naturalHeight || img.height || 1;
        const maxEdge = 600;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, format: "PNG", widthPx: cw, heightPx: ch });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawLogoInCell(
  pdf: jsPDF,
  logo: PdfLogo | null,
  cell: { x: number; y: number; width: number; height: number },
  pad = 1.5,
) {
  if (!logo) return;
  const maxW = Math.max(4, cell.width - pad * 2);
  const maxH = Math.max(4, cell.height - pad * 2);
  const aspect = logo.widthPx / Math.max(1, logo.heightPx);
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const x = cell.x + (cell.width - w) / 2;
  const y = cell.y + (cell.height - h) / 2;
  try {
    pdf.addImage(logo.dataUrl, logo.format, x, y, w, h, undefined, "FAST");
  } catch {
    // Ignore embed failures so the rest of the PDF still downloads.
  }
}

/**
 * Structured Site SHEQ PDF — black table borders, no mid-row page cuts.
 */
export async function downloadSiteSheqPdf(doc: SitePackDocument) {
  const form = doc.formData ?? {};
  const f = (key: string) => form[key] || "";
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const lastY = () =>
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 5;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 14) {
      pdf.addPage();
      y = margin;
    }
  };

  const sectionTitle = (text: string) => {
    ensureSpace(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(17, 17, 17);
    pdf.text(text, margin, y + 4);
    y += 7;
  };

  const [logoLeft, logoRight] = await Promise.all([
    prepareLogoForPdf(f("logoLeft")),
    prepareLogoForPdf(f("logoRight")),
  ]);

  // Header: left logo | title + date/doc/approved | right logo
  const logoColW = 28;
  const midW = contentW - logoColW * 2;
  const headerRowH = 24;

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: headerRowH,
    },
    body: [
      [
        { content: " ", styles: { cellWidth: logoColW, minCellHeight: headerRowH } },
        {
          content: "MANAGEMENT SITE INSPECTION REPORT",
          styles: {
            cellWidth: midW,
            minCellHeight: headerRowH,
            halign: "center",
            valign: "middle",
            fontStyle: "bold",
            fontSize: 11,
          },
        },
        { content: " ", styles: { cellWidth: logoColW, minCellHeight: headerRowH } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: logoColW },
      1: { cellWidth: midW },
      2: { cellWidth: logoColW },
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.row.index !== 0) return;
      if (data.column.index === 0) {
        drawLogoInCell(pdf, logoLeft, data.cell);
      } else if (data.column.index === 2) {
        drawLogoInCell(pdf, logoRight, data.cell);
      }
    },
  });
  y = lastY() - 2;

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: "middle",
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 55, fillColor: [243, 244, 246], fontStyle: "bold" },
      1: { cellWidth: contentW - 55 },
    },
    body: [
      ["Date", f("date") || "—"],
      ["Document No. & Rev", f("documentNo") || doc.documentNo || doc.code || "—"],
      ["Approved by", f("approvedBy") || doc.approvedBy || "—"],
      ["Name of Person conducting Inspection", f("inspector") || "—"],
      ["Job Title", f("inspectorJobTitle") || "—"],
      ["Project Name / Title", f("projectName") || "—"],
      ["Name of Principal Contractor", f("principalContractor") || "—"],
    ],
  });
  y = lastY();

  sectionTitle("SCOPE OF INSPECTION – LIFT INSTALLATIONS");
  const hs = f("hsStatus").toUpperCase();
  // Prefer explicit tick fields; fall back to selected H&S status.
  const statusTicks = {
    green: isTicked(f("hsStatusGreenTick")) || hs === "GREEN",
    amber: isTicked(f("hsStatusAmberTick")) || hs === "AMBER",
    red: isTicked(f("hsStatusRedTick")) || hs === "RED",
  };
  const distTicks = {
    installation: isTicked(f("dist_installation_director")),
    sheq: isTicked(f("dist_sheq_advisor")),
    principal: isTicked(f("dist_principal_contractor")),
  };
  // Row → which status/dist tick cells (cols 1 and 3) are checked.
  const scopeTickMap: Record<number, { status: boolean; dist: boolean }> = {
    0: { status: statusTicks.green, dist: distTicks.installation },
    1: { status: statusTicks.amber, dist: distTicks.sheq },
    2: { status: statusTicks.red, dist: distTicks.principal },
  };

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: "middle",
      overflow: "linebreak",
    },
    head: [
      [
        {
          content: "Project Summary – H&S status",
          colSpan: 2,
          styles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "Report Distribution",
          styles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "Tick",
          styles: {
            fillColor: [3, 105, 161],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ],
    ],
    body: [
      [
        {
          content:
            "      GREEN – PROJECT IN GOOD WELL MANAGED ORDER, WITH NO SIGNIFICANT STANDARDS ISSUES",
          styles: {
            fillColor: statusTicks.green ? [187, 247, 208] : [240, 253, 244],
            valign: "top",
          },
        },
        {
          content: " ",
          styles: {
            fillColor: statusTicks.green ? [187, 247, 208] : [240, 253, 244],
            halign: "center",
          },
        },
        { content: "Installation Director", styles: { fillColor: [240, 249, 255] } },
        {
          content: " ",
          styles: { fillColor: [240, 249, 255], halign: "center" },
        },
      ],
      [
        {
          content:
            "      AMBER – SUPPORT REVIEW GIVES CAUSE FOR CONCERN, WITH SITE STANDARDS ISSUES REQUIRING ATTENTION.\nACTION: Action plan within 3 working days (LEAD Project Manager with Project Supervisor)",
          styles: {
            fillColor: statusTicks.amber ? [253, 230, 138] : [254, 252, 232],
            valign: "top",
          },
        },
        {
          content: " ",
          styles: {
            fillColor: statusTicks.amber ? [253, 230, 138] : [254, 252, 232],
            halign: "center",
          },
        },
        { content: "SHEQ Advisor", styles: { fillColor: [240, 249, 255] } },
        {
          content: " ",
          styles: { fillColor: [240, 249, 255], halign: "center" },
        },
      ],
      [
        {
          content:
            "      RED – SUPPORT REVIEW GIVES SIGNIFICANT CAUSE FOR CONCERN DUE TO RISK ITEMS AND/OR ONGOING CONCERNS.\nACTION: Action plan within 3 working days (LEAD Project Manager, signed off by Installation Director)",
          styles: {
            fillColor: statusTicks.red ? [254, 202, 202] : [254, 242, 242],
            valign: "top",
          },
        },
        {
          content: " ",
          styles: {
            fillColor: statusTicks.red ? [254, 202, 202] : [254, 242, 242],
            halign: "center",
          },
        },
        { content: "Principal Contractor", styles: { fillColor: [240, 249, 255] } },
        {
          content: " ",
          styles: { fillColor: [240, 249, 255], halign: "center" },
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: contentW * 0.52 },
      1: { cellWidth: contentW * 0.08 },
      2: { cellWidth: contentW * 0.28 },
      3: { cellWidth: contentW * 0.12 },
    },
    rowPageBreak: "avoid",
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const flags = scopeTickMap[data.row.index];
      if (!flags) return;
      // Inline checkbox beside status text (matches on-screen form).
      if (data.column.index === 0) {
        drawCheckbox(
          pdf,
          data.cell.x + 3.2,
          data.cell.y + 4.2,
          flags.status,
          3.2,
        );
      } else if (data.column.index === 1) {
        drawCheckboxInCell(pdf, data.cell, flags.status);
      } else if (data.column.index === 3) {
        drawCheckboxInCell(pdf, data.cell, flags.dist);
      }
    },
  });
  y = lastY();

  sectionTitle("SITE HEALTH & SAFETY PERFORMANCE MEASURES: SCORING");
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      overflow: "linebreak",
    },
    body: [
      [
        {
          content: "A – GOOD STANDARD – Correct standard and/or approach in place",
          styles: { fillColor: [220, 252, 231], fontStyle: "bold" },
        },
      ],
      [
        {
          content:
            "B – BASIC-STANDARD – moderate improvement sought (without high potential for injury)",
          styles: { fillColor: [254, 249, 195], fontStyle: "bold" },
        },
      ],
      [
        {
          content:
            "C – SUBSTANDARD – site condition with high potential for injury / below requirements",
          styles: { fillColor: [254, 226, 226], fontStyle: "bold" },
        },
      ],
    ],
    columnStyles: { 0: { cellWidth: contentW } },
    rowPageBreak: "avoid",
  });
  y = lastY() - 1;

  const stdBody = STANDARDS.map((std, i) => {
    const raw = f(`st_${i + 1}_compliant`);
    const score = scoreLabel(raw);
    const comments = f(`st_${i + 1}_comments`);
    return [
      { content: `${std.title}\n${std.detail}`, styles: { fontStyle: "normal" as const } },
      {
        content: score || " ",
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          fontSize: 11,
          fillColor: scoreFill(raw),
        },
      },
      comments || " ",
    ];
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      valign: "top",
      overflow: "linebreak",
    },
    head: [
      [
        {
          content: "STANDARD",
          styles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "SCORE\nA / B / C",
          styles: {
            fillColor: [3, 105, 161],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
        {
          content: "Comments / Correction Actions",
          styles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold" },
        },
      ],
    ],
    body: stdBody,
    columnStyles: {
      0: { cellWidth: contentW * 0.48 },
      1: { cellWidth: contentW * 0.12, halign: "center" },
      2: { cellWidth: contentW * 0.4 },
    },
    // Keep each standard row whole — never split mid-cell across pages.
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });
  y = lastY();

  sectionTitle("COMMENTS / ACTIONS");
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      overflow: "linebreak",
      minCellHeight: 16,
    },
    body: [[f("commentsActions") || " "]],
    columnStyles: { 0: { cellWidth: contentW } },
    rowPageBreak: "avoid",
  });
  y = lastY();

  sectionTitle("ACTIONS REQUIRED");
  const actionBody = Array.from({ length: 7 }, (_, i) => [
    f(`site_sheq_action_${i}_actions_required`) || " ",
    f(`site_sheq_action_${i}_by_who`) || " ",
    f(`site_sheq_action_${i}_by_when`) || " ",
    f(`site_sheq_action_${i}_date_closed`) || " ",
  ]);

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [17, 17, 17],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 8,
    },
    head: [
      [
        {
          content: "Actions Required",
          styles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "By Who",
          styles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "By When",
          styles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
        {
          content: "Date Closed",
          styles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
      ],
    ],
    body: actionBody,
    columnStyles: {
      0: { cellWidth: contentW * 0.4 },
      1: { cellWidth: contentW * 0.2 },
      2: { cellWidth: contentW * 0.2 },
      3: { cellWidth: contentW * 0.2 },
    },
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text(`Page ${i} of ${total}`, pageW / 2, pageH - 6, { align: "center" });
  }

  const blob = pdf.output("blob");
  const filename = `${safeDownloadBasename(doc.name || "site-sheq")}.pdf`;
  triggerBrowserDownload(blob, filename);
}
