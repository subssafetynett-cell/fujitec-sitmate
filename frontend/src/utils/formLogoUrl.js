import { computeLogoUrl } from "../hooks/useCompanyLogo";

/** Pick the best logo src for form view/PDF export (skips expired blob URLs). */
export function resolveFormLogoSrc(values = {}, companyLogoUrl = null) {
  const candidates = [
    values.logo_preview,
    typeof values.logo === "string" ? values.logo : null,
    typeof values.logoUrl === "string" ? values.logoUrl : null,
    typeof values.company_logo === "string" ? values.company_logo : null,
    values.company_logo_preview,
  ];

  for (const src of candidates) {
    if (!src || typeof src !== "string") continue;
    if (src.startsWith("blob:")) continue;
    if (src.startsWith("data:") || /^https?:\/\//i.test(src)) return src;
    if (src.startsWith("/")) return computeLogoUrl(src);
  }

  return companyLogoUrl || null;
}

/** Resolve left header logo: saved upload first, then company branding from Clients. */
export function resolveDocLogoSrc(storedLogo, companyLogoUrl = null) {
  return resolveFormLogoSrc({ logo: storedLogo }, companyLogoUrl);
}

/** Restore logo/signature preview fields from persisted base64/url after save or load. */
export function withLogoPreviewFields(answers = {}) {
  if (!answers || typeof answers !== "object") return answers;
  const out = { ...answers };
  const logo = out.logo;
  if (typeof logo === "string" && logo && !logo.startsWith("blob:")) {
    if (!out.logo_preview || out.logo_preview.startsWith("blob:")) {
      out.logo_preview = logo;
    }
  }
  const signature = out.signature;
  if (typeof signature === "string" && signature && !signature.startsWith("blob:")) {
    if (!out.signature_preview || out.signature_preview.startsWith("blob:")) {
      out.signature_preview = signature;
    }
  }
  return out;
}
