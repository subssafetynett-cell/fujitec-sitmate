/**
 * Normalize DATABASE_URL / DIRECT_URL and write shell exports for docker-migrate.sh.
 */
const fs = require("fs");
const path = require("path");
const { applyDatabaseUrlEnv } = require("../src/utils/databaseUrl");

applyDatabaseUrlEnv();

const outPath = process.argv[2] || path.join(__dirname, "..", ".db-env.sh");
const quote = (value) => `'${String(value ?? "").replace(/'/g, `'\"'\"'`)}'`;

const lines = [
  `export DATABASE_URL=${quote(process.env.DATABASE_URL)}`,
  `export DIRECT_URL=${quote(process.env.DIRECT_URL || "")}`,
  "",
];

fs.writeFileSync(outPath, lines.join("\n"), { mode: 0o600 });
