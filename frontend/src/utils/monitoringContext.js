import { getMonitoringSection } from "../constants/monitoringSections";
import { GENERAL_FORM_TEMPLATE_BY_TITLE } from "../constants/generalFormTemplates";
import {
  MONITORING_FORM_TEMPLATES,
  MONITORING_FORM_TEMPLATE_BY_TITLE,
  MONITORING_REPORT_FORMS,
} from "../constants/monitoringFormCatalog";
import {
  SHEQ_INSPECTION_CATEGORY,
  SHEQ_INSTALLATION_CATEGORY,
  buildSheqFormUrl,
} from "../constants/templateCatalog";
import { isGeneralFormsPageSubmission } from "./generalFormSubmissions";
import { matchesSitepackScope } from "./sitepackContext";

export function monitoringSitePath(sectionKey, siteId) {
  const section = getMonitoringSection(sectionKey);
  if (!section) return "/dashboard";
  if (!siteId) return section.basePath;
  return `${section.basePath}/site/${siteId}`;
}

export function monitoringFolderPath(sectionKey, siteId, folderId) {
  const section = getMonitoringSection(sectionKey);
  if (!section || !siteId || !folderId) return monitoringSitePath(sectionKey, siteId);
  return `${section.basePath}/site/${siteId}/folder/${folderId}`;
}

export function monitoringFormSearchParams(sectionKey, siteId, extra = {}) {
  const section = getMonitoringSection(sectionKey);
  if (!section) return { ...extra };
  const folderId = extra.subfolderId || extra.folderId;
  const listPath =
    siteId && folderId
      ? monitoringFolderPath(sectionKey, siteId, folderId)
      : siteId
        ? monitoringSitePath(sectionKey, siteId)
        : section.basePath;
  return {
    siteId,
    category: section.category,
    monitoringSection: sectionKey,
    listPath,
    ...extra,
  };
}

export function pathWithSearchParams(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  });
  const query = qs.toString();
  if (!query) return path;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

export function resolveSheqCategoryFromSubmission(sub) {
  const explicit = (sub?.answers?.sheqFormCategory || "").trim();
  if (
    explicit === SHEQ_INSPECTION_CATEGORY ||
    explicit === SHEQ_INSTALLATION_CATEGORY
  ) {
    return explicit;
  }

  const savedCategory = (sub?.category || "").trim();
  if (
    savedCategory === SHEQ_INSPECTION_CATEGORY ||
    savedCategory === SHEQ_INSTALLATION_CATEGORY
  ) {
    return savedCategory;
  }

  if (!sub?.answers?.formData) return null;

  const formTitle = (sub?.form?.title || "").trim();
  if (formTitle === SHEQ_INSPECTION_CATEGORY) return SHEQ_INSPECTION_CATEGORY;
  if (formTitle === SHEQ_INSTALLATION_CATEGORY) return SHEQ_INSTALLATION_CATEGORY;

  return null;
}

export function isSheqFormSubmission(sub) {
  return Boolean(resolveSheqCategoryFromSubmission(sub));
}

/** Flat Performance Monitoring list (no site/folder) — match section stamp or category. */
export function belongsInMonitoringSectionList(sub, sectionKey) {
  if (!sub || !sectionKey) return false;
  const section = getMonitoringSection(sectionKey);
  if (!section) return false;

  const monitoringFlag = sub?.answers?.monitoringSection;
  if (monitoringFlag) return monitoringFlag === sectionKey;

  return (sub.category || "").trim() === section.category;
}

export function belongsInMonitoringSubmission(sub, sectionKey, { siteId, folderId } = {}) {
  if (!sub || !sectionKey) return false;

  // Flat section lists (no site/folder context).
  if (!siteId && !folderId) {
    return belongsInMonitoringSectionList(sub, sectionKey);
  }

  if (!matchesSitepackScope(sub, { siteId, subfolderId: folderId })) return false;

  const section = getMonitoringSection(sectionKey);
  if (!section) return false;

  const monitoringFlag = sub?.answers?.monitoringSection;
  if (monitoringFlag) return monitoringFlag === sectionKey;

  if ((sub.category || "").trim() === section.category) return true;

  // Monitoring folders are section-scoped — include legacy rows saved without
  // monitoringSection / with Friday Pack category while sitting in this folder.
  if (folderId) return true;

  return false;
}

export function isMonitoringSectionSubmission(sub, sectionKey) {
  return belongsInMonitoringSubmission(sub, sectionKey, {
    siteId: sub?.answers?.siteId ?? sub?.siteId,
  });
}

export function getTemplatePathForSubmission(sub) {
  const title = sub?.form?.title || sub?.title;
  const template = title ? GENERAL_FORM_TEMPLATE_BY_TITLE[title] : null;
  return template?.path || null;
}

export function getFormPathForSubmission(sub) {
  const generalPath = getTemplatePathForSubmission(sub);
  if (generalPath) return generalPath;

  const sheqCategory = resolveSheqCategoryFromSubmission(sub);
  if (sheqCategory) {
    return "/sheq-install-form";
  }

  const reportTitle = sub?.answers?.reportModuleTitle || sub?.category;
  const report = MONITORING_REPORT_FORMS.find((row) => row.title === reportTitle);
  if (report) return report.path;

  return null;
}

export function buildMonitoringFormUrl(template, { sectionKey, siteId, folderId, preview = false }) {
  const monitoringExtra = {
    ...(siteId ? { siteId } : {}),
    ...(folderId ? { subfolderId: folderId } : {}),
    monitoringSection: sectionKey,
  };

  if (template.type === "sheq") {
    return buildSheqFormUrl(template, {
      ...monitoringExtra,
      ...(preview ? { preview: "true" } : {}),
    });
  }

  const extra = {};
  if (folderId) extra.subfolderId = folderId;
  if (template.type === "general") {
    if (preview) extra.preview = "true";
  } else if (template.type === "report") {
    extra.create = "true";
    if (preview) extra.preview = "true";
  }

  return pathWithSearchParams(
    template.path,
    monitoringFormSearchParams(sectionKey, siteId, extra)
  );
}

export function formatMonitoringDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function filterMonitoringTemplates(search = "") {
  const q = search.trim().toLowerCase();
  if (!q) return MONITORING_FORM_TEMPLATES;
  return MONITORING_FORM_TEMPLATES.filter(
    (template) =>
      template.title.toLowerCase().includes(q) ||
      (template.description || "").toLowerCase().includes(q) ||
      (template.group || "").toLowerCase().includes(q)
  );
}

export function resolveMonitoringCatalogTemplate(submission) {
  const moduleTitle =
    submission?.answers?.templateModuleTitle || submission?.form?.title || "";
  return (
    MONITORING_FORM_TEMPLATE_BY_TITLE[moduleTitle] ||
    (moduleTitle === SHEQ_INSPECTION_CATEGORY
      ? MONITORING_FORM_TEMPLATE_BY_TITLE["SHEQ Service"]
      : null)
  );
}

export function getMonitoringSubmissionTitle(sub) {
  const name = (sub?.answers?.name || sub?.name || "").trim();
  if (name) return name;

  const sheqCategory = resolveSheqCategoryFromSubmission(sub);
  if (sheqCategory === SHEQ_INSPECTION_CATEGORY) return "SHEQ Service";
  if (sheqCategory === SHEQ_INSTALLATION_CATEGORY) return "SHEQ Installation";

  return (
    sub?.answers?.report_heading ||
    sub?.answers?.reportModuleTitle ||
    sub?.form?.title ||
    sub?.title ||
    "Untitled form"
  );
}

export function buildMonitoringBuilderFormUrl(
  formId,
  { sectionKey, siteId, folderId, preview = false } = {}
) {
  const extra = {};
  if (folderId) extra.subfolderId = folderId;
  if (preview) extra.preview = "true";
  return pathWithSearchParams(
    `/forms/${formId}/use`,
    monitoringFormSearchParams(sectionKey, siteId, extra)
  );
}

export function buildMonitoringSavedTemplateUrl(
  submission,
  { sectionKey, siteId, folderId, preview = false } = {}
) {
  const responseId = submission?.id || submission?._id;
  if (!responseId) return null;

  const template = resolveMonitoringCatalogTemplate(submission);

  if (template) {
    if (template.type === "sheq") {
      return buildSheqFormUrl(template, {
        ...(siteId ? { siteId } : {}),
        ...(folderId ? { subfolderId: folderId } : {}),
        monitoringSection: sectionKey,
        fromTemplate: responseId,
        ...(preview ? { preview: "true" } : {}),
      });
    }
    if (template.type === "general") {
      const extra = { fromTemplate: responseId };
      if (folderId) extra.subfolderId = folderId;
      if (preview) extra.preview = "true";
      return pathWithSearchParams(
        template.path,
        monitoringFormSearchParams(sectionKey, siteId, extra)
      );
    }
    return buildMonitoringFormUrl(template, { sectionKey, siteId, folderId, preview });
  }

  const generalPath = getTemplatePathForSubmission(submission);
  if (generalPath) {
    const extra = { fromTemplate: responseId };
    if (folderId) extra.subfolderId = folderId;
    if (preview) extra.preview = "true";
    return pathWithSearchParams(
      generalPath,
      monitoringFormSearchParams(sectionKey, siteId, extra)
    );
  }

  if (submission?.formId) {
    return buildMonitoringBuilderFormUrl(submission.formId, {
      sectionKey,
      siteId,
      folderId,
      preview,
    });
  }

  return null;
}

export function filterMonitoringSavedTemplates(submissions = [], search = "") {
  const pickable = submissions.filter(isGeneralFormsPageSubmission);
  const q = search.trim().toLowerCase();
  if (!q) return pickable;
  return pickable.filter((sub) => {
    const primary = (sub.name || sub.answers?.name || sub.form?.title || "").toLowerCase();
    const secondary = (
      sub.answers?.templateModuleTitle ||
      sub.form?.title ||
      ""
    ).toLowerCase();
    return primary.includes(q) || secondary.includes(q);
  });
}

export function filterMonitoringBuilderForms(forms = [], search = "") {
  const q = search.trim().toLowerCase();
  if (!q) return forms;
  return forms.filter((form) => (form.title || "").toLowerCase().includes(q));
}

/** Custom form-builder submission (not a hardcoded general-form template). */
export function isMonitoringCustomBuilderSubmission(submission) {
  const title = submission?.form?.title;
  if (!title || GENERAL_FORM_TEMPLATE_BY_TITLE[title]) return false;
  return Boolean(submission?.formId);
}

function applyMonitoringSubmissionMode(params, mode) {
  const out = { ...params };
  if (mode === "view") {
    out.preview = "true";
  } else if (mode === "edit") {
    out.embedded = "true";
  } else if (mode === "download_pdf") {
    out.action = "download";
  } else if (mode === "download_word") {
    out.action = "download_word";
  }
  return out;
}

/** URL to view, edit, or download a saved monitoring submission in context. */
export function buildMonitoringSubmissionUrl(
  submission,
  { sectionKey, siteId, folderId, mode = "edit" } = {}
) {
  const responseId = submission?.id || submission?._id;
  if (!responseId || !sectionKey) return null;

  const baseParams = monitoringFormSearchParams(sectionKey, siteId, {
    ...(folderId ? { subfolderId: folderId } : {}),
  });

  const generalPath = getTemplatePathForSubmission(submission);
  if (generalPath) {
    return pathWithSearchParams(
      `${generalPath}/${responseId}`,
      applyMonitoringSubmissionMode(baseParams, mode)
    );
  }

  const reportPath = getFormPathForSubmission(submission);
  if (reportPath === "/sheq-install-form") {
    const sheqCategory =
      resolveSheqCategoryFromSubmission(submission) || submission?.category;
    const params = applyMonitoringSubmissionMode(
      { ...baseParams, category: sheqCategory },
      mode
    );
    if (mode === "view") params.view = "true";
    return pathWithSearchParams(`${reportPath}/${responseId}`, params);
  }
  if (reportPath) {
    return pathWithSearchParams(
      reportPath,
      applyMonitoringSubmissionMode(
        { ...baseParams, responseId: String(responseId) },
        mode
      )
    );
  }

  const formId = submission?.formId;
  if (formId) {
    return pathWithSearchParams(
      `/forms/${formId}/use`,
      applyMonitoringSubmissionMode(
        { ...baseParams, responseId: String(responseId) },
        mode
      )
    );
  }

  return null;
}
