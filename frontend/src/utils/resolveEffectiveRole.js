/** Matches backend `resolveTokenRole` — platform seed admin is superadmin; other Safetynett users are not. */

const PLATFORM_SUPERADMIN_EMAIL = (
  import.meta.env.VITE_SUPERADMIN_EMAIL || "admin@safetynet.com"
)
  .trim()
  .toLowerCase();

export function isPlatformSuperadminEmail(email) {
  return String(email ?? "").trim().toLowerCase() === PLATFORM_SUPERADMIN_EMAIL;
}

export function isSafetynettCompanyName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") === "safetynett";
}

/** Account role from JWT/DB only — no Safetynett elevation. */
export function getStoredRole(user) {
  if (!user) return "worker";
  return (user.role || "worker").toString().toLowerCase();
}

export function resolveEffectiveRole(user) {
  if (isPlatformSuperadminEmail(user?.email)) {
    return "superadmin";
  }
  const dbRole = getStoredRole(user);
  const company = user?.companyname || user?.company || user?.employer || "";
  if (isSafetynettCompanyName(company) && dbRole === "superadmin") {
    return "company_admin";
  }
  return dbRole;
}
