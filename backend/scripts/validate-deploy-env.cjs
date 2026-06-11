/**
 * Fail fast on Coolify / production deploy when required env vars are missing.
 */
const path = require("path");
const dotenv = require("dotenv");

const backendDir = path.join(__dirname, "..");
const repoRoot = path.join(backendDir, "..");
const dotenvOpts = { quiet: true };

// Coolify injects env into the container; dotenv only fills gaps for local dev.
if (!process.env.DATABASE_URL?.trim()) {
  dotenv.config({ path: path.join(repoRoot, ".env"), ...dotenvOpts });
  dotenv.config({ path: path.join(backendDir, ".env"), ...dotenvOpts });
}

const { applyDatabaseUrlEnv } = require("../src/utils/databaseUrl");
const { readConfiguredBaseUrl } = require("../src/utils/appBaseUrl");

applyDatabaseUrlEnv();

const isProduction = process.env.NODE_ENV === "production";
const missing = [];

const databaseUrl = process.env.DATABASE_URL?.trim() || "";
if (!databaseUrl) {
  missing.push("DATABASE_URL (Neon pooled Postgres connection string)");
} else if (isProduction && /@(localhost|127\.0\.0\.1|db)(:|\/)/i.test(databaseUrl)) {
  missing.push(
    "DATABASE_URL points at a local database — set your Neon connection string in Coolify"
  );
}

if (!process.env.JWT_SECRET?.trim()) {
  missing.push("JWT_SECRET (long random secret for auth tokens)");
}
if (isProduction && !readConfiguredBaseUrl()) {
  missing.push(
    "APP_URL (public SPA URL, e.g. https://site-mateai.co.uk) — needed for password-reset and invite emails"
  );
}

if (missing.length > 0) {
  console.error("ERROR: Required environment variables are not set:");
  missing.forEach((line) => console.error(`  - ${line}`));
  console.error("");
  console.error("Set these in Coolify → your backend service → Environment Variables, then redeploy.");
  process.exit(1);
}

const dbTarget = databaseUrl.includes(".neon.tech") ? "Neon" : "Postgres";
console.log(`[deploy] Environment validation passed (${dbTarget} database).`);
