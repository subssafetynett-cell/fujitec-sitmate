import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canEditGeneralFormTemplate } from "../utils/generalFormTemplateAccess";
import {
  isContextualFormFill,
  isTemplatesPageEditContext,
} from "../utils/templatePageContext";

function normalizeSiteId(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t !== "" ? t : null;
}

/**
 * General forms under /general-forms: without ?siteId=… only superadmin, company_admin, site_manager may edit.
 * With siteId (site pack), existing site workflows keep full edit for whoever can open the link.
 * Fills from Performance Monitoring / Reporting Concerns also allow full fill (not Templates-library lock).
 *
 * Pass `action` and `downloading` from the page to get `pdfLayout` / `contentReadOnly` helpers.
 * Optional `persistedSiteId` (e.g. answers.siteId after loading a submission) is merged with the URL param.
 */
export function useGeneralFormTemplateAccess(
  action,
  downloading = false,
  persistedSiteId = null,
  persistedSubfolderId = null
) {
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  // Templates-page edits ignore any leftover site/folder ids on the loaded row.
  const isTemplatesEdit = isTemplatesPageEditContext(searchParams);
  const siteId = isTemplatesEdit
    ? null
    : normalizeSiteId(searchParams.get("siteId")) ||
      normalizeSiteId(persistedSiteId);
  const subfolderId = isTemplatesEdit
    ? null
    : normalizeSiteId(searchParams.get("subfolderId")) ||
      normalizeSiteId(persistedSubfolderId);
  const isSitePackContext = Boolean(siteId && String(siteId).trim() !== "");
  const isContextualFill = isContextualFormFill(searchParams);
  const canEdit =
    isTemplatesEdit ||
    isContextualFill ||
    canEditGeneralFormTemplate(role, { siteId });
  const isDownloadAction = ["download", "download_word"].includes(
    String(action || "").toLowerCase()
  );
  const pdfLayout = Boolean(downloading || isDownloadAction);
  const contentReadOnly = pdfLayout || !canEdit;
  return {
    canEdit,
    siteId,
    subfolderId,
    isSitePackContext,
    pdfLayout,
    contentReadOnly,
  };
}
