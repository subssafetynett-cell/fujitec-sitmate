import React, { useEffect, useState } from "react";
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
import { useRef } from "react";
import FormRenderer from "../components/FormRenderer";
import { getBackendOrigin } from "../utils/backendOrigin.js";

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
  const category = searchParams.get("category");
  const action = searchParams.get("action");
  const responseId = searchParams.get("responseId") || searchParams.get("submissionId");
  const containerRef = useRef(null);
  
  const [downloading, setDownloading] = useState(false);
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
    if (siteId) {
      navigate("/sitepack-management", { state: { siteId, moduleTitle: category } });
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

      const payload = {
        formId: id,
        answers: processedAnswers,
      };
      if (category) payload.category = category;

      if (responseId) {
        await api.put(`/forms/responses/${responseId}`, { answers: processedAnswers });
      } else {
        await api.post(`/forms/${id}/responses`, payload);
      }
      resetDirty();
      return true;
    } catch (err) {
      console.error("Submit failed", err);
      const msg = err.response?.data?.message || "Failed to submit form";
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
        setDownloading(true);
        setTimeout(() => {
            downloadPdfFromRef(containerRef, `CustomForm_${form.title.replace(/\s+/g, '_')}`, () => {
                setDownloading(false);
                window.close();
            });
        }, 800);
    } else if (!loading && action === "download_word" && form) {
        setDownloading(true);
        downloadWordFromForm(form, values, `CustomForm_${form.title.replace(/\s+/g, '_')}`, () => {
            setDownloading(false);
            window.close();
        });
    }
  }, [loading, action, form, values]);

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
      resetDirty();
      setSuccessOpen(true);
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!form) {
    return <Typography sx={{ p: 4 }}>Form not found</Typography>;
  }

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


        <Paper ref={containerRef} sx={{ p: 3, maxWidth: 900, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 'auto', boxSizing: 'border-box' }}>
          {action === "download" && (
            <Typography sx={{ position: 'absolute', top: 24, right: 24, fontWeight: 500, color: 'text.secondary', fontSize: '0.9rem' }}>
                Date: {new Date().toLocaleDateString('en-GB')}
            </Typography>
          )}

            <Box sx={{ flex: 1 }}>
              <FormRenderer 
                form={form}
                values={values}
                onChange={handleChange}
                onSubmit={handleSubmit}
                isSubmitting={saving}
                logoUrl={logoUrl}
                submitLabel="Save"
                readOnly={readOnly}
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
