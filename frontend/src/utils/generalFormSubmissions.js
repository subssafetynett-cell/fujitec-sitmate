/** Category used when saving from /general-forms (no site pack). */
export const GENERAL_FORMS_CATEGORY = "General forms";

/** Category used when saving from site pack → Friday Pack Forms module. */
export const FRIDAY_PACK_FORMS_CATEGORY = "Friday Pack Forms";

export const GENERAL_FORM_TEMPLATE_TITLES = [
  "Tool Box Talk Register",
  "RAMS Briefing Form",
  "Site Induction Register",
  "Management Site Inspection Report",
  "Daily Safe Start Briefing Sheet",
  "Audit Action Form",
  "Site Induction Form",
  "LOLER Inspection Form",
  "PUWER Inspection Form",
];

const TEMPLATE_TITLE_SET = new Set(GENERAL_FORM_TEMPLATE_TITLES);

export function submissionHasSiteContext(sub) {
  const siteId = sub?.answers?.siteId ?? sub?.siteId;
  return siteId != null && String(siteId).trim() !== "";
}

/**
 * Submissions that belong on the General Forms "Manage Submissions" list
 * (template edits saved from /general-forms, not Friday Pack site submissions).
 */
export function isGeneralFormsPageSubmission(sub) {
  const title = sub?.form?.title;
  if (!title || !TEMPLATE_TITLE_SET.has(title)) return false;

  const category = (sub.category || "").trim();
  if (category === FRIDAY_PACK_FORMS_CATEGORY) return false;
  if (submissionHasSiteContext(sub)) return false;

  if (category === GENERAL_FORMS_CATEGORY || category === "") return true;

  return false;
}

/**
 * Saved templates to pick when starting a Friday Pack form from a general-form version.
 */
export function isSavedGeneralFormTemplate(sub) {
  return isGeneralFormsPageSubmission(sub);
}
