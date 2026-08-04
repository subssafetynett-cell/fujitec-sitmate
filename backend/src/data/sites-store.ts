import type { Site } from "./sheq.js";
import { readBlob, writeBlob } from "../db/blob-store.js";

const BLOB_KEY = "sites";

const SITE_STATUSES: Site["status"][] = ["Active", "Inactive", "Onboarding", "Suspended"];

/** Original demo sites — cleared on migrate and never re-seeded. */
export const DUMMY_SITE_IDS = [
  "ST-001",
  "ST-002",
  "ST-003",
  "ST-004",
  "ST-005",
  "ST-006",
] as const;

export const DUMMY_SITE_NAMES = [
  "Northgate HQ",
  "Riverside Plant",
  "Harbour Logistics",
  "Eastfield Depot",
  "Clyde Works",
  "Southbank Towers",
] as const;

type SitesStore = {
  sites: Site[];
};

function normalizeManagers(raw: Partial<Site> & { managers?: unknown; manager?: unknown }): string[] {
  if (Array.isArray(raw.managers)) {
    return Array.from(
      new Set(
        raw.managers
          .map((m) => String(m ?? "").trim())
          .filter(Boolean),
      ),
    );
  }
  if (typeof raw.manager === "string" && raw.manager.trim()) {
    return Array.from(
      new Set(
        raw.manager
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function normalizeSite(raw: Partial<Site> & { id: string; name: string }): Site {
  const address = raw.address?.trim() || raw.city?.trim() || "";
  const city =
    raw.city?.trim() ||
    address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .at(-1)
      ?.replace(/\s+[A-Z]{1,2}\d.*$/, "")
      .trim() ||
    "—";
  const managers = normalizeManagers(raw);

  return {
    id: raw.id,
    name: raw.name,
    address,
    city,
    managers,
    manager: managers.join(", "),
    employees: Number.isFinite(raw.employees) ? Number(raw.employees) : 0,
    compliance: Number.isFinite(raw.compliance) ? Number(raw.compliance) : 0,
    openNcs: Number.isFinite(raw.openNcs) ? Number(raw.openNcs) : 0,
    status: SITE_STATUSES.includes(raw.status as Site["status"])
      ? (raw.status as Site["status"])
      : "Active",
    packItems: Number.isFinite(raw.packItems) ? Number(raw.packItems) : 0,
    packExpiring: Number.isFinite(raw.packExpiring) ? Number(raw.packExpiring) : 0,
  };
}

async function readStore(): Promise<SitesStore> {
  const raw = await readBlob<SitesStore>(BLOB_KEY, { sites: [] });
  const sites = Array.isArray(raw.sites) ? raw.sites.map((s) => normalizeSite(s)) : [];
  return { sites };
}

async function writeStore(store: SitesStore) {
  await writeBlob(BLOB_KEY, store);
}

export async function listSites(): Promise<Site[]> {
  return (await readStore()).sites;
}

export async function getSite(id: string): Promise<Site | undefined> {
  return (await listSites()).find((s) => s.id === id);
}

export function siteManagerNames(site: Site): string[] {
  if (Array.isArray(site.managers) && site.managers.length > 0) {
    return site.managers.map((m) => m.trim()).filter(Boolean);
  }
  if (site.manager?.trim()) {
    return site.manager
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return [];
}

export function userManagesSite(
  user: { name: string; email: string; role: string } | null | undefined,
  site: Site,
): boolean {
  if (!user) return false;
  if (user.role === "Super Admin" || user.role === "Company Admin") return true;
  const identities = [user.name, user.email]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return siteManagerNames(site).some((m) => identities.includes(m.toLowerCase()));
}

export function scopeSitesForActor(
  actor: { name: string; email: string; role: string } | null | undefined,
  sites: Site[],
): Site[] {
  if (!actor) return [];
  if (actor.role === "Super Admin" || actor.role === "Company Admin") {
    return sites;
  }
  return sites.filter((site) => userManagesSite(actor, site));
}

export async function setSitePackItemCount(siteId: string, packItems: number): Promise<void> {
  const store = await readStore();
  const site = store.sites.find((s) => s.id === siteId);
  if (!site) return;
  site.packItems = Math.max(0, Math.floor(packItems));
  await writeStore(store);
}

function parseManagersInput(input: {
  managers?: unknown;
  manager?: unknown;
}): string[] {
  if (Array.isArray(input.managers)) {
    return Array.from(
      new Set(
        input.managers
          .map((m) => String(m ?? "").trim())
          .filter(Boolean),
      ),
    );
  }
  if (typeof input.manager === "string") {
    return Array.from(
      new Set(
        input.manager
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

export type CreateSiteInput = {
  name: string;
  address: string;
  status: Site["status"];
  managers?: string[];
  /** @deprecated Prefer managers[]; still accepted for compatibility. */
  manager?: string;
};

export async function createSite(input: CreateSiteInput): Promise<Site> {
  const name = input.name.trim();
  const address = input.address.trim();
  const managers = parseManagersInput(input);
  const status = input.status;

  if (!name) throw new Error("Site name is required");
  if (!address) throw new Error("Site address is required");
  if (!SITE_STATUSES.includes(status)) throw new Error("Select a valid status");

  const store = await readStore();
  if (store.sites.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("A site with this name already exists");
  }

  const nextNum =
    store.sites.reduce((max, s) => {
      const n = Number(s.id.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;

  const site = normalizeSite({
    id: `ST-${String(nextNum).padStart(3, "0")}`,
    name,
    address,
    managers,
    status,
    employees: 0,
    compliance: 0,
    openNcs: 0,
    packItems: 0,
    packExpiring: 0,
  });

  store.sites = [site, ...store.sites];
  await writeStore(store);
  return site;
}

export type UpdateSiteInput = CreateSiteInput;

export async function updateSite(id: string, input: UpdateSiteInput): Promise<Site> {
  const name = input.name.trim();
  const address = input.address.trim();
  const managers = parseManagersInput(input);
  const status = input.status;

  if (!name) throw new Error("Site name is required");
  if (!address) throw new Error("Site address is required");
  if (!SITE_STATUSES.includes(status)) throw new Error("Select a valid status");

  const store = await readStore();
  const idx = store.sites.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Site not found");

  if (
    store.sites.some(
      (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error("A site with this name already exists");
  }

  const current = store.sites[idx];
  const site = normalizeSite({
    ...current,
    name,
    address,
    managers,
    status,
  });

  store.sites[idx] = site;
  await writeStore(store);
  return site;
}

export async function setSiteStatus(
  id: string,
  status: Site["status"],
): Promise<Site> {
  if (!SITE_STATUSES.includes(status)) throw new Error("Select a valid status");
  const store = await readStore();
  const idx = store.sites.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Site not found");
  const current = store.sites[idx]!;
  const site = normalizeSite({ ...current, status });
  store.sites[idx] = site;
  await writeStore(store);
  return site;
}

export async function deleteSite(id: string): Promise<void> {
  const store = await readStore();
  const idx = store.sites.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Site not found");
  store.sites.splice(idx, 1);
  await writeStore(store);
}

export { SITE_STATUSES };
