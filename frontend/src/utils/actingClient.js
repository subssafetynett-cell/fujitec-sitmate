import { isSafetynettCompanyName } from "./resolveEffectiveRole";

const ACTING_CLIENT_KEY = "actingClient";

export function isSafetynettClient(client) {
  return isSafetynettCompanyName(client?.name);
}

/** Client org the superadmin is currently viewing as (local session only). */
export function getActingClient() {
  try {
    const raw = localStorage.getItem(ACTING_CLIENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    if (isSafetynettCompanyName(parsed.name)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActingClient(client) {
  if (isSafetynettClient(client)) return;
  const id = client?.id ?? client?._id;
  if (!id) return;
  localStorage.setItem(
    ACTING_CLIENT_KEY,
    JSON.stringify({
      id: String(id),
      name: client.name || "",
      logo: client.logo ?? null,
    })
  );
}

export function clearActingClient() {
  localStorage.removeItem(ACTING_CLIENT_KEY);
}

/** Exit client scope — full platform superadmin (Safetynett home org). */
export function restorePlatformSuperadminSession() {
  clearActingClient();
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const u = JSON.parse(raw);
    const company =
      u._platformCompanyname ??
      (isSafetynettCompanyName(u.companyname) ? u.companyname : "Safetynett");
    const clientId = u._platformClientId ?? u.clientId;
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...u,
        role: u.role || "superadmin",
        companyname: company,
        company,
        clientId,
      })
    );
  } catch {
    /* ignore */
  }
}

/** True when API should send X-Acting-Client-Id (scoped client, not platform home). */
export function shouldSendActingClientHeader(user) {
  const acting = getActingClient();
  return Boolean(acting?.id && user);
}

/** Overlay acting company onto the stored user for UI and scoped lists. */
export function applyActingClientToUser(user) {
  const acting = getActingClient();
  if (!acting?.id || !user) return user;
  return {
    ...user,
    clientId: acting.id,
    companyname: acting.name,
    company: acting.name,
  };
}
