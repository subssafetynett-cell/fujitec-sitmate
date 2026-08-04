import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { SitePackDocument } from "@/data/sheq";
import {
  toolboxFromValues,
  type ToolboxTalkAttendee,
  type ToolboxTalkFormState,
} from "@/components/sheq/toolbox-talk-register";
import {
  safeDownloadBasename,
  triggerBrowserDownload,
} from "@/lib/filled-form-export";

const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const CONTENT_WIDTH = 10466;

const BLACK = { style: BorderStyle.SINGLE, size: 12, color: "000000" };
const BORDERS = { top: BLACK, bottom: BLACK, left: BLACK, right: BLACK };
const BLACK_BORDERS = BORDERS;

function p(
  value: string,
  opts?: { bold?: boolean; size?: number; center?: boolean; italics?: boolean; underline?: boolean; color?: string },
) {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: value || " ",
        ...(opts?.bold ? { bold: true } : {}),
        ...(opts?.italics ? { italics: true } : {}),
        ...(opts?.underline ? { underline: {} } : {}),
        size: opts?.size ?? 20,
        font: "Arial",
        color: opts?.color ?? "111111",
      }),
    ],
  });
}

function cell(
  children: Paragraph[],
  opts?: {
    width: number;
    shade?: string;
    columnSpan?: number;
    vAlign?: typeof VerticalAlign.CENTER;
    blackBorder?: boolean;
  },
) {
  return new TableCell({
    borders: opts?.blackBorder ? BLACK_BORDERS : BORDERS,
    ...(opts?.columnSpan ? { columnSpan: opts.columnSpan } : {}),
    width: { size: opts?.width ?? CONTENT_WIDTH, type: WidthType.DXA },
    verticalAlign: opts?.vAlign ?? VerticalAlign.CENTER,
    shading: { fill: opts?.shade ?? "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: children.length > 0 ? children : [p(" ")],
  });
}

function sheqCell(
  children: Paragraph[],
  opts: { width: number; shade?: string; columnSpan?: number },
) {
  return cell(children, { ...opts, blackBorder: true });
}

function labelValueRow(label: string, value: string, labelW = 3200) {
  return new TableRow({
    children: [
      cell([p(label, { bold: true, size: 18 })], {
        width: labelW,
        shade: "F3F4F6",
      }),
      cell([p(value || "—")], { width: CONTENT_WIDTH - labelW }),
    ],
  });
}

async function dataUrlToPngBytes(src: string): Promise<Uint8Array | null> {
  if (!src) return null;
  const isData = src.startsWith("data:image");
  const isHttp = /^https?:\/\//i.test(src);
  if (!isData && !isHttp) return null;
  try {
    const whitened = await whitenImageDataUrl(src);
    const res = await fetch(whitened);
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function whitenImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
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
          if (r >= 245 && g >= 235 && b >= 200 && b <= 250 && r >= g && g >= b - 5) {
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

async function imageParagraph(
  dataUrl: string | undefined,
  width: number,
  height: number,
  alt: string,
): Promise<Paragraph> {
  const bytes = dataUrl ? await dataUrlToPngBytes(dataUrl) : null;
  if (!bytes) return p(" ");
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 20 },
    children: [
      new ImageRun({
        type: "png",
        data: bytes,
        transformation: { width, height },
        altText: { name: alt, title: alt, description: alt },
      }),
    ],
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", size: 16, color: "666666", font: "Arial" }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: "666666",
            font: "Arial",
          }),
          new TextRun({ text: " of ", size: 16, color: "666666", font: "Arial" }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: "666666",
            font: "Arial",
          }),
        ],
      }),
    ],
  });
}

async function buildToolboxTalkDoc(form: ToolboxTalkFormState, title: string) {
  const logoLeft = await imageParagraph(form.logoLeft, 90, 70, "Left logo");
  const logoRight = await imageParagraph(form.logoRight, 90, 70, "Right logo");

  const leftW = 1400;
  const rightW = 1400;
  const midW = CONTENT_WIDTH - leftW - rightW;

  const headerTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftW, midW, rightW],
    rows: [
      new TableRow({
        children: [
          cell([logoLeft], { width: leftW, vAlign: VerticalAlign.CENTER }),
          cell(
            [
              p("TOOL BOX TALK REGISTER", { bold: true, size: 24, center: true }),
              p(`Date: ${form.date || "—"}`, { size: 18 }),
              p(`Document No. & Rev: ${form.documentNo || "—"}`, { size: 18 }),
              p(`Approved by: ${form.approvedBy || "—"}`, { size: 18 }),
            ],
            { width: midW },
          ),
          cell([logoRight], { width: rightW, vAlign: VerticalAlign.CENTER }),
        ],
      }),
    ],
  });

  // Cleaner: true nested tables for header meta (matches fill form)
  const metaInner = new Table({
    width: { size: midW, type: WidthType.DXA },
    columnWidths: [2400, midW - 2400],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: BORDERS,
            columnSpan: 2,
            width: { size: midW, type: WidthType.DXA },
            shading: { fill: "FFFFFF" },
            margins: { top: 80, bottom: 80, left: 60, right: 60 },
            children: [p("TOOL BOX TALK REGISTER", { bold: true, size: 24, center: true })],
          }),
        ],
      }),
      new TableRow({
        children: [
          cell([p("Date", { bold: true, size: 18 })], { width: 2400, shade: "F3F4F6" }),
          cell([p(form.date || "—")], { width: midW - 2400 }),
        ],
      }),
      new TableRow({
        children: [
          cell([p("Document No. & Rev", { bold: true, size: 18 })], {
            width: 2400,
            shade: "F3F4F6",
          }),
          cell([p(form.documentNo || "—")], { width: midW - 2400 }),
        ],
      }),
      new TableRow({
        children: [
          cell([p("Approved by", { bold: true, size: 18 })], {
            width: 2400,
            shade: "F3F4F6",
          }),
          cell([p(form.approvedBy || "—")], { width: midW - 2400 }),
        ],
      }),
    ],
  });

  const topTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftW, midW, rightW],
    rows: [
      new TableRow({
        children: [
          cell([logoLeft], { width: leftW, vAlign: VerticalAlign.CENTER }),
          new TableCell({
            borders: BORDERS,
            width: { size: midW, type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [metaInner],
          }),
          cell([logoRight], { width: rightW, vAlign: VerticalAlign.CENTER }),
        ],
      }),
    ],
  });

  void headerTable;

  const detailsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3200, CONTENT_WIDTH - 3200],
    rows: [
      labelValueRow("Name of Presenter", form.presenter),
      labelValueRow("Date", form.talkDate),
      labelValueRow("Site", form.site),
      labelValueRow("Tool Box Talk Topic", form.topic),
    ],
  });

  const intro = new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({
        text:
          "The undersigned have been fully briefed on the contents of the attached Tool Box Talk and will ensure they work to the agreed safe system of work in place at all times and shall raise any concerns directly with the Site Supervisor or Director.",
        font: "Arial",
        size: 18,
      }),
    ],
  });

  const colNum = 700;
  const colName = 3000;
  const colSig = 4200;
  const colDate = CONTENT_WIDTH - colNum - colName - colSig;

  const attendeeRows: TableRow[] = [
    new TableRow({
      children: [
        cell([p("#", { bold: true, center: true, size: 18 })], {
          width: colNum,
          shade: "E5E7EB",
        }),
        cell([p("Print Name", { bold: true, size: 18 })], {
          width: colName,
          shade: "E5E7EB",
        }),
        cell([p("Signature", { bold: true, size: 18 })], {
          width: colSig,
          shade: "E5E7EB",
        }),
        cell([p("Date", { bold: true, size: 18 })], {
          width: colDate,
          shade: "E5E7EB",
        }),
      ],
    }),
  ];

  for (let i = 0; i < form.attendees.length; i += 1) {
    const row: ToolboxTalkAttendee = form.attendees[i] ?? {
      name: "",
      signature: "",
      date: "",
    };
    const sig = await imageParagraph(row.signature, 140, 34, `Signature ${i + 1}`);
    attendeeRows.push(
      new TableRow({
        height: { value: 650, rule: HeightRule.ATLEAST },
        children: [
          cell([p(String(i + 1), { center: true, size: 18 })], { width: colNum }),
          cell([p(row.name || " ")], { width: colName }),
          cell([sig], { width: colSig }),
          cell([p(row.date || " ")], { width: colDate }),
        ],
      }),
    );
  }

  const attendanceTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [colNum, colName, colSig, colDate],
    rows: attendeeRows,
  });

  const consultationHeading = p(
    "Consultation (record all consultation comments raised during the tool box talk)",
    { bold: true, italics: true, underline: true, size: 18 },
  );

  const consultationTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell([p(form.consultation || " ")], { width: CONTENT_WIDTH }),
        ],
      }),
    ],
  });

  const presenterSig = await imageParagraph(
    form.presenterSignature,
    200,
    56,
    "Presenter signature",
  );

  return new Document({
    creator: "Sitemate",
    title,
    description: "Tool Box Talk Register",
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH, height: A4_HEIGHT },
            margin: { top: 720, right: 720, bottom: 900, left: 720 },
            pageNumbers: { start: 1 },
          },
        },
        footers: { default: pageFooter() },
        children: [
          topTable,
          new Paragraph({ spacing: { before: 160, after: 160 }, children: [] }),
          detailsTable,
          intro,
          attendanceTable,
          new Paragraph({ spacing: { before: 200, after: 80 }, children: [] }),
          consultationHeading,
          consultationTable,
          new Paragraph({ spacing: { before: 280, after: 40 }, children: [] }),
          presenterSig,
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "111111" },
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            spacing: { after: 60 },
            children: [new TextRun({ text: " ", size: 8 })],
          }),
          p("Signature", { bold: true, size: 18 }),
        ],
      },
    ],
  });
}

async function buildGenericFormDoc(doc: SitePackDocument, formData: Record<string, string>) {
  const title = doc.name || doc.templateName || "Filled form";
  const f = (key: string) => formData[key] || "";
  const rows = Object.entries(formData).filter(
    ([key, value]) =>
      Boolean(value) &&
      !value.startsWith("data:image") &&
      !/logo/i.test(key) &&
      !/signature/i.test(key),
  );

  const imageEntries = Object.entries(formData).filter(
    ([key, value]) =>
      value.startsWith("data:image") &&
      (/signature/i.test(key) || /signoff/i.test(key)),
  );

  const logoLeft = await imageParagraph(f("logoLeft"), 90, 70, "Left logo");
  const logoRight = await imageParagraph(f("logoRight"), 90, 70, "Right logo");
  const leftW = 1400;
  const rightW = 1400;
  const midW = CONTENT_WIDTH - leftW - rightW;

  const headerTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [leftW, midW, rightW],
    rows: [
      new TableRow({
        children: [
          cell([logoLeft], { width: leftW, vAlign: VerticalAlign.CENTER }),
          cell(
            [
              p(title, { bold: true, size: 24, center: true }),
              p(`Date: ${f("date") || "—"}`, { size: 18 }),
              p(`Document No.: ${f("documentNo") || doc.documentNo || doc.code || "—"}`, {
                size: 18,
              }),
              p(`Approved by: ${f("approvedBy") || doc.approvedBy || "—"}`, { size: 18 }),
            ],
            { width: midW },
          ),
          cell([logoRight], { width: rightW, vAlign: VerticalAlign.CENTER }),
        ],
      }),
    ],
  });

  const fieldRows =
    rows.length > 0
      ? rows.map(([key, value]) => labelValueRow(humanizeKey(key), value))
      : [
          new TableRow({
            children: [cell([p("No text fields saved.")], { width: CONTENT_WIDTH })],
          }),
        ];

  const fieldsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3200, CONTENT_WIDTH - 3200],
    rows: fieldRows,
  });

  const signatureBlocks: Paragraph[] = [];
  if (imageEntries.length > 0) {
    signatureBlocks.push(
      new Paragraph({
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({
            text: "Signatures",
            bold: true,
            font: "Arial",
            size: 22,
          }),
        ],
      }),
    );
    for (const [key, value] of imageEntries.slice(0, 20)) {
      signatureBlocks.push(p(humanizeKey(key), { bold: true, size: 18 }));
      signatureBlocks.push(await imageParagraph(value, 160, 48, humanizeKey(key)));
      signatureBlocks.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 10, color: "111111" },
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          spacing: { after: 160 },
          children: [new TextRun({ text: " " })],
        }),
      );
    }
  }

  return new Document({
    creator: "Sitemate",
    title,
    description: doc.templateName || "Filled form",
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH, height: A4_HEIGHT },
            margin: { top: 720, right: 720, bottom: 900, left: 720 },
            pageNumbers: { start: 1 },
          },
        },
        footers: { default: pageFooter() },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 160 }, children: [] }),
          fieldsTable,
          ...signatureBlocks,
        ],
      },
    ],
  });
}

async function buildSiteSheqDoc(doc: SitePackDocument, formData: Record<string, string>) {
  const title = doc.name || "Management Site Inspection Report";
  const documentNo =
    formData.documentNo || doc.documentNo || doc.code || "—";
  const approvedBy = formData.approvedBy || doc.approvedBy || "—";

  const logoLeft = await imageParagraph(formData.logoLeft, 90, 70, "Left logo");
  const logoRight = await imageParagraph(formData.logoRight, 90, 70, "Right logo");

  const metaW = CONTENT_WIDTH - 2800;
  const labelW = 2400;
  const valueW = metaW - labelW;

  const headerMetaInner = new Table({
    width: { size: metaW, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    rows: [
      new TableRow({
        children: [
          sheqCell([p("MANAGEMENT SITE INSPECTION REPORT", { bold: true, size: 22, center: true })], {
            width: metaW,
            columnSpan: 2,
          }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Date", { bold: true, size: 18 })], { width: labelW, shade: "F3F4F6" }),
          sheqCell([p(formData.date || "—")], { width: valueW }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Document No. & Rev", { bold: true, size: 18 })], {
            width: labelW,
            shade: "F3F4F6",
          }),
          sheqCell([p(documentNo)], { width: valueW }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Approved by", { bold: true, size: 18 })], {
            width: labelW,
            shade: "F3F4F6",
          }),
          sheqCell([p(approvedBy)], { width: valueW }),
        ],
      }),
    ],
  });

  const headerTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1400, metaW, 1400],
    rows: [
      new TableRow({
        children: [
          sheqCell([logoLeft], { width: 1400 }),
          new TableCell({
            borders: BLACK_BORDERS,
            width: { size: metaW, type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [headerMetaInner],
          }),
          sheqCell([logoRight], { width: 1400 }),
        ],
      }),
    ],
  });

  const inspectorDetails = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3400, CONTENT_WIDTH - 3400],
    rows: [
      new TableRow({
        children: [
          sheqCell([p("Name of Person conducting Inspection", { bold: true, size: 18 })], {
            width: 3400,
            shade: "F3F4F6",
          }),
          sheqCell([p(formData.inspector || "—")], { width: CONTENT_WIDTH - 3400 }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Job Title", { bold: true, size: 18 })], {
            width: 3400,
            shade: "F3F4F6",
          }),
          sheqCell([p(formData.inspectorJobTitle || "—")], { width: CONTENT_WIDTH - 3400 }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Project Name / Title", { bold: true, size: 18 })], {
            width: 3400,
            shade: "F3F4F6",
          }),
          sheqCell([p(formData.projectName || "—")], { width: CONTENT_WIDTH - 3400 }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell([p("Name of Principal Contractor", { bold: true, size: 18 })], {
            width: 3400,
            shade: "F3F4F6",
          }),
          sheqCell([p(formData.principalContractor || "—")], { width: CONTENT_WIDTH - 3400 }),
        ],
      }),
    ],
  });

  const hsStatus = (formData["hsStatus"] || "").toUpperCase();
  const isTicked = (value: string | undefined) => {
    const v = (value || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  };
  // ASCII boxes render reliably in Word (Unicode ✓ often fails).
  const tickBox = (on: boolean) => (on ? "[X]" : "[ ]");
  const statusGreen =
    isTicked(formData["hsStatusGreenTick"]) || hsStatus === "GREEN";
  const statusAmber =
    isTicked(formData["hsStatusAmberTick"]) || hsStatus === "AMBER";
  const statusRed = isTicked(formData["hsStatusRedTick"]) || hsStatus === "RED";
  const colStatus = 5600;
  const colTick = 700;
  const colDist = 3166;
  const colDistTick = 1000;

  const statusTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [colStatus, colTick, colDist, colDistTick],
    rows: [
      new TableRow({
        children: [
          sheqCell(
            [p("Project Summary – H&S status", { bold: true, size: 18, color: "FFFFFF" })],
            { width: colStatus + colTick, columnSpan: 2, shade: "334155" },
          ),
          sheqCell([p("Report Distribution", { bold: true, size: 18, color: "FFFFFF" })], {
            width: colDist,
            shade: "0369A1",
          }),
          sheqCell([p("Tick", { bold: true, size: 18, center: true, color: "FFFFFF" })], {
            width: colDistTick,
            shade: "0369A1",
          }),
        ],
      }),
      new TableRow({
        children: [
          sheqCell(
            [
              p(
                `${tickBox(statusGreen)}  GREEN – PROJECT IN GOOD WELL MANAGED ORDER, WITH NO SIGNIFICANT STANDARDS ISSUES`,
                { size: 15, bold: statusGreen },
              ),
            ],
            { width: colStatus, shade: statusGreen ? "BBF7D0" : "F0FDF4" },
          ),
          sheqCell([p(tickBox(statusGreen), { bold: true, center: true, size: 20 })], {
            width: colTick,
            shade: statusGreen ? "BBF7D0" : "F0FDF4",
          }),
          sheqCell([p("Installation Director", { size: 16 })], {
            width: colDist,
            shade: "F0F9FF",
          }),
          sheqCell(
            [
              p(tickBox(isTicked(formData["dist_installation_director"])), {
                bold: true,
                center: true,
                size: 18,
              }),
            ],
            { width: colDistTick, shade: "F0F9FF" },
          ),
        ],
      }),
      new TableRow({
        children: [
          sheqCell(
            [
              p(
                `${tickBox(statusAmber)}  AMBER – SUPPORT REVIEW GIVES CAUSE FOR CONCERN, WITH SITE STANDARDS ISSUES REQUIRING ATTENTION.`,
                { size: 15, bold: statusAmber },
              ),
              p(
                "ACTION: Action plan within 3 working days (LEAD Project Manager with Project Supervisor)",
                { size: 13 },
              ),
            ],
            { width: colStatus, shade: statusAmber ? "FDE68A" : "FEFCE8" },
          ),
          sheqCell([p(tickBox(statusAmber), { bold: true, center: true, size: 20 })], {
            width: colTick,
            shade: statusAmber ? "FDE68A" : "FEFCE8",
          }),
          sheqCell([p("SHEQ Advisor", { size: 16 })], { width: colDist, shade: "F0F9FF" }),
          sheqCell(
            [
              p(tickBox(isTicked(formData["dist_sheq_advisor"])), {
                bold: true,
                center: true,
                size: 18,
              }),
            ],
            { width: colDistTick, shade: "F0F9FF" },
          ),
        ],
      }),
      new TableRow({
        children: [
          sheqCell(
            [
              p(
                `${tickBox(statusRed)}  RED – SUPPORT REVIEW GIVES SIGNIFICANT CAUSE FOR CONCERN DUE TO RISK ITEMS AND/OR ONGOING CONCERNS.`,
                { size: 15, bold: statusRed },
              ),
              p(
                "ACTION: Action plan within 3 working days (LEAD Project Manager, signed off by Installation Director)",
                { size: 13 },
              ),
            ],
            { width: colStatus, shade: statusRed ? "FECACA" : "FEF2F2" },
          ),
          sheqCell([p(tickBox(statusRed), { bold: true, center: true, size: 20 })], {
            width: colTick,
            shade: statusRed ? "FECACA" : "FEF2F2",
          }),
          sheqCell([p("Principal Contractor", { size: 16 })], {
            width: colDist,
            shade: "F0F9FF",
          }),
          sheqCell(
            [
              p(tickBox(isTicked(formData["dist_principal_contractor"])), {
                bold: true,
                center: true,
                size: 18,
              }),
            ],
            { width: colDistTick, shade: "F0F9FF" },
          ),
        ],
      }),
    ],
  });

  const scoringLegend = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          sheqCell(
            [p("A – GOOD STANDARD – Correct standard and/or approach in place", { size: 15, bold: true })],
            { width: CONTENT_WIDTH, shade: "DCFCE7" },
          ),
        ],
      }),
      new TableRow({
        children: [
          sheqCell(
            [
              p(
                "B – BASIC-STANDARD – moderate improvement sought (without high potential for injury)",
                { size: 15, bold: true },
              ),
            ],
            { width: CONTENT_WIDTH, shade: "FEF9C3" },
          ),
        ],
      }),
      new TableRow({
        children: [
          sheqCell(
            [
              p(
                "C – SUBSTANDARD – site condition with high potential for injury / below requirements",
                { size: 15, bold: true },
              ),
            ],
            { width: CONTENT_WIDTH, shade: "FEE2E2" },
          ),
        ],
      }),
    ],
  });

  const stdCol = 4800;
  const scoreCol = 1400;
  const commentCol = CONTENT_WIDTH - stdCol - scoreCol;

  const standards = [
    { title: "ST 1 – Work at Heights: Scaffolding & Edge protection", detail: "(scaffold structure, fall protection, car top, voids, protection from falling objects)" },
    { title: "ST 2 – Lifting Operations & Manual Handling", detail: "(Guide rails, RAMS, Sling/Platform/Doors, Control Panel, Hydraulic Unit, Lift Car – lifting technique, lifting equipment)" },
    { title: "ST 3 – Temporary Access", detail: "(Hoardings, Scaffold towers, ladders, step & podium ladders, protecting others)" },
    { title: "ST 4 – Electricity", detail: "(Temp electrical power & lighting, permanent electrical supply, safe working with electricity, PAT)" },
    { title: "ST 5 – Accessing / Egressing & Working in the Pit", detail: "(entrance protection, ladder, pit hazards)" },
    { title: "ST 6 – Working in Lift Shaft / LMR", detail: "(access/egress, fall protection, housekeeping, lift equipment)" },
    { title: "ST 7 – Housekeeping & Welfare", detail: "(site housekeeping standards, storage area and lift equipment protection, site welfare)" },
    { title: "ST 8 – Personal Protective Equipment", detail: "(quality & compliance, risk based provision, task PPE)" },
    { title: "ST 9 – Project Planning Documentation", detail: "(Risk review process, method statements / risk assessment, key permits & completion of records)" },
    { title: "ST 10 – Supervision & Project Management", detail: "(Supervision, training & competence, team m/s briefing, toolbox talks, improvement plan review)" },
    { title: "ST 11 – Site Welfare", detail: "(Canteen, Toilets, Drying Room, First Aid, Fire etc.)" },
    { title: "ST 12 – Occupational Health", detail: "(COSHH, HAVs, Noise, Dust, Dermatitis, Weils, Drugs & Alcohol, Stress / Mental Health, Asbestos)" },
    { title: "ST 13 – Tools & Equipment", detail: "(Hand tools, Portable power tools, lighting, HAVs, Noise, Dust)" },
    { title: "ST 14 – Fire, Accident & Near Miss Reporting", detail: "(fire arrangements & procedures, escape procedures, first aid, accident reporting procedure, accident book, near miss cards)" },
    { title: "ST 15 – Environmental Management", detail: "(sustainability, pollution incident response, waste management, hazardous waste, nuisance)" },
    { title: "ST 16 – Quality Management", detail: "(Shaft survey, plumbing guiderails, plumbing doors, testing & commissioning)" },
    { title: "ST 17 – Hoardings", detail: "Hoardings installed securely, doors with locks & structurally robust" },
    { title: "ST 18 – Lift Motor Room", detail: "Safety signs, LOTO arrangements, oil resistant floors, safe working space etc." },
    { title: "ST 19 – Lift Shaft & Pit", detail: "All fall risks protected, pits clean and free of water, oil, rubbish etc" },
    { title: "ST 20 – Site Requirements", detail: "Operatives following site requirements, policies and procedures including Hot Works Permits etc." },
  ];

  const stdRows: TableRow[] = [
    new TableRow({
      children: [
        sheqCell([p("STANDARD", { bold: true, size: 18, color: "FFFFFF" })], {
          width: stdCol,
          shade: "0369A1",
        }),
        sheqCell([p("SCORE A/B/C", { bold: true, center: true, size: 18, color: "FFFFFF" })], {
          width: scoreCol,
          shade: "0369A1",
        }),
        sheqCell([p("Comments / Correction Actions", { bold: true, size: 18, color: "FFFFFF" })], {
          width: commentCol,
          shade: "0369A1",
        }),
      ],
    }),
  ];

  for (let i = 0; i < standards.length; i += 1) {
    const std = standards[i]!;
    const rawVal = formData[`st_${i + 1}_compliant`] || "";
    const val =
      rawVal.toUpperCase() === "Y"
        ? "A"
        : rawVal.toUpperCase() === "N"
          ? "C"
          : rawVal.toUpperCase();
    const comment = formData[`st_${i + 1}_comments`] || "";

    let scoreShade = "FFFFFF";
    let scoreText = " ";
    if (val === "A") {
      scoreShade = "DCFCE7";
      scoreText = "A";
    } else if (val === "B") {
      scoreShade = "FEF9C3";
      scoreText = "B";
    } else if (val === "C") {
      scoreShade = "FEE2E2";
      scoreText = "C";
    } else if (val === "NA") {
      scoreShade = "F1F5F9";
      scoreText = "N/A";
    }

    stdRows.push(
      new TableRow({
        children: [
          sheqCell(
            [p(std.title, { bold: true, size: 15 }), p(std.detail, { size: 12, italics: true })],
            { width: stdCol, shade: i % 2 === 0 ? "FFFFFF" : "F8FAFC" },
          ),
          sheqCell([p(scoreText, { bold: true, center: true, size: 20 })], {
            width: scoreCol,
            shade: scoreShade,
          }),
          sheqCell([p(comment || " ")], {
            width: commentCol,
            shade: i % 2 === 0 ? "FFFFFF" : "F8FAFC",
          }),
        ],
      }),
    );
  }

  const standardsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [stdCol, scoreCol, commentCol],
    rows: stdRows,
  });

  const commentsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          sheqCell([p(formData.commentsActions || " ")], { width: CONTENT_WIDTH }),
        ],
      }),
    ],
  });

  const actW = 4200;
  const whoW = 2100;
  const whenW = 2100;
  const closedW = CONTENT_WIDTH - actW - whoW - whenW;

  const actionRows: TableRow[] = [
    new TableRow({
      children: [
        sheqCell([p("Actions Required", { bold: true, size: 18, color: "FFFFFF" })], {
          width: actW,
          shade: "1E293B",
        }),
        sheqCell([p("By Who", { bold: true, size: 18, color: "FFFFFF" })], {
          width: whoW,
          shade: "1E293B",
        }),
        sheqCell([p("By When", { bold: true, size: 18, color: "FFFFFF" })], {
          width: whenW,
          shade: "1E293B",
        }),
        sheqCell([p("Date Closed", { bold: true, size: 18, color: "FFFFFF" })], {
          width: closedW,
          shade: "1E293B",
        }),
      ],
    }),
  ];

  for (let i = 0; i < 7; i += 1) {
    actionRows.push(
      new TableRow({
        children: [
          sheqCell([p(formData[`site_sheq_action_${i}_actions_required`] || " ")], {
            width: actW,
          }),
          sheqCell([p(formData[`site_sheq_action_${i}_by_who`] || " ")], { width: whoW }),
          sheqCell([p(formData[`site_sheq_action_${i}_by_when`] || " ")], { width: whenW }),
          sheqCell([p(formData[`site_sheq_action_${i}_date_closed`] || " ")], {
            width: closedW,
          }),
        ],
      }),
    );
  }

  const actionsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [actW, whoW, whenW, closedW],
    rows: actionRows,
  });

  return new Document({
    creator: "Sitemate",
    title,
    description: "Management Site Inspection Report",
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH, height: A4_HEIGHT },
            margin: { top: 560, right: 560, bottom: 720, left: 560 },
            pageNumbers: { start: 1 },
          },
        },
        footers: { default: pageFooter() },
        children: [
          headerTable,
          new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }),
          p("INSPECTION DETAILS", { bold: true, size: 20 }),
          inspectorDetails,
          new Paragraph({ spacing: { before: 140, after: 60 }, children: [] }),
          p("SCOPE OF INSPECTION – LIFT INSTALLATIONS", { bold: true, size: 20 }),
          statusTable,
          new Paragraph({ spacing: { before: 160, after: 60 }, children: [] }),
          p("SITE HEALTH & SAFETY PERFORMANCE MEASURES: SCORING", { bold: true, size: 20 }),
          scoringLegend,
          new Paragraph({ spacing: { before: 100, after: 60 }, children: [] }),
          standardsTable,
          new Paragraph({ spacing: { before: 160, after: 60 }, children: [] }),
          p(
            "COMMENTS/ACTIONS (Please state any comments or corrective actions required)",
            { bold: true, size: 18 },
          ),
          commentsTable,
          new Paragraph({ spacing: { before: 140, after: 60 }, children: [] }),
          actionsTable,
        ],
      },
    ],
  });
}

function humanizeKey(key: string) {
  return key
    .replace(/^signoff_\d+_/, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build a proper editable .docx blob for a filled site-pack form. */
export async function buildFilledFormWordBlob(doc: SitePackDocument): Promise<{
  blob: Blob;
  filename: string;
}> {
  const formData = doc.formData ?? {};
  const title = doc.name || "Filled form";
  const filename = `${safeDownloadBasename(title)}.docx`;

  const wordDoc =
    doc.kind === "toolbox-talk"
      ? await buildToolboxTalkDoc(toolboxFromValues(formData), title)
      : doc.kind === "site-sheq"
        ? await buildSiteSheqDoc(doc, formData)
        : await buildGenericFormDoc(doc, formData);

  const blob = await Packer.toBlob(wordDoc);
  if (!blob || blob.size < 64) {
    throw new Error("Word file was empty — try Download Word again");
  }
  return { blob, filename };
}

/** Build and download a proper editable .docx for a filled site-pack form. */
export async function downloadFilledFormWord(doc: SitePackDocument) {
  const { blob, filename } = await buildFilledFormWordBlob(doc);
  triggerBrowserDownload(blob, filename);
}
