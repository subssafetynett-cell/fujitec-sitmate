const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

// Coolify / Docker Compose inject env vars — dotenv only fills gaps for local dev.
// Local monorepo: repo root `.env` lives one level above `backend/` when __dirname is backend.
// In Docker, WORKDIR is /app and __dirname is /app — parent is "/" so we skip loading `/.env`.
const parentDir = path.dirname(__dirname);
const rootEnv = path.join(parentDir, ".env");
if (parentDir && parentDir !== path.parse(parentDir).root) {
  loadEnvFile(rootEnv);
}
loadEnvFile(path.join(__dirname, ".env"));

// Normalize Neon DATABASE_URL / derive DIRECT_URL before Prisma or the API starts.
try {
  const { applyDatabaseUrlEnv } = require("./src/utils/databaseUrl");
  applyDatabaseUrlEnv();
} catch {
  // loadEnv may run before dependencies are installed (e.g. first npm install).
}
