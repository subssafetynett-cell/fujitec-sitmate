import { getActingClient } from "./actingClient";

function normalizeClientId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const nested = value.id || value._id;
    return nested != null && String(nested).trim() !== "" ? String(nested) : null;
  }
  const id = String(value).trim();
  return id && id !== "[object Object]" ? id : null;
}

/** Stable organisation scope for KPI storage (survives logout/login). */
export function resolveKpiStorageScope(currentUser) {
  const acting = getActingClient();
  const actingId = normalizeClientId(acting?.id);
  if (actingId) return actingId;
  return normalizeClientId(currentUser?.clientId);
}

export function buildKpiLocalStorageKeys(scope, prefixes) {
  const suffix = scope || "default";
  return {
    stats: `${prefixes.stats}${suffix}`,
    targets: `${prefixes.targets}${suffix}`,
    meta: `${prefixes.meta}${suffix}`,
    snapshot: prefixes.snapshot ? `${prefixes.snapshot}${suffix}` : null,
  };
}
