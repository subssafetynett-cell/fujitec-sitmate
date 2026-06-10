import api, { FORM_RESPONSE_SAVE_TIMEOUT_MS } from './api';

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
    try {
        const requestConfig = { timeout: FORM_RESPONSE_SAVE_TIMEOUT_MS };
        // First try a narrow title lookup; this avoids downloading every saved form before saving.
        const res = await api.get('/forms', {
            ...requestConfig,
            params: { title: formTitle },
        });
        if (res.data?.success && res.data.data) {
            // Find existing
            const existing = res.data.data.find(f => f.title === formTitle);
            if (existing) {
                const id = existing.id || existing._id;
                templateFormCache[formTitle] = id;
                return id;
            }
        }

        // If it doesn't exist, we must create a template representation
        const createRes = await api.post('/forms', {
            title: formTitle,
            // Submit an empty field array since the form structure is hardcoded in the frontend
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
        }, requestConfig);

        if (createRes.data?.success && createRes.data.form) {
            const created = createRes.data.form;
            const id = created.id || created._id;
            templateFormCache[formTitle] = id;
            return id;
        }

        throw new Error("Could not create template form");
    } catch (e) {
        console.error("Failed to get/create template form:", e);
        throw e;
    }
};
