const GENERAL_FORM_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
};

const SHEQ_CATEGORIES = new Set(["SHEQ Installation", "SHEQ Inspection"]);

function isSheqCategory(category) {
  return SHEQ_CATEGORIES.has(category);
}

function normalizeVisibility(value) {
  return value === GENERAL_FORM_VISIBILITY.PRIVATE
    ? GENERAL_FORM_VISIBILITY.PRIVATE
    : GENERAL_FORM_VISIBILITY.PUBLIC;
}

function getVisibilityFromAnswers(answers) {
  if (!answers || typeof answers !== "object") {
    return GENERAL_FORM_VISIBILITY.PUBLIC;
  }
  return normalizeVisibility(answers.visibility);
}

function siteContextPresent(answers) {
  const siteId = answers?.siteId;
  return siteId != null && String(siteId).trim() !== "";
}

/** True when submitter chose Public/Private on a general form (not site-pack / report fills). */
function hasExplicitGeneralFormVisibility(answers) {
  if (!answers || typeof answers !== "object") return false;
  const v = answers.visibility;
  return (
    v === GENERAL_FORM_VISIBILITY.PUBLIC || v === GENERAL_FORM_VISIBILITY.PRIVATE
  );
}

function isExplicitlyPublicGeneralForm(row) {
  if (!row || siteContextPresent(row.answers)) return false;
  if (isSheqCategory(row.category)) return false;
  return (
    hasExplicitGeneralFormVisibility(row.answers) &&
    getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PUBLIC
  );
}

/**
 * Read access: own submissions always.
 * globalAccess: Safetynett / platform superadmin — all non-private in scope.
 * companyWideRead: company_admin / acting superadmin — all non-private in same company,
 *   except site-pack fills (siteId in answers) which remain submitter-only.
 * Field roles: own + SHEQ same company + explicitly public general forms (same company).
 */
function canViewFormResponse(row, userId, clientId, options = {}) {
  const { globalAccess = false, companyWideRead = false } = options;
  if (!row) return false;
  if (row.submittedById === userId) return true;

  if (getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PRIVATE) {
    return false;
  }

  if (globalAccess) {
    return true;
  }

  const submitterClientId = row.submittedBy?.clientId;
  const sameCompany =
    Boolean(clientId && submitterClientId) && clientId === submitterClientId;

  if (isSheqCategory(row.category)) {
    return sameCompany;
  }

  // Site-pack fills are personal even for company_admin / companyWideRead.
  if (siteContextPresent(row.answers)) {
    return false;
  }

  if (companyWideRead) {
    return sameCompany;
  }

  if (isExplicitlyPublicGeneralForm(row)) {
    return sameCompany;
  }

  return false;
}

function sanitizeVisibilityOnSave(answers, body = {}) {
  const merged = { ...(answers || {}) };
  if (siteContextPresent(merged) || siteContextPresent(body)) {
    delete merged.visibility;
    return merged;
  }
  const raw = body.visibility ?? merged.visibility;
  merged.visibility = normalizeVisibility(raw);
  return merged;
}

module.exports = {
  GENERAL_FORM_VISIBILITY,
  normalizeVisibility,
  getVisibilityFromAnswers,
  hasExplicitGeneralFormVisibility,
  isExplicitlyPublicGeneralForm,
  canViewFormResponse,
  sanitizeVisibilityOnSave,
  siteContextPresent,
  isSheqCategory,
};
