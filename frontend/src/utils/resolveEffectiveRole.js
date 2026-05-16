/** Matches backend `resolveTokenRole` — Safetynett company_admin maps to superadmin only. */

export function isSafetynettCompanyName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") === "safetynett";
}

export function resolveEffectiveRole(user) {
  if (!user) return "worker";
  const dbRole = (user.role || "worker").toString().toLowerCase();
  const company = user.companyname || user.company || user.employer || "";
  if (isSafetynettCompanyName(company) && dbRole === "company_admin") {
    return "superadmin";
  }
  return dbRole;
}
