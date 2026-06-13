/**
 * Normalize Postgres connection strings (Neon cold starts, SSL, pooler).
 * Mutates process.env.DATABASE_URL when applied at startup.
 */

function stripEnvQuotes(value) {
  if (!value || typeof value !== "string") return value;
  return value.trim().replace(/^["']|["']$/g, "");
}

function appendSearchParams(rawUrl, additions) {
  const qIndex = rawUrl.indexOf("?");
  const base = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const query = qIndex === -1 ? "" : rawUrl.slice(qIndex + 1);
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(additions)) {
    if (!params.has(key)) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function removeSearchParams(rawUrl, keysToRemove) {
  const qIndex = rawUrl.indexOf("?");
  if (qIndex === -1) return rawUrl;

  const base = rawUrl.slice(0, qIndex);
  const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
  for (const key of keysToRemove) {
    params.delete(key);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function normalizeDatabaseUrl(rawUrl, { app = true } = {}) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;

  const trimmed = stripEnvQuotes(rawUrl);
  if (!trimmed) return rawUrl;

  const isNeon = trimmed.includes(".neon.tech");
  if (!isNeon) return trimmed;

  const additions = {};
  if (!/sslmode=/i.test(trimmed)) additions.sslmode = "require";
  // Short connect timeout so deploy retries fail fast (Neon wake is handled by probe retries).
  if (!/connect_timeout=/i.test(trimmed)) additions.connect_timeout = "10";
  if (!/pool_timeout=/i.test(trimmed)) additions.pool_timeout = "30";
  if (app && trimmed.includes("-pooler.") && !/pgbouncer=/i.test(trimmed)) {
    additions.pgbouncer = "true";
  }

  let out = appendSearchParams(trimmed, additions);
  if (!app) {
    out = removeSearchParams(out, ["pgbouncer"]);
  }
  return out;
}

/** Non-pooler URL for Prisma migrate (derived from pooled Neon URL when needed). */
function deriveDirectDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;

  const out = normalizeDatabaseUrl(rawUrl, { app: false });
  return out.replace(/-pooler(?=\.)/g, "");
}

const BUILD_PLACEHOLDER_RE = /^postgresql:\/\/build:build@127\.0\.0\.1:5432\/build$/i;

function isBuildPlaceholderUrl(url) {
  return typeof url === "string" && BUILD_PLACEHOLDER_RE.test(stripEnvQuotes(url));
}

function applyDatabaseUrlEnv() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (typeof process.env[key] === "string" && !process.env[key].trim()) {
      delete process.env[key];
    }
  }

  if (isBuildPlaceholderUrl(process.env.DIRECT_URL)) {
    delete process.env.DIRECT_URL;
  }
  if (isBuildPlaceholderUrl(process.env.DATABASE_URL)) {
    delete process.env.DATABASE_URL;
  }

  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = normalizeDatabaseUrl(
      stripEnvQuotes(process.env.DIRECT_URL),
      { app: false }
    );
  }

  if (!process.env.DATABASE_URL) return null;

  process.env.DATABASE_URL = normalizeDatabaseUrl(
    stripEnvQuotes(process.env.DATABASE_URL),
    { app: true }
  );

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = deriveDirectDatabaseUrl(process.env.DATABASE_URL);
  }

  return process.env.DATABASE_URL;
}

function isAuthDatabaseError(err) {
  const code = err?.code;
  const message = String(err?.message || "");
  return (
    code === "P1000" ||
    /authentication failed/i.test(message) ||
    /password authentication failed/i.test(message)
  );
}

function isTransientDatabaseError(err) {
  if (isAuthDatabaseError(err)) return false;

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

/** Short log line without Neon hostnames or multi-line Prisma dumps. */
function formatDatabaseLogMessage(err) {
  const firstLine = String(err?.message || err).split("\n")[0].trim();
  return firstLine.replace(/ep-[a-z0-9.-]+\.neon\.tech:\d+/gi, "<neon-host>");
}

function getDirectDatabaseUrl() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) return null;
  applyDatabaseUrlEnv();
  return process.env.DIRECT_URL || process.env.DATABASE_URL;
}

function getConnectionUrlCandidates() {
  applyDatabaseUrlEnv();
  const urls = [process.env.DIRECT_URL, process.env.DATABASE_URL].filter(Boolean);
  return [...new Set(urls)];
}

async function probeDatabaseConnection(client, { attempts = 12, delayMs = 5000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      lastError = err;
      if (!isTransientDatabaseError(err) || attempt >= attempts) {
        throw err;
      }
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * Retry DB connectivity (Neon suspend / brief network blips).
 * Falls back to DIRECT_URL when the pooled DATABASE_URL cannot be reached.
 */
async function ensureDatabaseConnection(
  client,
  {
    attempts = 12,
    delayMs = 5000,
    fallbackUrl,
    onUseFallback,
  } = {}
) {
  const directUrl = fallbackUrl || process.env.DIRECT_URL;
  const primaryUrl = process.env.DATABASE_URL;

  try {
    await probeDatabaseConnection(client, { attempts, delayMs });
    return client;
  } catch (primaryErr) {
    if (!directUrl || directUrl === primaryUrl || typeof onUseFallback !== "function") {
      throw primaryErr;
    }

    await onUseFallback(directUrl);
    await probeDatabaseConnection(client, { attempts, delayMs });
    return client;
  }
}

module.exports = {
  normalizeDatabaseUrl,
  deriveDirectDatabaseUrl,
  applyDatabaseUrlEnv,
  getDirectDatabaseUrl,
  getConnectionUrlCandidates,
  isAuthDatabaseError,
  isTransientDatabaseError,
  formatDatabaseLogMessage,
  probeDatabaseConnection,
  ensureDatabaseConnection,
};
