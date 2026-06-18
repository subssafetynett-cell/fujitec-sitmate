const { isSafetynettCompanyName } = require("./company");

const CANONICAL_SAFETYNETT_NAME = "Safetynett";

function normalizeClientNameKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function buildClientNameFields(name) {
  const displayName = String(name ?? "").trim();
  return {
    name: displayName,
    nameKey: normalizeClientNameKey(displayName),
  };
}

function isClientNameUniqueViolation(err) {
  if (err?.code !== "P2002") return false;
  const target = err?.meta?.target;
  const fields = Array.isArray(target) ? target : [target].filter(Boolean);
  return fields.some((field) => field === "name" || field === "nameKey");
}

function clientNameConflictBody(includeFieldErrors = true) {
  const message = "A client with this name already exists";
  return includeFieldErrors
    ? { success: false, message, errors: { name: message } }
    : { success: false, message };
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
  buildClientNameFields,
  isClientNameUniqueViolation,
  clientNameConflictBody,
  dedupeClientsByName,
  isSafetynettCompanyName,
};
