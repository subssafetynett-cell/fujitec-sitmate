import type { OrgCompany } from "./sheq.js";
import { query } from "../db/pool.js";

const MAX_LOGO_CHARS = 1_500_000;

function normalizeCompany(raw: {
  id: string;
  name: string;
  industry?: string | null;
  country?: string | null;
  logo?: string | null;
  status?: string | null;
  created_at?: string | Date | null;
  createdAt?: string | null;
}): OrgCompany {
  const created =
    raw.createdAt ??
    (raw.created_at instanceof Date
      ? raw.created_at.toISOString().slice(0, 10)
      : typeof raw.created_at === "string"
        ? raw.created_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10));

  return {
    id: raw.id,
    name: raw.name,
    industry: raw.industry ?? "",
    country: raw.country ?? "",
    logo: typeof raw.logo === "string" ? raw.logo : "",
    status: raw.status === "Inactive" ? "Inactive" : "Active",
    createdAt: created,
  };
}

export async function listCompanies(): Promise<OrgCompany[]> {
  const result = await query<{
    id: string;
    name: string;
    industry: string;
    country: string;
    logo: string;
    status: string;
    created_at: Date;
  }>("SELECT id, name, industry, country, logo, status, created_at FROM companies ORDER BY created_at DESC, name ASC");
  return result.rows.map((row) => normalizeCompany(row));
}

type CompanyRow = {
  id: string;
  name: string;
  industry: string;
  country: string;
  logo: string;
  status: string;
  created_at: Date | string;
};

export async function getCompany(id: string): Promise<OrgCompany | undefined> {
  const result = await query<CompanyRow>(
    "SELECT id, name, industry, country, logo, status, created_at FROM companies WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? normalizeCompany(row) : undefined;
}

export async function companyExists(name: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM companies WHERE lower(name) = lower($1)) AS exists",
    [name.trim()],
  );
  return Boolean(result.rows[0]?.exists);
}

export type CreateCompanyInput = {
  name: string;
  industry: string;
  country: string;
  logo?: string;
  status?: OrgCompany["status"];
};

export type UpdateCompanyInput = {
  name: string;
  industry: string;
  country: string;
  logo?: string;
  status?: OrgCompany["status"];
};

function validateCompanyFields(input: {
  name: string;
  industry: string;
  country: string;
  logo?: string;
}) {
  const name = input.name.trim();
  const industry = input.industry.trim();
  const country = input.country.trim();
  const logo = (input.logo ?? "").trim();

  if (!name) throw new Error("Company name is required");
  if (!industry) throw new Error("Industry is required");
  if (!country) throw new Error("Country is required");
  if (logo) {
    const isDataImage = logo.startsWith("data:image/");
    const isHttpUrl = /^https?:\/\//i.test(logo);
    if (!isDataImage && !isHttpUrl) {
      throw new Error("Logo must be an image file or Cloudinary URL");
    }
    if (isDataImage && logo.length > MAX_LOGO_CHARS) {
      throw new Error("Logo is too large (max about 1MB) — upload via Cloudinary first");
    }
  }

  return { name, industry, country, logo };
}

export async function createCompany(input: CreateCompanyInput): Promise<OrgCompany> {
  const { name, industry, country, logo: rawLogo } = validateCompanyFields(input);
  const status = input.status === "Inactive" ? "Inactive" : "Active";
  const { maybeUploadDataUrl } = await import("../lib/cloudinary.js");
  const logo = await maybeUploadDataUrl(rawLogo, {
    folder: "sheq-harmony/companies",
    resourceType: "image",
  });

  if (await companyExists(name)) {
    throw new Error("A company with this name already exists");
  }

  const maxResult = await query<{ max: string | null }>(
    `SELECT MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int)::text AS max FROM companies`,
  );
  const nextNum = Number(maxResult.rows[0]?.max ?? 0) + 1;
  const id = `COM-${String(nextNum).padStart(3, "0")}`;
  const createdAt = new Date().toISOString().slice(0, 10);

  await query(
    `INSERT INTO companies(id, name, industry, country, logo, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, name, industry, country, logo, status, createdAt],
  );

  return {
    id,
    name,
    industry,
    country,
    logo,
    status,
    createdAt,
  };
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<OrgCompany> {
  const existing = await getCompany(id);
  if (!existing) throw new Error("Company not found");

  const { name, industry, country, logo: rawLogo } = validateCompanyFields({
    ...input,
    logo: input.logo === undefined ? existing.logo : input.logo,
  });
  const { maybeUploadDataUrl } = await import("../lib/cloudinary.js");
  const logo = await maybeUploadDataUrl(rawLogo, {
    folder: "sheq-harmony/companies",
    resourceType: "image",
  });
  const status =
    input.status === "Inactive"
      ? "Inactive"
      : input.status === "Active"
        ? "Active"
        : existing.status;

  const clash = await query<{ id: string }>(
    "SELECT id FROM companies WHERE lower(name) = lower($1) AND id <> $2",
    [name, id],
  );
  if (clash.rows[0]) {
    throw new Error("A company with this name already exists");
  }

  const result = await query<CompanyRow>(
    `UPDATE companies
     SET name = $2, industry = $3, country = $4, logo = $5, status = $6
     WHERE id = $1
     RETURNING id, name, industry, country, logo, status, created_at`,
    [id, name, industry, country, logo, status],
  );

  return normalizeCompany(result.rows[0]!);
}

export async function setCompanyStatus(
  id: string,
  status: OrgCompany["status"],
): Promise<OrgCompany> {
  const next = status === "Inactive" ? "Inactive" : "Active";
  const result = await query<CompanyRow>(
    `UPDATE companies
     SET status = $2
     WHERE id = $1
     RETURNING id, name, industry, country, logo, status, created_at`,
    [id, next],
  );
  if (!result.rows[0]) throw new Error("Company not found");
  return normalizeCompany(result.rows[0]);
}

export async function deleteCompany(id: string): Promise<void> {
  const result = await query("DELETE FROM companies WHERE id = $1 RETURNING id", [id]);
  if (!result.rows[0]) throw new Error("Company not found");
}
