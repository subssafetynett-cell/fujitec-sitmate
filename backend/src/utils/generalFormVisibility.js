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
 * companyWideRead (company_admin / acting superadmin): all same-company submissions,
 * including private and site-pack fills — admins must download / review all user forms.
 * globalAccess: platform superadmin — all non-private (or SHEQ) when not acting as a client.
 * Field roles: public same-company general forms only (site-pack fills remain submitter-only).
 */
function isSheqResponse(row) {
  if (isSheqCategory(row?.category) || isSheqCategory(row?.form?.title)) {
    return true;
  }
  if (isSheqCategory(row?.answers?.sheqFormCategory)) {
    return true;
  }
  // Legacy SHEQ rows may use the standard SHEQ answer shape without category.
  if (row?.answers?.formData && (row?.answers?.formSections || row?.answers?.docInfo)) {
    return true;
  }
  return false;
}

function responseCompanyId(row) {
  return row?.clientId || row?.submittedBy?.clientId || null;
}

function normalizePersonLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * True when the form's nonconformance "Responsible person" points at this user
 * (by user id, email, or display name).
 */
function isNonconformanceAssignedToUser(answers, viewer = {}) {
  if (!answers || typeof answers !== "object") return false;
  const { userId, email, displayName } = viewer;

  const assignedUserId = answers.noncon_responsible_user_id;
  if (assignedUserId && userId && String(assignedUserId) === String(userId)) {
    return true;
  }

  const assignedEmail = normalizePersonLabel(answers.noncon_responsible_email);
  const viewerEmail = normalizePersonLabel(email);
  if (assignedEmail && viewerEmail && assignedEmail === viewerEmail) {
    return true;
  }

  const assignedName = normalizePersonLabel(answers.noncon_responsible);
  const viewerName = normalizePersonLabel(displayName);
  if (assignedName && viewerName && assignedName === viewerName) {
    return true;
  }

  return false;
}

function canViewFormResponse(row, userId, clientId, options = {}) {
  const { globalAccess = false, companyWideRead = false, userEmail, userDisplayName } =
    options;
  if (!row) return false;
  if (
    row.submittedById &&
    userId &&
    String(row.submittedById) === String(userId)
  ) {
    return true;
  }

  // The user named as responsible for a nonconformance must be able to
  // open the report to action and complete it, even if it is not theirs.
  if (
    isNonconformanceAssignedToUser(row.answers, {
      userId,
      email: userEmail,
      displayName: userDisplayName,
    })
  ) {
    return true;
  }

  // Prefer company stamped on the response at submit time so company moves
  // for the user do not re-home historical submissions.
  const responseClientId = responseCompanyId(row);
  const sameCompany =
    Boolean(clientId && responseClientId) &&
    String(clientId) === String(responseClientId);

  // Company admins / View-as-company: every submission in the org (view + download).
  if (companyWideRead && sameCompany) {
    return true;
  }

  // Platform superadmin (not scoped to one company).
  if (globalAccess) {
    if (isSheqResponse(row) && !siteContextPresent(row.answers)) {
      return true;
    }
    if (getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PRIVATE) {
      return false;
    }
    return true;
  }

  if (getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PRIVATE) {
    return false;
  }

  // Site-pack fills are personal for field roles.
  if (siteContextPresent(row.answers)) {
    return false;
  }

  if (
    sameCompany &&
    getVisibilityFromAnswers(row.answers) === GENERAL_FORM_VISIBILITY.PUBLIC
  ) {
    return true;
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
  isNonconformanceAssignedToUser,
  canViewFormResponse,
  sanitizeVisibilityOnSave,
  siteContextPresent,
  isSheqCategory,
  isSheqResponse,
  responseCompanyId,
};
