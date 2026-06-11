/**
 * Fail fast on Coolify / production deploy when required env vars are missing.
 */
const path = require("path");
const dotenv = require("dotenv");

const backendDir = path.join(__dirname, "..");
const repoRoot = path.join(backendDir, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(backendDir, ".env") });

const { applyDatabaseUrlEnv } = require("../src/utils/databaseUrl");
const { readConfiguredBaseUrl } = require("../src/utils/appBaseUrl");

applyDatabaseUrlEnv();

const missing = [];

if (!process.env.DATABASE_URL?.trim()) {
  missing.push("DATABASE_URL (Neon pooled Postgres connection string)");
}

if (!process.env.JWT_SECRET?.trim()) {
  missing.push("JWT_SECRET (long random secret for auth tokens)");
}

const isProduction = process.env.NODE_ENV === "production";
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

console.log("[deploy] Environment validation passed.");
