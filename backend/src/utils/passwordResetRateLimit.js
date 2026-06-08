const crypto = require("crypto");
const prisma = require("../prismaClient");

/** Max forgot-password requests per email or IP within the rolling window. */
const MAX_REQUESTS = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function rateLimitError() {
  const err = new Error(
    "Too many password reset requests. Please try again in 24 hours."
  );
  err.status = 429;
  err.code = "PASSWORD_RESET_RATE_LIMIT";
  return err;
}

async function countRecentByEmail(emailHash) {
  const since = new Date(Date.now() - WINDOW_MS);
  return prisma.passwordResetAttempt.count({
    where: { emailHash, createdAt: { gte: since } },
  });
}

async function countRecentByIp(ipHash) {
  const since = new Date(Date.now() - WINDOW_MS);
  return prisma.passwordResetAttempt.count({
    where: { ipHash, createdAt: { gte: since } },
  });
}

/**
 * Enforce per-email and per-IP caps before processing a forgot-password request.
 * @param {string} email
 * @param {string|undefined|null} ipAddress
 */
async function assertPasswordResetAllowed(email, ipAddress) {
  const normalized = normalizeEmail(email);
  const emailHash = hashKey(normalized);

  const emailCount = await countRecentByEmail(emailHash);
  if (emailCount >= MAX_REQUESTS) {
    throw rateLimitError();
  }

  const ip = String(ipAddress || "").trim();
  if (ip) {
    const ipHash = hashKey(ip);
    const ipCount = await countRecentByIp(ipHash);
    if (ipCount >= MAX_REQUESTS) {
      throw rateLimitError();
    }
  }
}

/**
 * Record a forgot-password attempt after rate-limit checks pass.
 * @param {string} email
 * @param {string|undefined|null} ipAddress
 */
async function recordPasswordResetAttempt(email, ipAddress) {
  const normalized = normalizeEmail(email);
  const ip = String(ipAddress || "").trim();

  await prisma.passwordResetAttempt.create({
    data: {
      emailHash: hashKey(normalized),
      ipHash: ip ? hashKey(ip) : null,
    },
  });
}

module.exports = {
  MAX_REQUESTS,
  WINDOW_MS,
  assertPasswordResetAllowed,
  recordPasswordResetAttempt,
};
