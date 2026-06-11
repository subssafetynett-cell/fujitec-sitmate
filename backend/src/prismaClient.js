const { PrismaClient } = require("@prisma/client");
const { applyDatabaseUrlEnv } = require("./utils/databaseUrl");

applyDatabaseUrlEnv();

let databaseUrl = process.env.DATABASE_URL;

function buildPrismaClient(url) {
  return url
    ? new PrismaClient({
        datasources: {
          db: { url },
        },
      })
    : new PrismaClient();
}

let prisma = buildPrismaClient(databaseUrl);

/**
 * Reconnect Prisma after falling back from pooler to direct Neon URL (or env change).
 */
async function switchDatabaseUrl(nextUrl) {
  const normalized = String(nextUrl || "").trim();
  if (!normalized || normalized === databaseUrl) {
    return prisma;
  }

  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors during URL switch.
  }

  databaseUrl = normalized;
  process.env.DATABASE_URL = normalized;
  prisma = buildPrismaClient(databaseUrl);
  return prisma;
}

function getDatabaseUrl() {
  return databaseUrl;
}

// Proxy so `require('./prismaClient')` stays a PrismaClient while allowing URL switch.
const prismaProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "switchDatabaseUrl") return switchDatabaseUrl;
      if (prop === "getDatabaseUrl") return getDatabaseUrl;
      const value = prisma[prop];
      return typeof value === "function" ? value.bind(prisma) : value;
    },
  }
);

module.exports = prismaProxy;
