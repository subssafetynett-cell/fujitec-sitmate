import crypto from "node:crypto";
import type { User, UserRole } from "./sheq.js";
import { companyExists, createCompany, listCompanies } from "./companies-store.js";
import { query } from "../db/pool.js";
import { assertValidPassword } from "../lib/password.js";

const USER_ROLES: UserRole[] = [
  "Super Admin",
  "Company Admin",
  "Supervisor",
  "Site Manager",
];

type StoredUser = User & {
  passwordHash?: string;
};

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function defaultCompanyName() {
  const companies = await listCompanies();
  return companies[0]?.name ?? "Unassigned";
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  company: string;
  role: string;
  site: string;
  department: string;
  status: string;
  last_active: string;
  password_hash: string | null;
};

function rowToStored(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile ?? "",
    company: row.company ?? "",
    role: (row.role as UserRole) ?? "Supervisor",
    site: row.site ?? "Unassigned",
    department: row.department ?? "Unassigned",
    status: (row.status as User["status"]) ?? "Invited",
    lastActive: row.last_active ?? "Never",
    ...(row.password_hash ? { passwordHash: row.password_hash } : {}),
  };
}

async function publicUser(user: StoredUser): Promise<User> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return {
    ...rest,
    mobile: rest.mobile ?? "",
    company: rest.company || (await defaultCompanyName()),
  };
}

async function nextUserId() {
  const result = await query<{ max: string | null }>(
    `SELECT MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int)::text AS max FROM users`,
  );
  return `USR-${String(Number(result.rows[0]?.max ?? 0) + 1).padStart(3, "0")}`;
}

export async function listUsers(): Promise<User[]> {
  const result = await query<UserRow>(
    `SELECT id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     FROM users
     ORDER BY name ASC`,
  );
  const users = await Promise.all(result.rows.map((row) => publicUser(rowToStored(row))));
  return users;
}

export async function getUser(id: string): Promise<User | undefined> {
  const result = await query<UserRow>(
    `SELECT id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     FROM users WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? publicUser(rowToStored(row)) : undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  return getUser(id);
}

export async function authenticateUser(email: string, password: string): Promise<User> {
  const normalised = email.trim().toLowerCase();
  if (!normalised || !password) {
    throw new Error("Email and password are required");
  }

  const result = await query<UserRow>(
    `SELECT id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     FROM users WHERE lower(email) = $1`,
    [normalised],
  );
  const row = result.rows[0];
  if (!row || !row.password_hash) {
    throw new Error("Invalid email or password");
  }
  if (row.password_hash !== hashPassword(password)) {
    throw new Error("Invalid email or password");
  }
  if (row.status === "Suspended") {
    throw new Error("This account is suspended");
  }

  const updated = await query<UserRow>(
    `UPDATE users
     SET status = 'Active', last_active = 'Just now'
     WHERE id = $1
     RETURNING id, name, email, mobile, company, role, site, department, status, last_active, password_hash`,
    [row.id],
  );
  return publicUser(rowToStored(updated.rows[0]!));
}

export type SignupUserInput = {
  name: string;
  email: string;
  mobile?: string;
  company: string;
  password: string;
};

export async function signupUser(input: SignupUserInput): Promise<User> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const mobile = (input.mobile ?? "").trim();
  const company = input.company.trim();
  const password = input.password;

  if (!name) throw new Error("Full name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  if (!company) throw new Error("Company is required");
  assertValidPassword(password);

  if (!(await companyExists(company))) {
    await createCompany({
      name: company,
      industry: "General",
      country: "Unspecified",
      status: "Active",
    });
  }

  const existing = await query("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (existing.rows[0]) {
    throw new Error("An account with this email already exists");
  }

  const id = await nextUserId();
  const result = await query<UserRow>(
    `INSERT INTO users(
       id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, name, email, mobile, company, role, site, department, status, last_active, password_hash`,
    [
      id,
      name,
      email,
      mobile || "—",
      company,
      "Supervisor",
      "Unassigned",
      "Unassigned",
      "Active",
      "Just now",
      hashPassword(password),
    ],
  );
  return publicUser(rowToStored(result.rows[0]!));
}

export type InviteUserInput = {
  name: string;
  email: string;
  mobile: string;
  company: string;
  password: string;
  role: UserRole;
};

export async function inviteUser(input: InviteUserInput): Promise<User> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const mobile = input.mobile.trim();
  const company = input.company.trim();
  const password = input.password;
  const role = input.role;

  if (!name) throw new Error("Full name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  if (!mobile) throw new Error("Mobile number is required");
  if (!company || !(await companyExists(company))) {
    throw new Error("Select a valid company");
  }
  assertValidPassword(password);
  if (!USER_ROLES.includes(role)) throw new Error("Invalid role");

  const existing = await query("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (existing.rows[0]) {
    throw new Error("A user with this email already exists");
  }

  const id = await nextUserId();
  const result = await query<UserRow>(
    `INSERT INTO users(
       id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, name, email, mobile, company, role, site, department, status, last_active, password_hash`,
    [
      id,
      name,
      email,
      mobile,
      company,
      role,
      "Unassigned",
      "Unassigned",
      "Invited",
      "Never",
      hashPassword(password),
    ],
  );
  return publicUser(rowToStored(result.rows[0]!));
}

export type UpdateUserInput = {
  name: string;
  email: string;
  mobile: string;
  company: string;
  role: UserRole;
  password?: string;
  status?: User["status"];
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const mobile = input.mobile.trim();
  const company = input.company.trim();
  const role = input.role;
  const password = input.password?.trim() ?? "";

  if (!name) throw new Error("Full name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  if (!mobile) throw new Error("Mobile number is required");
  if (!company || !(await companyExists(company))) {
    throw new Error("Select a valid company");
  }
  if (password) assertValidPassword(password);
  if (!USER_ROLES.includes(role)) throw new Error("Invalid role");

  const existing = await query(
    `SELECT id, status, password_hash FROM users WHERE id = $1`,
    [id],
  );
  if (!existing.rows[0]) throw new Error("User not found");

  const clash = await query(
    "SELECT id FROM users WHERE lower(email) = $1 AND id <> $2",
    [email, id],
  );
  if (clash.rows[0]) {
    throw new Error("A user with this email already exists");
  }

  const result = await query<UserRow>(
    `UPDATE users
     SET name = $2,
         email = $3,
         mobile = $4,
         company = $5,
         role = $6,
         status = $7,
         password_hash = COALESCE($8, password_hash)
     WHERE id = $1
     RETURNING id, name, email, mobile, company, role, site, department, status, last_active, password_hash`,
    [
      id,
      name,
      email,
      mobile,
      company,
      role,
      input.status ?? existing.rows[0].status,
      password ? hashPassword(password) : null,
    ],
  );
  return publicUser(rowToStored(result.rows[0]!));
}

export async function deleteUser(id: string): Promise<void> {
  const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
  if (!result.rows[0]) throw new Error("User not found");
}

/** Authenticated user changes their own password (requires current password). */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const current = currentPassword.trim();
  const next = newPassword.trim();
  if (!current) throw new Error("Current password is required");
  if (!next) throw new Error("New password is required");
  assertValidPassword(next);
  if (current === next) {
    throw new Error("New password must be different from the current password");
  }

  const result = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("User not found");
  if (!row.password_hash) throw new Error("Unable to update password for this account");
  if (row.password_hash !== hashPassword(current)) {
    throw new Error("Current password is incorrect");
  }

  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
    userId,
    hashPassword(next),
  ]);
}

const DEFAULT_SUPERADMIN_EMAIL = "superadmin@sheq.local";
const DEFAULT_SUPERADMIN_PASSWORD = "SuperAdmin1!";
const DEFAULT_SUPERADMIN_COMPANY = "SHEQ Harmony";

/**
 * Ensure a Super Admin login exists (idempotent).
 * Override with SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD / SUPERADMIN_NAME env vars.
 */
export async function ensureDefaultSuperAdmin(): Promise<{
  email: string;
  created: boolean;
}> {
  const email = (process.env.SUPERADMIN_EMAIL || DEFAULT_SUPERADMIN_EMAIL)
    .trim()
    .toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || DEFAULT_SUPERADMIN_PASSWORD;
  const name = (process.env.SUPERADMIN_NAME || "Super Admin").trim() || "Super Admin";
  const company =
    (process.env.SUPERADMIN_COMPANY || DEFAULT_SUPERADMIN_COMPANY).trim() ||
    DEFAULT_SUPERADMIN_COMPANY;

  assertValidPassword(password);

  if (!(await companyExists(company))) {
    await createCompany({
      name: company,
      industry: "Platform",
      country: "Unspecified",
      status: "Active",
    });
  }

  const existing = await query<{ id: string; role: string }>(
    "SELECT id, role FROM users WHERE lower(email) = $1",
    [email],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].role !== "Super Admin") {
      await query(`UPDATE users SET role = 'Super Admin', status = 'Active' WHERE id = $1`, [
        existing.rows[0].id,
      ]);
    }
    // Optional: force-reset bootstrap password when SUPERADMIN_RESET=true
    if (String(process.env.SUPERADMIN_RESET || "").toLowerCase() === "true") {
      await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
        existing.rows[0].id,
        hashPassword(password),
      ]);
    }
    return { email, created: false };
  }

  const id = "USR-SA-001";
  const idTaken = await query("SELECT id FROM users WHERE id = $1", [id]);
  const userId = idTaken.rows[0] ? await nextUserId() : id;

  await query(
    `INSERT INTO users(
       id, name, email, mobile, company, role, site, department, status, last_active, password_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userId,
      name,
      email,
      "—",
      company,
      "Super Admin",
      "Unassigned",
      "Platform",
      "Active",
      "Just now",
      hashPassword(password),
    ],
  );

  return { email, created: true };
}

/** Link selected site managers (by name or email) to a site name. */
export async function syncUsersSiteAssignment(
  managerKeys: string[],
  siteName: string,
  previousKeys: string[] = [],
) {
  const next = new Set(managerKeys.map((k) => k.trim().toLowerCase()).filter(Boolean));
  const prev = new Set(previousKeys.map((k) => k.trim().toLowerCase()).filter(Boolean));

  for (const key of next) {
    await query(
      `UPDATE users
       SET site = $2
       WHERE lower(name) = $1 OR lower(email) = $1`,
      [key, siteName],
    );
  }

  for (const key of prev) {
    if (next.has(key)) continue;
    await query(
      `UPDATE users
       SET site = CASE WHEN site = $2 THEN 'Unassigned' ELSE site END
       WHERE lower(name) = $1 OR lower(email) = $1`,
      [key, siteName],
    );
  }
}

export { USER_ROLES };
