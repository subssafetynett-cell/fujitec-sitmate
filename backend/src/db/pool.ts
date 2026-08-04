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

function useSsl(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  const flag = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "disable") return false;
  if (flag === "true" || flag === "1" || flag === "require") {
    return { rejectUnauthorized: false };
  }

  try {
    const url = new URL(connectionString);
    const mode = (url.searchParams.get("sslmode") || "").toLowerCase();
    if (mode === "disable") return false;
    if (mode === "require" || mode === "verify-ca" || mode === "verify-full") {
      return { rejectUnauthorized: false };
    }
    // Managed hosts (Render, etc.) need SSL; local Docker Postgres does not.
    if (
      url.hostname === "db" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".local")
    ) {
      return false;
    }
    if (url.hostname.includes("render.com") || url.hostname.includes("amazonaws.com")) {
      return { rejectUnauthorized: false };
    }
  } catch {
    // fall through
  }

  // Default: no SSL (local / Coolify internal Postgres)
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
