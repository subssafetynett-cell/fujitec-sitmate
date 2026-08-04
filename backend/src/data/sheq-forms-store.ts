import { type SheqFormRecord, type TemplateKind } from "./sheq.js";
import { listTemplates } from "./templates-store.js";
import { readBlob, writeBlob } from "../db/blob-store.js";

const BLOB_KEY = "sheq-forms";

const SHEQ_FORM_KINDS = new Set<TemplateKind>([
  "sheq-service-report",
  "sheq-installation-report",
  "site-sheq",
]);

const STATUSES: SheqFormRecord["status"][] = ["Draft", "Submitted", "Closed"];
const HS = ["GREEN", "AMBER", "RED", ""] as const;

type Store = { version: 1; forms: SheqFormRecord[] };

function normalize(raw: Partial<SheqFormRecord> & { id: string; title: string }): SheqFormRecord {
  const hs = String(raw.hsStatus ?? "").toUpperCase();
  const createdById = String(raw.createdById ?? "").trim();
  const createdByName = String(raw.createdByName ?? "").trim();
  const company = String(raw.company ?? "").trim();
  return {
    id: raw.id,
    title: raw.title.trim() || "Untitled SHEQ form",
    site: String(raw.site ?? "").trim() || "—",
    client: String(raw.client ?? "").trim() || "—",
    status: STATUSES.includes(raw.status as SheqFormRecord["status"])
      ? (raw.status as SheqFormRecord["status"])
      : "Submitted",
    hsStatus: (HS as readonly string[]).includes(hs)
      ? (hs as SheqFormRecord["hsStatus"])
      : "",
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
    ...(createdById ? { createdById } : {}),
    ...(createdByName ? { createdByName } : {}),
    ...(company ? { company } : {}),
  };
}

function nextId(existing: SheqFormRecord[]) {
  let max = 1000;
  for (const f of existing) {
    const m = /^SF-(\d+)$/.exec(f.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `SF-${max + 1}`;
}

async function readStore(): Promise<Store> {
  const raw = await readBlob<Store>(BLOB_KEY, { version: 1, forms: [] });
  if (!Array.isArray(raw.forms)) return { version: 1, forms: [] };
  return { version: 1, forms: raw.forms.map((f) => normalize(f as SheqFormRecord)) };
}

async function writeStore(store: Store) {
  await writeBlob(BLOB_KEY, store);
}

async function derive(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  status?: SheqFormRecord["status"];
  keepId?: string;
  keepRaised?: string;
  createdById?: string;
  createdByName?: string;
  company?: string;
}): Promise<SheqFormRecord> {
  const templates = await listTemplates();
  const template = templates.find((t) => t.id === input.templateId);
  if (!template || !template.kind || !SHEQ_FORM_KINDS.has(template.kind)) {
    throw new Error("Select a SHEQ form template");
  }
  const formData = Object.fromEntries(
    Object.entries(input.formData ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  );
  const title =
    input.title?.trim() ||
    `${template.name} — ${formData.client || formData.siteAddress || formData.equipmentId || "new"}`;

  return normalize({
    id: input.keepId || "TEMP",
    title,
    site: formData.siteAddress?.trim() || "—",
    client: formData.client?.trim() || "—",
    status: input.status || "Submitted",
    hsStatus: (formData.hsStatus?.toUpperCase() as SheqFormRecord["hsStatus"]) || "",
    raised: input.keepRaised || formData.date || formData.jobDate || new Date().toISOString().slice(0, 10),
    templateId: template.id,
    templateName: template.name,
    kind: template.kind,
    formData,
    createdById: input.createdById,
    createdByName: input.createdByName,
    company: input.company,
  });
}

export async function listSheqForms(): Promise<SheqFormRecord[]> {
  return (await readStore()).forms;
}

export async function getSheqForm(id: string) {
  return (await listSheqForms()).find((f) => f.id === id);
}

export async function createSheqForm(input: {
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  status?: SheqFormRecord["status"];
  createdById?: string;
  createdByName?: string;
  company?: string;
}) {
  const store = await readStore();
  const created = await derive({ ...input, keepId: nextId(store.forms) });
  store.forms = [created, ...store.forms];
  await writeStore(store);
  return created;
}

export async function updateSheqForm(
  id: string,
  input: {
    templateId?: string;
    title?: string;
    formData?: Record<string, string>;
    status?: SheqFormRecord["status"];
  },
) {
  const store = await readStore();
  const index = store.forms.findIndex((f) => f.id === id);
  if (index < 0) throw new Error("SHEQ form not found");
  const existing = store.forms[index];
  const updated = await derive({
    templateId: input.templateId || existing.templateId || "",
    title: input.title,
    formData: input.formData ?? existing.formData,
    status: input.status || existing.status,
    keepId: existing.id,
    keepRaised: existing.raised,
    createdById: existing.createdById,
    createdByName: existing.createdByName,
    company: existing.company,
  });
  store.forms[index] = updated;
  await writeStore(store);
  return updated;
}

export async function deleteSheqForm(id: string) {
  const store = await readStore();
  const next = store.forms.filter((f) => f.id !== id);
  if (next.length === store.forms.length) return false;
  store.forms = next;
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

export function buildSheqFormDownloadHtml(form: SheqFormRecord): string {
  const rows = Object.entries(form.formData ?? {})
    .filter(([key, value]) => value && !key.endsWith("Name") && !value.startsWith("data:"))
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(form.id)} — ${escapeHtml(form.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { width: 28%; background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>${escapeHtml(form.title)}</h1>
  <p class="meta">
    ${escapeHtml(form.id)} · ${escapeHtml(form.templateName || "SHEQ form")} ·
    ${escapeHtml(form.client)} · ${escapeHtml(form.site)} ·
    ${escapeHtml(form.status)}${form.hsStatus ? ` · ${escapeHtml(form.hsStatus)}` : ""} ·
    Raised ${escapeHtml(form.raised)}
  </p>
  <table><tbody>${rows || "<tr><td colspan='2'>No form fields saved.</td></tr>"}</tbody></table>
</body>
</html>`;
}
