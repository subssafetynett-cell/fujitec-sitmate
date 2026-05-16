/** Roles allowed to create/edit general form templates from /general-forms (no site pack context). */
export const GENERAL_FORM_TEMPLATE_EDITOR_ROLES = [
  "superadmin",
  "company_admin",
  "site_manager",
];

export const GENERAL_FORM_TEMPLATE_EDITOR_ROLES_TEXT =
  "Super Admin, Company Admin, and Site Manager";

export const GENERAL_FORM_TEMPLATE_READONLY_MESSAGE =
  "View only — only a Super Admin, Company Admin, or Site Manager can edit or save templates from this page. Use a site pack link to fill this form for a site.";

/**
 * @param {string} role — effective role from AuthContext (Safetynett → superadmin already applied).
 * @param {{ siteId?: string | null }} opts — site pack / site context allows operational editing for all roles that can open the route.
 */
export function canEditGeneralFormTemplate(role, { siteId } = {}) {
  if (siteId != null && String(siteId).trim() !== "") return true;
  return GENERAL_FORM_TEMPLATE_EDITOR_ROLES.includes(role);
}

export function canEditGeneralFormTemplatesList(role) {
  return GENERAL_FORM_TEMPLATE_EDITOR_ROLES.includes(role);
}
