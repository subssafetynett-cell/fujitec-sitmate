const GENERAL_FORM_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
};

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

/**
 * Read access: own submissions always; others' only if public and same company.
 */
function canViewFormResponse(row, userId, clientId) {
  if (!row) return false;
  if (row.submittedById === userId) return true;
  if (siteContextPresent(row.answers)) {
    return row.submittedById === userId;
  }
  if (getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PRIVATE) {
    return false;
  }
  const submitterClientId = row.submittedBy?.clientId;
  if (!clientId || !submitterClientId) return false;
  return submitterClientId === clientId;
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
  canViewFormResponse,
  sanitizeVisibilityOnSave,
  siteContextPresent,
};
