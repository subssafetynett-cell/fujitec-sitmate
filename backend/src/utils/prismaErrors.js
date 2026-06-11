const { isTransientDatabaseError } = require("./databaseUrl");

/**
 * Map Prisma / DB errors to safe user-facing messages (no hostnames or internals).
 */
function formatPrismaUserMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;

  if (isTransientDatabaseError(err)) {
    return "The database is temporarily unavailable. Please wait a moment and try again.";
  }

  const code = err.code;
  if (code === "P2021") {
    return "The application database is not fully set up. Contact your administrator.";
  }
  if (code === "P2002") {
    return "This record already exists.";
  }

  // Auth paths should not leak raw Prisma messages.
  if (/prisma/i.test(String(err.message || ""))) {
    return fallback;
  }

  return err.message || fallback;
}

module.exports = {
  formatPrismaUserMessage,
};
