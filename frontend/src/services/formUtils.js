import api, { formResponseSaveConfig } from './api';
import {
  FRIDAY_PACK_FORMS_CATEGORY,
  GENERAL_FORMS_CATEGORY,
} from '../utils/generalFormSubmissions';
import {
  getOfflineTemplateFormId,
  putOfflineTemplateForm,
  clearOfflineTemplateForm,
  isBrowserOffline,
  createLocalFormId,
} from '../utils/offlineStore.js';
import { queueOfflineTemplateFormCreate } from '../utils/offlineFormWrite.js';

function resolveSaveCategory(category, hasSiteContext) {
    const explicit = category != null ? String(category).trim() : '';
    // Keep explicit categories from monitoring / reporting concern pages.
    // Only default to Friday Pack when saving under a site with no real category.
    if (explicit && explicit !== GENERAL_FORMS_CATEGORY) {
        return explicit;
    }
    if (hasSiteContext) {
        return FRIDAY_PACK_FORMS_CATEGORY;
    }
    return explicit || GENERAL_FORMS_CATEGORY;
}

function buildFormResponseBody(payload, category) {
    // Templates-page library edits must never inherit site/folder scope.
    const isTemplatesPageSave = payload?.savedFromTemplatesPage === true;
    const answers = isTemplatesPageSave
        ? (() => {
            const next = { ...payload };
            delete next.siteId;
            delete next.subfolderId;
            delete next.monitoringSection;
            next.savedFromTemplatesPage = true;
            return next;
        })()
        : payload;

    const siteId = isTemplatesPageSave ? null : answers?.siteId;
    const subfolderId = isTemplatesPageSave ? null : answers?.subfolderId;
    const hasSiteContext = siteId != null && String(siteId).trim() !== '';
    const resolvedCategory = isTemplatesPageSave
        ? GENERAL_FORMS_CATEGORY
        : resolveSaveCategory(category, hasSiteContext);
    const body = { answers, category: resolvedCategory };
    if (hasSiteContext) {
        body.siteId = String(siteId).trim();
    }
    if (subfolderId != null && String(subfolderId).trim() !== '') {
        body.subfolderId = String(subfolderId).trim();
    }
    return body;
}

async function postNewGeneralFormResponse(formTitle, body, requestConfig) {
    const formId = await getOrCreateTemplateForm(formTitle);
    try {
        return await api.post(`/forms/${formId}/responses`, body, requestConfig);
    } catch (err) {
        // Stale IndexedDB / memory cache can point at a form id from another DB
        // (e.g. after docker volume reset). Invalidate and recreate once.
        if (err?.response?.status === 404) {
            await invalidateTemplateFormCache(formTitle);
            const freshFormId = await getOrCreateTemplateForm(formTitle);
            return api.post(`/forms/${freshFormId}/responses`, body, requestConfig);
        }
        throw err;
    }
}

/**
 * Create or update a general-form template response. Returns the saved response id.
 */
export async function saveGeneralFormResponse({
    formTitle,
    persistedResponseId,
    asNew = false,
    payload,
    category,
}) {
    const requestConfig = formResponseSaveConfig();
    const body = buildFormResponseBody(payload, category);

    if (persistedResponseId && !asNew) {
        const res = await api.put(
            `/forms/responses/${persistedResponseId}`,
            body,
            requestConfig
        );
        if (res.data?.offlineQueued) {
            const localId = res.data?.data?.id || res.data?.data?._id;
            return localId || persistedResponseId;
        }
        return persistedResponseId;
    }
    const res = await postNewGeneralFormResponse(formTitle, body, requestConfig);
    if (res.data?.offlineQueued) {
        const localId = res.data?.data?.id || res.data?.data?._id;
        return localId || null;
    }
    const saved = res.data?.data;
    return saved?.id || saved?._id || null;
}

/**
 * Ensures a generic parent "Form" definition exists in the database for our specific hardcoded forms.
 * Since the backend requires a Form to exist before a FormResponse can be saved, this dynamically fetches
 * or creates an empty/dummy form named the exact `formTitle` so it can be associated.
 * 
 * @param {string} formTitle the exact string title of the form (e.g., "Tool Box Talk Register")
 * @returns {Promise<string>} an ID representing the Form
 */
const templateFormCache = {};

async function invalidateTemplateFormCache(formTitle) {
    delete templateFormCache[formTitle];
    await clearOfflineTemplateForm(formTitle);
}

function isTransientApiFailure(error) {
    if (isBrowserOffline()) return true;
    const status = error?.response?.status;
    if (status === 502 || status === 503 || status === 504) return true;
    if (error?.response) return false;
    const code = error?.code || "";
    const msg = String(error?.message || "");
    return (
        code === "ERR_NETWORK" ||
        code === "ECONNABORTED" ||
        /network error|failed to fetch|load failed|offline/i.test(msg)
    );
}

async function queueLocalTemplateForm(formTitle, createPayload, requestConfig) {
    const queued = await queueOfflineTemplateFormCreate({
        url: "/forms",
        data: createPayload,
        headers: {},
        timeout: requestConfig.timeout,
    });
    const id = queued.form?.id || queued.form?._id || createLocalFormId();
    templateFormCache[formTitle] = id;
    await putOfflineTemplateForm(formTitle, id, { pending: true });
    return id;
}

export const getOrCreateTemplateForm = async (formTitle) => {
    if (templateFormCache[formTitle]) {
        return templateFormCache[formTitle];
    }

    // Only trust IndexedDB while offline. Online, a cached id may be from a
    // previous DB (docker reset) and would 404 on save.
    if (isBrowserOffline()) {
        try {
            const offlineCached = await getOfflineTemplateFormId(formTitle);
            if (offlineCached) {
                templateFormCache[formTitle] = offlineCached;
                return offlineCached;
            }
        } catch (err) {
            console.warn("Offline template cache unavailable", err?.message || err);
        }
    }

    const requestConfig = formResponseSaveConfig();
    const createPayload = {
        title: formTitle,
        fields: [
            {
                id: "custom_hardcoded_form_data",
                type: "text",
                label: "Form Data Indicator",
                required: false,
            },
        ],
        titleColor: "#000000",
        titleAlignment: "left",
    };

    try {
        const res = await api.get("/forms", {
            ...requestConfig,
            params: { title: formTitle },
        });
        if (res.data?.success && res.data.data) {
            const existing = res.data.data.find((f) => f.title === formTitle);
            if (existing) {
                const id = existing.id || existing._id;
                templateFormCache[formTitle] = id;
                await putOfflineTemplateForm(formTitle, id, { pending: false });
                return id;
            }
        }

        if (isBrowserOffline()) {
            return queueLocalTemplateForm(formTitle, createPayload, requestConfig);
        }

        const createRes = await api.post("/forms", createPayload, requestConfig);

        if (createRes.data?.offlineQueued && createRes.data?.form) {
            const id = createRes.data.form.id || createRes.data.form._id;
            templateFormCache[formTitle] = id;
            await putOfflineTemplateForm(formTitle, id, { pending: true });
            return id;
        }

        if (createRes.data?.success && createRes.data.form) {
            const created = createRes.data.form;
            const id = created.id || created._id;
            templateFormCache[formTitle] = id;
            await putOfflineTemplateForm(formTitle, id, { pending: false });
            return id;
        }

        throw new Error("Could not create template form");
    } catch (e) {
        console.error("Failed to get/create template form:", e);
        if (isTransientApiFailure(e)) {
            try {
                return await queueLocalTemplateForm(formTitle, createPayload, requestConfig);
            } catch (queueErr) {
                console.error("Offline template queue also failed:", queueErr);
            }
        }
        throw e;
    }
};
