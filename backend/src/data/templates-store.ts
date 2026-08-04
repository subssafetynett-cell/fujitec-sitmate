import {
  templates as seedTemplates,
  type Template,
  type TemplateKind,
} from "./sheq.js";
import { readBlob, writeBlob } from "../db/blob-store.js";

const BLOB_KEY = "templates";

const MAX_LOGO_CHARS = 1_500_000;

const VALID_KINDS: TemplateKind[] = [
  "standard",
  "toolbox-talk",
  "rams-briefing",
  "safe-start",
  "audit-action",
  "puwer",
  "loler",
  "site-sheq",
  "site-induction",
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
  "sheq-service-report",
  "sheq-installation-report",
  "alimak-weekly-check",
];

const CONCERN_SEED_IDS = new Set(["TPL-58", "TPL-59", "TPL-60", "TPL-61"]);
const SHEQ_FORM_SEED_IDS = new Set(["TPL-62", "TPL-63"]);
const ALIMAK_SEED_IDS = new Set(["TPL-64"]);

export type DocumentTemplate = Template;

type TemplatesStore = {
  templates: DocumentTemplate[];
  version?: number;
};

function normalizeKind(kind: unknown, name: string): TemplateKind {
  if (typeof kind === "string" && VALID_KINDS.includes(kind as TemplateKind)) {
    return kind as TemplateKind;
  }
  if (/toolbox|tool box/i.test(name)) return "toolbox-talk";
  if (/rams/i.test(name)) return "rams-briefing";
  if (/safe start/i.test(name)) return "safe-start";
  if (/audit action/i.test(name)) return "audit-action";
  if (/puwer/i.test(name)) return "puwer";
  if (/loler/i.test(name)) return "loler";
  if (/sheq inspection|site inspection/i.test(name)) return "site-sheq";
  if (/induction/i.test(name)) return "site-induction";
  if (/quality concern/i.test(name)) return "quality-concern";
  if (/sustainability concern/i.test(name)) return "sustainability-concern";
  if (/installation service report/i.test(name)) return "sheq-installation-report";
  if (/sheq service report|service report/i.test(name)) return "sheq-service-report";
  if (/alimak|alimark/i.test(name)) return "alimak-weekly-check";
  if (/good practice|positive observation/i.test(name)) return "good-practice";
  if (/occupational health|health and safety concern/i.test(name)) return "ohs-concern";
  if (/concern/i.test(name)) return "ohs-concern";
  return "standard";
}

function normalizeTemplate(
  raw: Partial<DocumentTemplate> & Pick<Template, "id" | "name" | "category">,
): DocumentTemplate {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    fields: raw.fields ?? 0,
    version: raw.version ?? "v1.0",
    updated: raw.updated ?? new Date().toISOString().slice(0, 10),
    uses: raw.uses ?? 0,
    status: raw.status ?? "Draft",
    kind: normalizeKind(raw.kind, raw.name),
    code: raw.code ?? "",
    logoLeft: typeof raw.logoLeft === "string" ? raw.logoLeft : "",
    logoRight: typeof raw.logoRight === "string" ? raw.logoRight : "",
    documentNo: raw.documentNo ?? "",
    approvedBy: raw.approvedBy ?? "",
    description: raw.description ?? "",
  };
}

function seedStore(): TemplatesStore {
  return {
    version: 2,
    templates: seedTemplates.map((t) => normalizeTemplate(t)),
  };
}

function mergeMissingSeeds(templates: DocumentTemplate[]): DocumentTemplate[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  for (const seed of seedTemplates) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, normalizeTemplate(seed));
    } else if (
      CONCERN_SEED_IDS.has(seed.id) ||
      SHEQ_FORM_SEED_IDS.has(seed.id) ||
      ALIMAK_SEED_IDS.has(seed.id)
    ) {
      const existing = byId.get(seed.id)!;
      byId.set(
        seed.id,
        normalizeTemplate({
          ...existing,
          name: seed.name,
          category: seed.category,
          kind: seed.kind,
          code: seed.code,
          description: seed.description,
          fields: seed.fields,
          documentNo: seed.documentNo ?? existing.documentNo,
          approvedBy: seed.approvedBy ?? existing.approvedBy,
        }),
      );
    }
  }
  // Keep seed order first, then any extras
  const seedIds = new Set(seedTemplates.map((t) => t.id));
  return [
    ...seedTemplates.map((s) => byId.get(s.id) ?? normalizeTemplate(s)),
    ...templates.filter((t) => !seedIds.has(t.id)).map((t) => normalizeTemplate(t)),
  ];
}

async function readStore(): Promise<TemplatesStore> {
  const raw = await readBlob<TemplatesStore | null>(BLOB_KEY, null);
  if (!raw) {
    const initial = seedStore();
    await writeBlob(BLOB_KEY, initial);
    return initial;
  }
  if (!Array.isArray(raw.templates) || raw.version !== 2) {
    const migrated = seedStore();
    // keep any custom toolbox-talk templates created by users
    const extras = Array.isArray(raw.templates)
      ? raw.templates
          .map((t) => normalizeTemplate(t))
          .filter((t) => t.kind === "toolbox-talk" && !seedTemplates.some((s) => s.id === t.id))
      : [];
    migrated.templates = [...extras, ...migrated.templates];
    await writeBlob(BLOB_KEY, migrated);
    return migrated;
  }
  const templates = mergeMissingSeeds(raw.templates.map((t) => normalizeTemplate(t)));
  const next = { version: 2 as const, templates };
  const changed =
    templates.length !== raw.templates.length ||
    [...CONCERN_SEED_IDS, ...SHEQ_FORM_SEED_IDS].some((id) => {
      const before = raw.templates.find((t) => t.id === id);
      const after = templates.find((t) => t.id === id);
      return (
        !before ||
        !after ||
        before.category !== after.category ||
        before.kind !== after.kind ||
        before.name !== after.name
      );
    });
  if (changed) {
    await writeStore(next);
  }
  return next;
}

async function writeStore(store: TemplatesStore) {
  await writeBlob(BLOB_KEY, { version: 2, templates: store.templates });
}

function validateLogo(logo: string, label: string) {
  if (!logo) return;
  const isDataImage = logo.startsWith("data:image/");
  const isHttpUrl = /^https?:\/\//i.test(logo);
  if (!isDataImage && !isHttpUrl) {
    throw new Error(`${label} must be an image file or Cloudinary URL`);
  }
  if (isDataImage && logo.length > MAX_LOGO_CHARS) {
    throw new Error(`${label} is too large (max about 1MB) — upload via Cloudinary first`);
  }
}

export async function listTemplates(): Promise<DocumentTemplate[]> {
  return (await readStore()).templates;
}

export type CreateToolboxTalkInput = {
  name?: string;
  logoLeft?: string;
  logoRight?: string;
  documentNo?: string;
  approvedBy?: string;
  status?: Template["status"];
};

export async function createToolboxTalkTemplate(
  input: CreateToolboxTalkInput,
): Promise<DocumentTemplate> {
  const name = (input.name ?? "Tool Box Talk Register").trim() || "Tool Box Talk Register";
  let logoLeft = (input.logoLeft ?? "").trim();
  let logoRight = (input.logoRight ?? "").trim();
  const documentNo = (input.documentNo ?? "").trim();
  const approvedBy = (input.approvedBy ?? "").trim();
  const status = input.status === "Published" ? "Published" : "Draft";

  validateLogo(logoLeft, "Left logo");
  validateLogo(logoRight, "Right logo");

  const { maybeUploadDataUrl } = await import("../lib/cloudinary.js");
  logoLeft = await maybeUploadDataUrl(logoLeft, {
    folder: "sheq-harmony/templates",
    resourceType: "image",
  });
  logoRight = await maybeUploadDataUrl(logoRight, {
    folder: "sheq-harmony/templates",
    resourceType: "image",
  });

  const store = await readStore();
  const nextNum =
    store.templates.reduce((max, t) => {
      const n = Number(t.id.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;

  const template: DocumentTemplate = {
    id: `TPL-${String(nextNum).padStart(2, "0")}`,
    name,
    category: "Health & Safety",
    fields: 18,
    version: "v1.0",
    updated: new Date().toISOString().slice(0, 10),
    uses: 0,
    status,
    kind: "toolbox-talk",
    code: "CUSTOM",
    logoLeft,
    logoRight,
    documentNo,
    approvedBy,
    description: "Custom tool box talk register template.",
  };

  store.templates = [template, ...store.templates];
  await writeStore(store);
  return template;
}
