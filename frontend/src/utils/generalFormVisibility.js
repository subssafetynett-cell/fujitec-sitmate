export const GENERAL_FORM_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
};

export function normalizeGeneralFormVisibility(value) {
  return value === GENERAL_FORM_VISIBILITY.PRIVATE
    ? GENERAL_FORM_VISIBILITY.PRIVATE
    : GENERAL_FORM_VISIBILITY.PUBLIC;
}

export function getSubmissionVisibility(submission) {
  return normalizeGeneralFormVisibility(submission?.answers?.visibility);
}

/** Who can see this saved general-form template in lists and site pack picker. */
export function isGeneralFormVisibleToUser(submission, currentUserId, currentClientId) {
  if (!submission) return false;
  const submitterId = submission.submittedById || submission.submittedBy?.id;
  if (submitterId && submitterId === currentUserId) return true;
  if (getSubmissionVisibility(submission) === GENERAL_FORM_VISIBILITY.PRIVATE) return false;
  const submitterClientId = submission.submittedBy?.clientId;
  if (!currentClientId || !submitterClientId) return false;
  return submitterClientId === currentClientId;
}

export function visibilityLabel(visibility) {
  return normalizeGeneralFormVisibility(visibility) === GENERAL_FORM_VISIBILITY.PRIVATE
    ? "Private"
    : "Public";
}

/** Attach visibility when saving from General Forms (not site pack). */
export function withGeneralFormVisibility(payload, visibility, { hasSiteContext = false } = {}) {
  if (hasSiteContext) return payload;
  return {
    ...payload,
    visibility: normalizeGeneralFormVisibility(visibility),
  };
}
