const { isSafetynettCompanyName } = require("./company");

const CANONICAL_SAFETYNETT_NAME = "Safetynett";

function normalizeClientNameKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function pickPreferredClient(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;

  const key = normalizeClientNameKey(existing.name);
  if (key === "safetynett") {
    if (existing.name === CANONICAL_SAFETYNETT_NAME) return existing;
    if (candidate.name === CANONICAL_SAFETYNETT_NAME) return candidate;
  }

  const existingTime = new Date(existing.createdAt || 0).getTime();
  const candidateTime = new Date(candidate.createdAt || 0).getTime();
  return existingTime <= candidateTime ? existing : candidate;
}

function dedupeClientsByName(clients) {
  const byKey = new Map();
  for (const client of clients || []) {
    const key = normalizeClientNameKey(client.name);
    if (!key) continue;
    byKey.set(key, pickPreferredClient(byKey.get(key), client));
  }
  return Array.from(byKey.values());
}

module.exports = {
  CANONICAL_SAFETYNETT_NAME,
  normalizeClientNameKey,
  dedupeClientsByName,
  isSafetynettCompanyName,
};
