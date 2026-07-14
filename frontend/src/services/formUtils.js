import api, { formResponseSaveConfig } from './api';
import {
  FRIDAY_PACK_FORMS_CATEGORY,
  GENERAL_FORMS_CATEGORY,
} from '../utils/generalFormSubmissions';
import {
  getOfflineTemplateFormId,
  putOfflineTemplateForm,
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
    const siteId = payload?.siteId;
    const subfolderId = payload?.subfolderId;
    const hasSiteContext = siteId != null && String(siteId).trim() !== '';
    const resolvedCategory = resolveSaveCategory(category, hasSiteContext);
    const body = { answers: payload, category: resolvedCategory };
    if (hasSiteContext) {
        body.siteId = String(siteId).trim();
    }
    if (subfolderId != null && String(subfolderId).trim() !== '') {
        body.subfolderId = String(subfolderId).trim();
    }
    return body;
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
    const formId = await getOrCreateTemplateForm(formTitle);
    const res = await api.post(
        `/forms/${formId}/responses`,
        body,
        requestConfig
    );
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

export const getOrCreateTemplateForm = async (formTitle) => {
    if (templateFormCache[formTitle]) {
        return templateFormCache[formTitle];
    }

    const offlineCached = await getOfflineTemplateFormId(formTitle);
    if (offlineCached) {
        templateFormCache[formTitle] = offlineCached;
        return offlineCached;
    }

    try {
        const requestConfig = formResponseSaveConfig();
        const res = await api.get('/forms', {
            ...requestConfig,
            params: { title: formTitle },
        });
        if (res.data?.success && res.data.data) {
            const existing = res.data.data.find(f => f.title === formTitle);
            if (existing) {
                const id = existing.id || existing._id;
                templateFormCache[formTitle] = id;
                await putOfflineTemplateForm(formTitle, id, { pending: false });
                return id;
            }
        }

        const createPayload = {
            title: formTitle,
            fields: [
                {
                    id: "custom_hardcoded_form_data",
                    type: "text",
                    label: "Form Data Indicator",
                    required: false
                }
            ],
            titleColor: "#000000",
            titleAlignment: "left"
        };

        if (isBrowserOffline()) {
            const queued = await queueOfflineTemplateFormCreate({
                url: '/forms',
                data: createPayload,
                headers: {},
                timeout: requestConfig.timeout,
            });
            const id = queued.form?.id || queued.form?._id || createLocalFormId();
            templateFormCache[formTitle] = id;
            await putOfflineTemplateForm(formTitle, id, { pending: true });
            return id;
        }

        const createRes = await api.post('/forms', createPayload, requestConfig);

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
        throw e;
    }
};
