import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./pool.js";
import { importKpiYearFromLegacy } from "../data/kpi-stats-store.js";
import { DUMMY_SITE_IDS, DUMMY_SITE_NAMES } from "../data/sites-store.js";
import { ensureDefaultSuperAdmin } from "../data/users-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS companies_name_ci
    ON companies (lower(name));
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      site TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      last_active TEXT NOT NULL DEFAULT '',
      password_hash TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_blobs (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS site_pack_file_blobs (
      id TEXT PRIMARY KEY,
      content BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS kpi_stat_years (
      discipline TEXT NOT NULL,
      year INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (discipline, year)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS kpi_stat_rows (
      id TEXT PRIMARY KEY,
      discipline TEXT NOT NULL,
      year INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      indicator TEXT NOT NULL DEFAULT '',
      target TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      higher_is_better BOOLEAN NOT NULL DEFAULT TRUE,
      months JSONB NOT NULL DEFAULT '{}'::jsonb,
      FOREIGN KEY (discipline, year)
        REFERENCES kpi_stat_years(discipline, year)
        ON DELETE CASCADE
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS kpi_stat_rows_discipline_year_idx
    ON kpi_stat_rows(discipline, year, position);
  `);
}

async function importJsonBlobIfEmpty(key: string, filename: string, fallback: unknown) {
  const existing = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM app_blobs WHERE key = $1",
    [key],
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const filePath = path.join(DATA_DIR, filename);
  let value: unknown = fallback;
  if (fs.existsSync(filePath)) {
    try {
      value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      value = fallback;
    }
  }

  await query(
    `INSERT INTO app_blobs(key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [key, JSON.stringify(value)],
  );
}

async function importCompaniesIfEmpty() {
  const existing = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM companies",
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const filePath = path.join(DATA_DIR, "companies-store.json");
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      companies?: Array<{
        id: string;
        name: string;
        industry?: string;
        country?: string;
        logo?: string;
        status?: string;
        createdAt?: string;
      }>;
    };
    for (const c of raw.companies ?? []) {
      await query(
        `INSERT INTO companies(id, name, industry, country, logo, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.name,
          c.industry ?? "",
          c.country ?? "",
          c.logo ?? "",
          c.status === "Inactive" ? "Inactive" : "Active",
          c.createdAt ?? new Date().toISOString().slice(0, 10),
        ],
      );
    }
  } catch {
    // ignore corrupt local file
  }
}

async function removeDummySeedUsers() {
  // Clear seeded demo accounts; keep real invited/signed-up users.
  await query(
    `DELETE FROM users
     WHERE lower(email) LIKE '%@northgate.example'
        OR id IN (
          'USR-001','USR-002','USR-003','USR-004','USR-005',
          'USR-006','USR-007','USR-008','USR-009','USR-010'
        )`,
  );
}

async function removeDummySeedSitesAndPacks() {
  const dummyIds = new Set<string>(DUMMY_SITE_IDS);
  const dummyNames = new Set<string>(
    DUMMY_SITE_NAMES.map((n) => n.toLowerCase()),
  );

  const sitesBlob = await query<{ value: { sites?: Array<{ id?: string; name?: string }> } }>(
    "SELECT value FROM app_blobs WHERE key = $1",
    ["sites"],
  );
  const sites = Array.isArray(sitesBlob.rows[0]?.value?.sites)
    ? sitesBlob.rows[0]!.value.sites!
    : [];
  const keptSites = sites.filter((s) => {
    const id = String(s.id ?? "");
    const name = String(s.name ?? "").trim().toLowerCase();
    return !dummyIds.has(id) && !dummyNames.has(name);
  });
  const removedSiteIds = new Set(
    sites
      .map((s) => String(s.id ?? ""))
      .filter((id) => id && !keptSites.some((k) => k.id === id)),
  );

  if (removedSiteIds.size > 0 || sites.length !== keptSites.length) {
    await query(
      `INSERT INTO app_blobs(key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ["sites", JSON.stringify({ sites: keptSites })],
    );
  }

  const packsBlob = await query<{
    value: {
      folders?: Array<{ id?: string; siteId?: string }>;
      documents?: Array<{ id?: string; siteId?: string }>;
    };
  }>("SELECT value FROM app_blobs WHERE key = $1", ["site-packs"]);
  const folders = Array.isArray(packsBlob.rows[0]?.value?.folders)
    ? packsBlob.rows[0]!.value.folders!
    : [];
  const documents = Array.isArray(packsBlob.rows[0]?.value?.documents)
    ? packsBlob.rows[0]!.value.documents!
    : [];

  const removedDocIds = documents
    .filter((d) => removedSiteIds.has(String(d.siteId ?? "")))
    .map((d) => String(d.id ?? ""))
    .filter(Boolean);

  const keptFolders = folders.filter((f) => !removedSiteIds.has(String(f.siteId ?? "")));
  const keptDocuments = documents.filter(
    (d) => !removedSiteIds.has(String(d.siteId ?? "")),
  );

  if (
    removedSiteIds.size > 0 ||
    folders.length !== keptFolders.length ||
    documents.length !== keptDocuments.length
  ) {
    await query(
      `INSERT INTO app_blobs(key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [
        "site-packs",
        JSON.stringify({ folders: keptFolders, documents: keptDocuments }),
      ],
    );
  }

  for (const docId of removedDocIds) {
    await query("DELETE FROM site_pack_file_blobs WHERE id = $1", [docId]);
  }
}

async function importSessionsIfEmpty() {
  const existing = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM sessions",
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const filePath = path.join(DATA_DIR, "sessions-store.json");
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      sessions?: Array<{
        token: string;
        userId: string;
        createdAt: string;
        expiresAt: string;
      }>;
    };
    for (const s of raw.sessions ?? []) {
      await query(
        `INSERT INTO sessions(token, user_id, created_at, expires_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (token) DO NOTHING`,
        [s.token, s.userId, s.createdAt, s.expiresAt],
      );
    }
  } catch {
    // ignore
  }
}

async function importSitePackFilesIfEmpty() {
  const existing = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM site_pack_file_blobs",
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const dir = path.join(DATA_DIR, "site-pack-files");
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    const content = fs.readFileSync(full);
    await query(
      `INSERT INTO site_pack_file_blobs(id, content, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [name, content],
    );
  }
}

type LegacyKpiStore = {
  disciplines?: Record<
    string,
    Record<
      string,
      {
        year?: number;
        rows?: unknown[];
        updatedAt?: string;
      }
    >
  >;
};

async function readLegacyKpiStore(): Promise<LegacyKpiStore> {
  const blob = await query<{ value: LegacyKpiStore }>(
    "SELECT value FROM app_blobs WHERE key = $1",
    ["kpi-stats"],
  );
  if (blob.rows[0]?.value?.disciplines) return blob.rows[0].value;

  const filePath = path.join(DATA_DIR, "kpi-stats-store.json");
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as LegacyKpiStore;
    } catch {
      // fall through
    }
  }
  return { disciplines: {} };
}

function isCorruptTestYear(rows: unknown[] | undefined): boolean {
  if (!rows || rows.length === 0) return true;
  if (rows.length !== 1) return false;
  const only = rows[0] as { id?: string; indicator?: string };
  return only.id === "test-persist" || only.indicator === "Persist Check";
}

async function cleanupCorruptKpiTestData() {
  await query(
    `DELETE FROM kpi_stat_rows
     WHERE id = 'test-persist' OR indicator = 'Persist Check'`,
  );
  await query(
    `DELETE FROM kpi_stat_years y
     WHERE NOT EXISTS (
       SELECT 1 FROM kpi_stat_rows r
       WHERE r.discipline = y.discipline AND r.year = y.year
     )`,
  );
}

async function importKpiStatsTablesIfEmpty() {
  await cleanupCorruptKpiTestData();

  const existing = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM kpi_stat_years",
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  // Keep a blob copy for backup/legacy tools, then promote into relational tables.
  await importJsonBlobIfEmpty("kpi-stats", "kpi-stats-store.json", {
    disciplines: {},
  });

  const store = await readLegacyKpiStore();
  for (const [discipline, years] of Object.entries(store.disciplines ?? {})) {
    for (const [yearKey, payload] of Object.entries(years ?? {})) {
      const year = Number(payload.year ?? yearKey);
      if (!Number.isInteger(year)) continue;
      if (isCorruptTestYear(payload.rows)) continue;
      await importKpiYearFromLegacy(
        discipline,
        year,
        payload.rows ?? [],
        payload.updatedAt,
      );
    }
  }
}

export async function initDatabase() {
  // Verify connectivity first
  await getPool().query("SELECT 1");
  await ensureSchema();
  await importCompaniesIfEmpty();
  await removeDummySeedUsers();
  await ensureDefaultSuperAdmin();
  await importSessionsIfEmpty();
  await importJsonBlobIfEmpty("sites", "sites-store.json", { sites: [] });
  await importJsonBlobIfEmpty("site-packs", "site-packs-store.json", {
    folders: [],
    documents: [],
  });
  await removeDummySeedSitesAndPacks();
  await importJsonBlobIfEmpty("templates", "templates-store.json", {
    version: 2,
    templates: [],
  });
  await importJsonBlobIfEmpty("concerns", "concerns-store.json", {
    version: 1,
    concerns: [],
  });
  await importJsonBlobIfEmpty("sheq-forms", "sheq-forms-store.json", {
    version: 1,
    forms: [],
  });
  await importJsonBlobIfEmpty("nonconformances", "nonconformances-store.json", {
    version: 1,
    items: [],
  });
  await importJsonBlobIfEmpty("notifications", "notifications-store.json", {
    version: 1,
    notifications: [],
  });
  await importKpiStatsTablesIfEmpty();
  await importSitePackFilesIfEmpty();
}
