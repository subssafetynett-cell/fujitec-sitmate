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

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
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
