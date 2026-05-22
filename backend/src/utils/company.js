/**
 * True when company name is Safetynett (case- and spacing-insensitive).
 * @param {unknown} name
 */
function isSafetynettCompanyName(name) {
  return (
    String(name ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "") === "safetynett"
  );
}

/** Seeded platform owner (SUPERADMIN_EMAIL) — always superadmin even under Safetynett client. */
function isPlatformSuperadminEmail(email) {
  const seed = String(process.env.SUPERADMIN_EMAIL || "admin@safetynet.com")
    .trim()
    .toLowerCase();
  return String(email ?? "").trim().toLowerCase() === seed;
}

/** Safetynett org users must not hold superadmin — except the platform seed account. */
function assertRoleAllowedForCompany(role, companyName, email) {
  const r = String(role || "").toLowerCase();
  if (
    r === "superadmin" &&
    isSafetynettCompanyName(companyName) &&
    !isPlatformSuperadminEmail(email)
  ) {
    return {
      ok: false,
      message: "The superadmin role cannot be assigned to Safetynett company users.",
    };
  }
  return { ok: true };
}

module.exports = {
  isSafetynettCompanyName,
  isPlatformSuperadminEmail,
  assertRoleAllowedForCompany,
};
