import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function resolveDatabaseUrl() {
  const raw = (process.env.DATABASE_URL || "").trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  // Render internal hostnames are not resolvable from local Docker / laptops.
  // Rewrite to the public Oregon endpoint when needed.
  try {
    const url = new URL(raw);
    if (/^dpg-[a-z0-9]+-a$/i.test(url.hostname)) {
      url.hostname = `${url.hostname}.oregon-postgres.render.com`;
      return url.toString();
    }
  } catch {
    // keep raw
  }
  return raw;
}

function isLocalDbHost(hostname: string): boolean {
  return (
    hostname === "db" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

function requiresManagedSsl(hostname: string): boolean {
  return (
    hostname.includes("render.com") ||
    hostname.includes("amazonaws.com") ||
    hostname.includes("neon.tech") ||
    hostname.includes("supabase.co") ||
    hostname.includes("digitalocean.com") ||
    /^dpg-[a-z0-9]+-a$/i.test(hostname)
  );
}

/**
 * SSL policy:
 * - local compose / localhost → never SSL
 * - managed hosts (Render, etc.) → always SSL
 * - DATABASE_SSL / sslmode override when host is neither
 */
function useSsl(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  let hostname = "";
  let sslmode = "";
  try {
    const url = new URL(connectionString);
    hostname = url.hostname;
    sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();
  } catch {
    // keep empty
  }

  if (isLocalDbHost(hostname) || sslmode === "disable") {
    return false;
  }

  if (
    requiresManagedSsl(hostname) ||
    sslmode === "require" ||
    sslmode === "verify-ca" ||
    sslmode === "verify-full"
  ) {
    return { rejectUnauthorized: false };
  }

  const flag = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "disable") return false;
  if (flag === "true" || flag === "1" || flag === "require") {
    return { rejectUnauthorized: false };
  }

  // Coolify / unknown internal Postgres: no SSL by default
  return false;
}

export function getPool() {
  if (!pool) {
    const connectionString = resolveDatabaseUrl();
    pool = new Pool({
      connectionString,
      ssl: useSsl(connectionString),
      max: 10,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
