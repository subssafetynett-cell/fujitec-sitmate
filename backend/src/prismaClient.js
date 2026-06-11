const { PrismaClient } = require("@prisma/client");
const { applyDatabaseUrlEnv } = require("./utils/databaseUrl");

applyDatabaseUrlEnv();

const databaseUrl = process.env.DATABASE_URL;

const prisma = databaseUrl
  ? new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
    })
  : new PrismaClient();

module.exports = prisma;
