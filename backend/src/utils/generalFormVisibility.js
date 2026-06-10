const GENERAL_FORM_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
};

const SHEQ_CATEGORIES = new Set(["SHEQ Installation", "SHEQ Inspection"]);

function isSheqCategory(category) {
  return SHEQ_CATEGORIES.has(category);
}

function normalizeVisibility(value) {
  return value === GENERAL_FORM_VISIBILITY.PUBLIC
    ? GENERAL_FORM_VISIBILITY.PUBLIC
    : GENERAL_FORM_VISIBILITY.PRIVATE;
}

function getVisibilityFromAnswers(answers) {
  if (!answers || typeof answers !== "object") {
    return GENERAL_FORM_VISIBILITY.PRIVATE;
  }
  if (!hasExplicitGeneralFormVisibility(answers)) {
    return GENERAL_FORM_VISIBILITY.PRIVATE;
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
 * globalAccess: platform superadmin — non-private submissions when not acting as a client.
 * companyWideRead: superadmin "View as company" — non-private same-company submissions;
 *   site-pack fills (siteId in answers) remain submitter-only.
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

  // Site-pack fills are personal even for company-wide read.
  if (siteContextPresent(row.answers)) {
    return false;
  }

  if (sameCompany && getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PUBLIC) {
    return true;
  }

  if (companyWideRead) {
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
