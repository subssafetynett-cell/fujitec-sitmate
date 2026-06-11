/**
 * Run Prisma CLI with DATABASE_URL from the monorepo root `.env` (same as server.js / docker-migrate.sh).
 * Usage: node scripts/prisma-with-env.cjs migrate deploy
 */
const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const backendDir = path.join(__dirname, "..");
const repoRoot = path.join(backendDir, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(backendDir, ".env") });

if (!process.env.DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is not set.\n" +
      "Add it to the repo root .env (see .env.docker.example), or run: npm run migrate"
  );
  process.exit(1);
}

const { applyDatabaseUrlEnv } = require("../src/utils/databaseUrl");
applyDatabaseUrlEnv();

const prismaCli = require.resolve("prisma/build/index.js");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [prismaCli, ...args], {
  cwd: backendDir,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
