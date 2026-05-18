const prisma = require("../prismaClient");
const { deleteStoredDocument } = require("../utils/documentStorage");
const { getTodayDateString, isValidUntilExpired } = require("../utils/documentExpiry");

/**
 * Delete site documents whose Valid Until date has passed.
 * Removes files from Cloudinary and local /uploads storage, then DB rows.
 */
async function purgeExpiredDocuments() {
  const today = getTodayDateString();

  const candidates = await prisma.siteDocument.findMany({
    select: { id: true, title: true, url: true, validUntil: true },
  });

  const expired = candidates.filter((doc) => isValidUntilExpired(doc.validUntil, today));
  if (expired.length === 0) return 0;

  let deleted = 0;
  for (const doc of expired) {
    try {
      if (doc.url) {
        await deleteStoredDocument(doc.url);
      }
      await prisma.siteDocument.delete({ where: { id: doc.id } });
      deleted += 1;
      console.log(
        `[document-expiry] Removed expired document "${doc.title}" (valid until ${doc.validUntil})`
      );
    } catch (err) {
      console.error(`[document-expiry] Failed to remove document ${doc.id}:`, err);
    }
  }

  if (deleted > 0) {
    console.log(`[document-expiry] Purged ${deleted} expired site document(s)`);
  }

  return deleted;
}

function startExpiredDocumentCleanupScheduler() {
  const intervalMs =
    Number(process.env.DOCUMENT_CLEANUP_INTERVAL_MS) || 6 * 60 * 60 * 1000;

  const run = () => {
    purgeExpiredDocuments().catch((err) => {
      console.error("[document-expiry] Scheduled cleanup failed:", err);
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  console.log(
    `[document-expiry] Cleanup scheduled every ${Math.round(intervalMs / 60000)} minutes`
  );
}

module.exports = {
  purgeExpiredDocuments,
  startExpiredDocumentCleanupScheduler,
};
