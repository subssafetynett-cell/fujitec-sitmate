import {
  FRIDAY_PACK_FORMS_CATEGORY,
  GENERAL_FORMS_CATEGORY,
} from "./generalFormSubmissions";

export function normalizeSitepackId(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t !== "" ? t : null;
}

/** Category for saves when opened from site pack (Friday Pack module) vs /general-forms. */
export function resolveFormCategoryFromSearchParams(searchParams) {
  const explicit = searchParams.get("category")?.trim();
  if (explicit) return explicit;
  if (normalizeSitepackId(searchParams.get("siteId"))) {
    return FRIDAY_PACK_FORMS_CATEGORY;
  }
  return GENERAL_FORMS_CATEGORY;
}

export function resolveSitepackModuleTitle(category, { siteId, subfolderId } = {}) {
  if (!siteId) return category || null;
  if (category && category !== GENERAL_FORMS_CATEGORY) return category;
  if (subfolderId) return FRIDAY_PACK_FORMS_CATEGORY;
  return category || FRIDAY_PACK_FORMS_CATEGORY;
}

export function appendSitepackToAnswers(
  payload,
  { siteId, subfolderId, monitoringSection } = {}
) {
  const out = { ...payload };
  const sid = normalizeSitepackId(siteId);
  const sfid = normalizeSitepackId(subfolderId);
  const ms = normalizeSitepackId(monitoringSection);
  if (sid) out.siteId = sid;
  if (sfid) out.subfolderId = sfid;
  if (ms) out.monitoringSection = ms;
  return out;
}

/** Sentinel id for site-pack items saved before subfolders or without a subfolder. */
export const UNFILED_SUBFOLDER_ID = "__sitepack_unfiled__";

/** Sentinel id for viewing every saved item in a category across all subfolders. */
export const ALL_SITEPACK_FORMS_ID = "__sitepack_all__";

export function createUnfiledSubfolder() {
  return { id: UNFILED_SUBFOLDER_ID, name: "Unfiled items", isUnfiled: true };
}

export function createAllFormsSubfolder(count = 0) {
  return {
    id: ALL_SITEPACK_FORMS_ID,
    name: "All saved forms",
    isAllForms: true,
    itemCount: count,
  };
}

export function isUnfiledSubfolder(subfolder) {
  return (
    subfolder?.isUnfiled === true || subfolder?.id === UNFILED_SUBFOLDER_ID
  );
}

export function isAllFormsSubfolder(subfolder) {
  return (
    subfolder?.isAllForms === true || subfolder?.id === ALL_SITEPACK_FORMS_ID
  );
}

export function isOrphanedSitepackSubfolder(subfolderId, knownSubfolderIds) {
  const normalized = normalizeSitepackId(subfolderId);
  if (!normalized) return false;
  if (!Array.isArray(knownSubfolderIds) || knownSubfolderIds.length === 0) {
    return false;
  }
  return !knownSubfolderIds.includes(normalized);
}

export function matchesSitepackScope(
  record,
  {
    siteId,
    subfolderId,
    unfiledOnly = false,
    allFormsOnly = false,
    knownSubfolderIds = null,
  } = {}
) {
  const rSiteId = record.answers?.siteId ?? record.siteId;
  const rSubfolderId = normalizeSitepackId(
    record.answers?.subfolderId ?? record.subfolderId
  );
  const wantSite = normalizeSitepackId(siteId);
  const wantSubfolder = normalizeSitepackId(subfolderId);
  const viewingAll =
    allFormsOnly || subfolderId === ALL_SITEPACK_FORMS_ID;
  const viewingUnfiled =
    unfiledOnly || subfolderId === UNFILED_SUBFOLDER_ID;
  const knownSubfolderIdList = Array.isArray(knownSubfolderIds)
    ? knownSubfolderIds
        .map((id) => normalizeSitepackId(id))
        .filter(Boolean)
    : [];

  if (wantSite && normalizeSitepackId(rSiteId) !== wantSite) return false;
  if (viewingAll) return true;
  if (viewingUnfiled) {
    if (!rSubfolderId) return true;
    if (knownSubfolderIdList.length > 0) {
      return isOrphanedSitepackSubfolder(rSubfolderId, knownSubfolderIdList);
    }
    return false;
  }
  if (wantSubfolder) return rSubfolderId === wantSubfolder;
  if (wantSite) return true;
  return !rSubfolderId;
}

export function sitepackNavState({ siteId, subfolderId, moduleTitle, subfolderName }) {
  const state = {};
  if (siteId) state.siteId = siteId;
  if (subfolderId) state.subfolderId = subfolderId;
  if (subfolderName) state.subfolderName = subfolderName;
  if (moduleTitle) state.moduleTitle = moduleTitle;
  return state;
}

export function sitepackSearchParams({
  siteId,
  subfolderId,
  category,
  extra = {},
}) {
  const params = { ...extra };
  const sid = normalizeSitepackId(siteId);
  const sfid =
    subfolderId === UNFILED_SUBFOLDER_ID ||
    subfolderId === ALL_SITEPACK_FORMS_ID
      ? null
      : normalizeSitepackId(subfolderId);
  if (sid) params.siteId = sid;
  if (sfid) params.subfolderId = sfid;
  if (category) params.category = category;
  return params;
}
