import { concerns as seedConcerns, type Concern, type TemplateKind } from "./sheq.js";
import { listTemplates } from "./templates-store.js";
import { readBlob, writeBlob } from "../db/blob-store.js";

const BLOB_KEY = "concerns";

const CATEGORIES: Concern["category"][] = [
  "Occupational Health & Safety",
  "Environmental",
  "Quality",
  "Good Practice",
  "Near Miss",
  "Unsafe Act",
  "Unsafe Condition",
  "Improvement Suggestion",
];

const PRIORITIES: Concern["priority"][] = ["Low", "Medium", "High"];
const STATUSES: Concern["status"][] = [
  "Reported",
  "Assigned",
  "Action Underway",
  "Verification",
  "Closed",
];

const CONCERN_KINDS = new Set<TemplateKind>([
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
]);

type ConcernsStore = {
  concerns: Concern[];
  version: 1;
};

function normalizePriority(raw: unknown): Concern["priority"] {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "low") return "Low";
  if (value === "high" || value === "critical") return "High";
  return "Medium";
}

function normalizeCategory(raw: unknown, kind?: TemplateKind): Concern["category"] {
  const value = String(raw ?? "").trim();
  if (CATEGORIES.includes(value as Concern["category"])) {
    return value as Concern["category"];
  }
  if (kind === "quality-concern") return "Quality";
  if (kind === "good-practice") return "Good Practice";
  if (kind === "sustainability-concern") return "Environmental";
  if (kind === "ohs-concern") return "Occupational Health & Safety";

  const fromClass = value
    .split("|")
    .map((s) => s.trim())
    .find((s) => CATEGORIES.includes(s as Concern["category"]));
  if (fromClass) return fromClass as Concern["category"];

  return "Occupational Health & Safety";
}

function normalizeStatus(raw: unknown): Concern["status"] {
  const value = String(raw ?? "").trim();
  if (STATUSES.includes(value as Concern["status"])) {
    return value as Concern["status"];
  }
  if (/open|opened|reported/i.test(value)) return "Reported";
  if (/assign/i.test(value)) return "Assigned";
  if (/progress|action/i.test(value)) return "Action Underway";
  if (/verif/i.test(value)) return "Verification";
  if (/close/i.test(value)) return "Closed";
  return "Reported";
}

function normalizeConcern(raw: Partial<Concern> & { id: string; title: string }): Concern {
  return {
    id: raw.id,
    title: raw.title.trim() || "Untitled concern",
    category: normalizeCategory(raw.category, raw.kind),
    site: String(raw.site ?? "").trim() || "—",
    reporter: String(raw.reporter ?? "").trim() || (raw.anonymous ? "Anonymous" : "Site user"),
    anonymous: Boolean(raw.anonymous),
    priority: PRIORITIES.includes(raw.priority as Concern["priority"])
      ? (raw.priority as Concern["priority"])
      : normalizePriority(raw.priority),
    status: normalizeStatus(raw.status),
    raised: String(raw.raised ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    templateId: raw.templateId,
    templateName: raw.templateName,
    kind: raw.kind,
    formData:
      raw.formData && typeof raw.formData === "object"
        ? Object.fromEntries(
            Object.entries(raw.formData).map(([k, v]) => [k, String(v ?? "")]),
          )
        : undefined,
  };
}

function nextId(existing: Concern[]): string {
  let max = 800;
  for (const c of existing) {
    const m = /^CN-(\d+)$/.exec(c.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `CN-${max + 1}`;
}

async function readStore(): Promise<ConcernsStore> {
  const raw = await readBlob<ConcernsStore>(BLOB_KEY, {
    version: 1,
    concerns: [],
  });
  if (!Array.isArray(raw.concerns) || raw.concerns.length === 0) {
    const initial: ConcernsStore = {
      version: 1,
      concerns: seedConcerns.map((c) => normalizeConcern(c)),
    };
    await writeBlob(BLOB_KEY, initial);
    return initial;
  }
  return {
    version: 1,
    concerns: raw.concerns.map((c) => normalizeConcern(c as Concern)),
  };
}

async function writeStore(store: ConcernsStore) {
  await writeBlob(BLOB_KEY, store);
}

export async function listConcerns(): Promise<Concern[]> {
  return (await readStore()).concerns;
}

export async function getConcern(id: string): Promise<Concern | undefined> {
  return (await listConcerns()).find((c) => c.id === id);
}

async function deriveFromForm(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  anonymous?: boolean;
  reporter?: string;
  keepStatus?: Concern["status"];
  keepId?: string;
  keepRaised?: string;
}): Promise<Concern> {
  const templates = await listTemplates();
  const template = templates.find((t) => t.id === input.templateId);
  if (!template || !template.kind || !CONCERN_KINDS.has(template.kind)) {
    throw new Error("Select a concern template");
  }

  const formData = Object.fromEntries(
    Object.entries(input.formData ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  );

  const classification = formData.incidentClassification || "";
  const category = normalizeCategory(
    formData.ncCategory || classification || template.name,
    template.kind,
  );

  const observation = formData.observationDetails?.trim();
  const title =
    input.title?.trim() ||
    observation?.slice(0, 120) ||
    `${template.name} — ${formData.projectName || formData.reportDate || "new"}`;

  const site =
    formData.projectName?.trim() ||
    formData.customerName?.trim() ||
    formData.fullAddress?.trim() ||
    "—";

  const anonymous = Boolean(input.anonymous);
  const reporter = anonymous
    ? "Anonymous"
    : input.reporter?.trim() || formData.siteContact?.trim() || "Site user";

  return normalizeConcern({
    id: input.keepId || "TEMP",
    title,
    category,
    site,
    reporter,
    anonymous,
    priority: normalizePriority(formData.priority),
    status: input.keepStatus || "Reported",
    raised:
      input.keepRaised ||
      formData.reportDate ||
      new Date().toISOString().slice(0, 10),
    templateId: template.id,
    templateName: template.name,
    kind: template.kind,
    formData,
  });
}

export async function createConcern(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  anonymous?: boolean;
  reporter?: string;
}): Promise<Concern> {
  const store = await readStore();
  const created = await deriveFromForm({
    ...input,
    keepId: nextId(store.concerns),
  });
  store.concerns = [created, ...store.concerns];
  await writeStore(store);
  return created;
}

export async function updateConcern(
  id: string,
  input: {
    templateId?: string;
    title?: string;
    formData?: Record<string, string>;
    anonymous?: boolean;
    reporter?: string;
  },
): Promise<Concern> {
  const store = await readStore();
  const index = store.concerns.findIndex((c) => c.id === id);
  if (index < 0) throw new Error("Concern not found");

  const existing = store.concerns[index];
  const updated = await deriveFromForm({
    templateId: input.templateId || existing.templateId || "",
    title: input.title,
    formData: input.formData ?? existing.formData,
    anonymous:
      typeof input.anonymous === "boolean" ? input.anonymous : existing.anonymous,
    reporter: input.reporter,
    keepId: existing.id,
    keepStatus: existing.status,
    keepRaised: existing.raised,
  });

  store.concerns[index] = updated;
  await writeStore(store);
  return updated;
}

export async function deleteConcern(id: string): Promise<boolean> {
  const store = await readStore();
  const next = store.concerns.filter((c) => c.id !== id);
  if (next.length === store.concerns.length) return false;
  store.concerns = next;
  await writeStore(store);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildConcernDownloadHtml(concern: Concern): string {
  const rows = Object.entries(concern.formData ?? {})
    .filter(([key, value]) => value && !key.endsWith("Name") && !value.startsWith("data:"))
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const images = Object.entries(concern.formData ?? {})
    .filter(([, value]) => value.startsWith("data:image/"))
    .map(
      ([key, value]) =>
        `<figure><figcaption>${escapeHtml(key)}</figcaption><img src="${value}" alt="${escapeHtml(key)}" /></figure>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(concern.id)} — ${escapeHtml(concern.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { width: 28%; background: #f5f5f5; }
    figure { margin: 16px 0; }
    img { max-width: 100%; max-height: 320px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>${escapeHtml(concern.title)}</h1>
  <p class="meta">
    ${escapeHtml(concern.id)} · ${escapeHtml(concern.category)} · ${escapeHtml(concern.priority)} ·
    ${escapeHtml(concern.status)} · ${escapeHtml(concern.site)} · Raised ${escapeHtml(concern.raised)} ·
    ${escapeHtml(concern.anonymous ? "Anonymous" : concern.reporter)}
    ${concern.templateName ? ` · Template ${escapeHtml(concern.templateName)}` : ""}
  </p>
  <table>
    <tbody>${rows || "<tr><td colspan='2'>No form fields saved.</td></tr>"}</tbody>
  </table>
  ${images}
</body>
</html>`;
}
