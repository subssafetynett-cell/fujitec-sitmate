import React, { useEffect, useState, useRef } from "react";
import { flushSync } from "react-dom";
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import Layout from "../components/Layout";
import { useAutoFormDirty } from "../hooks/useAutoFormDirty";
import { useUnsavedFormGuard } from "../hooks/useUnsavedFormGuard.jsx";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { downloadWordFromForm } from "../utils/wordGenerator";
import { prepareCustomFormPdfAssets } from "../utils/prepareFormPdfAssets";
import FormRenderer from "../components/FormRenderer";
import { getBackendOrigin } from "../utils/backendOrigin.js";
import { resolveFormCategoryFromSearchParams, sitepackNavState } from "../utils/sitepackContext";
import { FRIDAY_PACK_FORMS_CATEGORY, GENERAL_FORMS_CATEGORY } from "../utils/generalFormSubmissions";
import { monitoringFolderPath, monitoringSitePath } from "../utils/monitoringContext";

// helper to build absolute URL for logos
const computeLogoUrl = (logo) => {
    if (!logo) return null;
    if (/^https?:\/\//i.test(logo)) return logo;
    const host = getBackendOrigin();
    return `${host.replace(/\/$/, "")}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

export default function UseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");
  const subfolderId = searchParams.get("subfolderId");
  const monitoringSection = searchParams.get("monitoringSection");
  const category = resolveFormCategoryFromSearchParams(searchParams);
  const action = searchParams.get("action");
  const responseId = searchParams.get("responseId") || searchParams.get("submissionId");
  const containerRef = useRef(null);
  
  const [downloading, setDownloading] = useState(false);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfExportValues, setPdfExportValues] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const readOnly = action === "download" || action === "download_word";
  const { isDirty, resetDirty } = useAutoFormDirty([values], {
    enabled: !readOnly,
    loading,
  });

  const navigateBack = () => {
    if (monitoringSection && siteId) {
      if (subfolderId) {
        navigate(monitoringFolderPath(monitoringSection, siteId, subfolderId));
      } else {
        navigate(monitoringSitePath(monitoringSection, siteId));
      }
      return;
    }
    if (siteId) {
      navigate("/sitepack-management", {
        state: sitepackNavState({
          siteId,
          subfolderId,
          subfolderName: searchParams.get("subfolderName") || undefined,
          moduleTitle: category || FRIDAY_PACK_FORMS_CATEGORY,
        }),
      });
    } else if (category && category !== GENERAL_FORMS_CATEGORY && category !== FRIDAY_PACK_FORMS_CATEGORY) {
      // Return to Reporting Concerns list when form was opened from those pages
      const concernPathByCategory = {
        "Health & Safety concern": "/report-health-safety",
        "Quality concern": "/report-quality",
        "Positive observation": "/report-positive",
      };
      navigate(concernPathByCategory[category] || "/forms");
    } else {
      navigate("/forms");
    }
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const processedAnswers = {};
      for (const [key, value] of Object.entries(values)) {
        if (value instanceof File) {
          processedAnswers[key] = await toBase64(value);
        } else if (!key.endsWith("_preview")) {
          processedAnswers[key] = value;
        }
      }

      if (siteId) processedAnswers.siteId = siteId;
      if (subfolderId) processedAnswers.subfolderId = subfolderId;
      if (monitoringSection) processedAnswers.monitoringSection = monitoringSection;

      const explicitCategory = category != null ? String(category).trim() : "";
      const resolvedCategory =
        explicitCategory && explicitCategory !== GENERAL_FORMS_CATEGORY
          ? explicitCategory
          : siteId
            ? FRIDAY_PACK_FORMS_CATEGORY
            : explicitCategory || GENERAL_FORMS_CATEGORY;
      const body = { answers: processedAnswers, category: resolvedCategory };
      if (siteId) body.siteId = String(siteId).trim();
      if (subfolderId) body.subfolderId = String(subfolderId).trim();

      if (responseId) {
        await api.put(`/forms/responses/${responseId}`, body);
      } else {
        await api.post(`/forms/${id}/responses`, body);
      }
      resetDirty();
      return true;
    } catch (err) {
      console.error("Submit failed", err);
      const msg = err.response?.data?.message || err.message || "Failed to submit form";
      alert(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const { requestLeave, consumePendingNavigation, UnsavedDialog } = useUnsavedFormGuard({
    enabled: !readOnly,
    isDirty,
    onLeave: navigateBack,
    saving,
    onPromptSave: performSave,
  });

  useEffect(() => {
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            let rawLogo = null;
            if (user.clientId && typeof user.clientId === 'object' && user.clientId.logo) {
                rawLogo = user.clientId.logo;
            } else if (user.companyLogo) {
                rawLogo = user.companyLogo;
            } else if (user.logo) {
                rawLogo = user.logo;
            }
            if (rawLogo) {
                setLogoUrl(computeLogoUrl(rawLogo));
            }
        }
    } catch (e) {
        console.error("Error parsing user from localstorage", e);
    }

    const fetchForm = async () => {
      try {
        const res = await api.get(`/forms/${id}`);
        if (res?.data?.success) {
          setForm(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load form", err);
      } finally {
        if (!responseId) setLoading(false);
      }
    };

    const fetchResponse = async () => {
      if (!responseId) return;
      try {
        const res = await api.get(`/forms/responses/${responseId}`);
        if (res.data?.success && res.data.data?.answers) {
          setValues(res.data.data.answers);
          resetDirty();
        }
      } catch (err) {
        console.error("Failed to load response", err);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
    if (responseId) {
      fetchResponse();
    }
  }, [id, responseId]);

  useEffect(() => {
    if (!loading && action === "download" && form) {
      let cancelled = false;
      (async () => {
        setPreparingPdf(true);
        try {
          const exportValues = await prepareCustomFormPdfAssets(form, values, logoUrl);
          if (cancelled) return;
          flushSync(() => {
            setPdfExportValues(exportValues);
            setDownloading(true);
          });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          await new Promise((resolve) => {
            downloadPdfFromRef(containerRef, `CustomForm_${form.title.replace(/\s+/g, "_")}`, (err) => {
              setDownloading(false);
              setPreparingPdf(false);
              setPdfExportValues(null);
              if (!err) window.close();
              resolve();
            });
          });
        } catch (err) {
          console.error("PDF preparation failed:", err);
          if (!cancelled) {
            setPreparingPdf(false);
            setDownloading(false);
            setPdfExportValues(null);
            alert("Could not prepare PDF. Please try again.");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    } else if (!loading && action === "download_word" && form) {
      let cancelled = false;
      (async () => {
        setPreparingPdf(true);
        try {
          const exportValues = await prepareCustomFormPdfAssets(form, values, logoUrl);
          if (cancelled) return;
          await downloadWordFromForm(
            form,
            exportValues,
            `CustomForm_${form.title.replace(/\s+/g, "_")}`,
            () => {
              setPreparingPdf(false);
              window.close();
            }
          );
        } catch (err) {
          console.error("Word preparation failed:", err);
          if (!cancelled) {
            setPreparingPdf(false);
            alert("Could not prepare Word document. Please try again.");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [loading, action, form, values, logoUrl]);

  const handleChange = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };



  const handleCheckboxToggle = (fieldId, option) => {
    setValues((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      return {
        ...prev,
        [fieldId]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async () => {
    const ok = await performSave();
    if (ok) {
      if (siteId) {
        navigateBack();
      } else {
        resetDirty();
        setSuccessOpen(true);
      }
    }
  };


  if (loading || preparingPdf) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress />
        {preparingPdf && (
          <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
            Preparing download…
          </Typography>
        )}
      </Box>
    );
  }

  if (!form) {
    return <Typography sx={{ p: 4 }}>Form not found</Typography>;
  }

  const displayValues = pdfExportValues ?? values;
  const displayLogoUrl = pdfExportValues?.__companyLogoUrl ?? logoUrl;
  const exportMode = downloading || readOnly;

  return (
    <Layout>
      <Box sx={{ flex: 1, px: { xs: 2, md: 5 }, py: 4, overflowY: "auto" }}>
        {!readOnly && (
          <Box sx={{ maxWidth: 900, mx: "auto", mb: 2 }}>
            <Button variant="outlined" onClick={requestLeave} sx={{ textTransform: "none" }}>
              Back
            </Button>
          </Box>
        )}


        <Paper
          ref={containerRef}
          className={downloading ? "pdf-export-root" : undefined}
          sx={{ p: 3, maxWidth: 900, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 'auto', boxSizing: 'border-box' }}
        >
          {action === "download" && (
            <Typography sx={{ position: 'absolute', top: 24, right: 24, fontWeight: 500, color: 'text.secondary', fontSize: '0.9rem' }}>
                Date: {new Date().toLocaleDateString('en-GB')}
            </Typography>
          )}

            <Box sx={{ flex: 1 }}>
              <FormRenderer 
                form={form}
                values={displayValues}
                onChange={handleChange}
                onSubmit={handleSubmit}
                isSubmitting={saving}
                logoUrl={displayLogoUrl}
                submitLabel="Save"
                readOnly={readOnly}
                exportMode={exportMode}
              />
            </Box>
        </Paper>
      </Box>

      {UnsavedDialog}

      <Dialog open={successOpen} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Form Submitted 🎉
        </DialogTitle>

        <DialogContent>
          <Typography>
            Your response has been saved successfully.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            sx={{ textTransform: "none" }}
            onClick={() => {
              setSuccessOpen(false);
              resetDirty();
              if (!consumePendingNavigation()) {
                navigateBack();
              }
            }}
          >
            {siteId ? "Back to Site Pack" : "Go to Forms"}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
