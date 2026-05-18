/**
 * Date helpers for site document "Valid Until" expiry.
 * Dates are stored as YYYY-MM-DD (HTML date input). A document is valid through
 * the Valid Until day and is removed starting the following calendar day.
 */

const DEFAULT_TZ = process.env.DOCUMENT_EXPIRY_TZ || "Europe/London";

/** Today's date as YYYY-MM-DD in the configured timezone. */
function getTodayDateString(timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Normalize user input to YYYY-MM-DD, or null if invalid. */
function normalizeValidUntilDate(input) {
  if (input == null || input === "") return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      return trimmed;
    }
    return null;
  }

  const dmY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    const year = Number(dmY[3]);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return normalizeValidUntilDate(iso);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** True when validUntil is before today (expired after end of validUntil day). */
function isValidUntilExpired(validUntil, today = getTodayDateString()) {
  const normalized = normalizeValidUntilDate(validUntil);
  if (!normalized) return false;
  return normalized < today;
}

module.exports = {
  getTodayDateString,
  normalizeValidUntilDate,
  isValidUntilExpired,
};
