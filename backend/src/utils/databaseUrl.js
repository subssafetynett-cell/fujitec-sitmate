/**
 * Normalize Postgres connection strings (Neon cold starts, SSL, pooler).
 * Mutates process.env.DATABASE_URL when applied at startup.
 */
function normalizeDatabaseUrl(rawUrl, { app = true } = {}) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;

  const trimmed = rawUrl.trim();
  if (!trimmed) return rawUrl;

  try {
    const normalized = trimmed.replace(/^postgresql:/i, "postgres:");
    const url = new URL(normalized);
    const isNeon = url.hostname.includes(".neon.tech");

    if (isNeon) {
      if (!url.searchParams.has("sslmode")) {
        url.searchParams.set("sslmode", "require");
      }
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "30");
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "30");
      }
      // Runtime queries: pooled Neon endpoints need pgbouncer for Prisma.
      if (
        app &&
        url.hostname.includes("-pooler.") &&
        !url.searchParams.has("pgbouncer")
      ) {
        url.searchParams.set("pgbouncer", "true");
      }
      if (!app) {
        url.searchParams.delete("pgbouncer");
      }
    }

    return url.toString().replace(/^postgres:/i, "postgresql:");
  } catch {
    let out = trimmed;
    if (out.includes(".neon.tech")) {
      if (!out.includes("sslmode=")) {
        out += `${out.includes("?") ? "&" : "?"}sslmode=require`;
      }
      if (!out.includes("connect_timeout=")) {
        out += `${out.includes("?") ? "&" : "?"}connect_timeout=30`;
      }
      if (app && out.includes("-pooler.") && !/pgbouncer=/.test(out)) {
        out += `${out.includes("?") ? "&" : "?"}pgbouncer=true`;
      }
      if (!app) {
        out = out.replace(/[?&]pgbouncer=[^&]*/g, "");
      }
    }
    return out;
  }
}

/** Non-pooler URL for Prisma migrate (derived from pooled Neon URL when needed). */
function deriveDirectDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;

  const base = normalizeDatabaseUrl(rawUrl, { app: false });
  try {
    const url = new URL(base.replace(/^postgresql:/i, "postgres:"));
    if (url.hostname.includes("-pooler.")) {
      url.hostname = url.hostname.replace("-pooler.", ".");
    }
    url.searchParams.delete("pgbouncer");
    return url.toString().replace(/^postgres:/i, "postgresql:");
  } catch {
    return base.replace(/-pooler\./g, ".").replace(/[?&]pgbouncer=[^&]*/g, "");
  }
}

function applyDatabaseUrlEnv() {
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = normalizeDatabaseUrl(process.env.DIRECT_URL, {
      app: false,
    });
  }

  if (!process.env.DATABASE_URL) return null;

  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL, {
    app: true,
  });

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = deriveDirectDatabaseUrl(process.env.DATABASE_URL);
  }

  return process.env.DATABASE_URL;
}

function isTransientDatabaseError(err) {
  const code = err?.code;
  const message = String(err?.message || "");
  return (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    /can't reach database server/i.test(message) ||
    /connection terminated unexpectedly/i.test(message) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/i.test(message)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry DB connectivity (Neon suspend / brief network blips).
 */
async function ensureDatabaseConnection(client, { attempts = 12, delayMs = 5000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.$queryRaw`SELECT 1`;
      if (attempt > 1) {
        console.log(`Database connection succeeded on attempt ${attempt}.`);
      }
      return true;
    } catch (err) {
      lastError = err;
      if (!isTransientDatabaseError(err) || attempt >= attempts) {
        throw err;
      }
      console.warn(
        `Database not reachable (attempt ${attempt}/${attempts}): ${err.message || err}`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

module.exports = {
  normalizeDatabaseUrl,
  deriveDirectDatabaseUrl,
  applyDatabaseUrlEnv,
  isTransientDatabaseError,
  ensureDatabaseConnection,
};
