import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Avatar,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  SwapHoriz as SwapHorizIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { UPLOAD_TIMEOUT_MS, fetchClientsList, LIST_FETCH_TIMEOUT_MS } from "../services/api";
import { getBackendOrigin } from "../utils/backendOrigin.js";
import { plainCompanyError } from "../utils/plainCompany";
import {
  getActingClient,
  setActingClient,
  isSafetynettClient,
  restorePlatformSuperadminSession,
} from "../utils/actingClient";
import Layout from "../components/Layout";
import { useTheme as useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

// helper to build absolute URL for logos saved as /uploads/filename
const computeLogoUrl = (logo) => {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo;
  // If we have a relative path, prepend the backend URL
  const host = getBackendOrigin();
  return `${host.replace(/\/$/, "")}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

function dedupeClientsByName(clients) {
  const byKey = new Map();
  for (const client of clients || []) {
    const key = String(client?.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, client);
      continue;
    }
    if (isSafetynettClient(client) && client.name === "Safetynett") {
      byKey.set(key, client);
    }
  }
  return Array.from(byKey.values());
}

export default function ClientsPage() {
  const theme = useTheme();
  const { isDarkMode } = useAppTheme();
  const { isSuperAdmin, refreshUser } = useAuth();
  const navigate = useNavigate();
  const actingClient = getActingClient();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const CARD_WIDTH = 320;
  const CARD_HEIGHT = 170;

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // menu / selection
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  // delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  // snackbar
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseSnack = () => {
    setSnack((prev) => ({ ...prev, open: false }));
  };

  // create / edit modal
  const [openModal, setOpenModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // true => edit, false => create
  const [form, setForm] = useState({ name: "", file: null, preview: "", existingLogo: null });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const previewRef = useRef("");

  const onSwitchCompany = (client) => {
    const id = client?._id ?? client?.id;
    if (!id) return;

    if (isSafetynettClient(client)) {
      restorePlatformSuperadminSession();
      refreshUser();
      setSnack({
        open: true,
        message: "Platform superadmin view — all organisations",
        severity: "success",
      });
      navigate("/dashboard");
      return;
    }

    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...u,
            _platformCompanyname: u._platformCompanyname ?? u.companyname,
            _platformClientId: u._platformClientId ?? u.clientId,
            clientId: id,
            companyname: client.name,
            company: client.name,
          })
        );
      }
    } catch (e) {
      console.error("Failed to persist acting company", e);
    }
    setActingClient(client);
    refreshUser();
    setSnack({
      open: true,
      message: `Switched to ${client.name}`,
      severity: "success",
    });
    navigate("/users");
  };

  // fetch clients
  const fetchClients = async ({ silent = false } = {}) => {
    if (!silent) setLoadingClients(true);
    try {
      const data = await fetchClientsList();
      if (data?.clients) setClients(dedupeClientsByName(data.clients));
      else if (Array.isArray(data)) setClients(dedupeClientsByName(data));
      else setClients([]);
    } catch (err) {
      console.error("Failed to load clients", err);
      if (!silent) setClients([]);
    } finally {
      if (!silent) setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClients();
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  // Filtered clients list
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---- modal open for create ----
  const openCreateModal = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }
    setIsEditMode(false);
    setForm({ name: "", file: null, preview: "", existingLogo: null });
    setErrors({});
    setOpenModal(true);
  };

  // ---- modal open for edit ----
  const openEditModal = (client) => {
    if (!client) return;
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }
    setIsEditMode(true);
    setForm({
      name: client.name || "",
      file: null,
      preview: "",
      existingLogo: client.logo || null, // path like /uploads/...
    });
    setErrors({});
    setOpenModal(true);
  };

  const closeModal = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }
    setOpenModal(false);
    setForm({ name: "", file: null, preview: "", existingLogo: null });
    setErrors({});
  };

  const handleChange = (key) => (e) => {
    if (key === "file") {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        if (previewRef.current) {
          URL.revokeObjectURL(previewRef.current);
          previewRef.current = "";
        }
        setForm((s) => ({ ...s, file: null, preview: "" }));
        return;
      }
      const preview = URL.createObjectURL(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = preview;
      setForm((s) => ({ ...s, file, preview }));
      setErrors((prev) => ({ ...prev, file: undefined }));
    } else {
      setForm((s) => ({ ...s, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validateForm = () => {
    const e = {};
    const nameErr = plainCompanyError(form.name, "Client name");
    if (nameErr) e.name = nameErr;
    if (form.file) {
      const allowed = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/svg+xml",
        "image/webp",
      ];
      if (!allowed.includes(form.file.type)) e.file = "Only PNG/JPG/GIF/SVG/WebP images allowed";
      if (form.file.size > 2 * 1024 * 1024) e.file = "File size must be < 2 MB";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // create handler
  // inside Clients.jsx
  // --- create handler (robust) ---
  const handleCreate = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      if (form.file) data.append("logo", form.file);

      const res = await api.post("/clients", data, {
        timeout: form.file ? UPLOAD_TIMEOUT_MS : undefined,
      });
      // accept either res.data.client or res.data as the created object
      const created = res?.data?.client ?? res?.data;

      if (created) {
        // Normalize the created client to have _id and/or id
        const normalized = {
          _id: created.id ?? created._id ?? created._id,
          id: created.id ?? (created._id ? created._id.toString() : undefined),
          name: created.name,
          logo: created.logo ?? created.logoUrl ?? created.logo_url ?? null,
          ...created,
        };

        // add new client to top of list
        setClients((prev) => [normalized, ...prev]);

        setSnack({ open: true, message: "Client created successfully!", severity: "success" });
      } else {
        // fallback: refetch
        await fetchClients();
      }

      closeModal();
      // replace catch in handleCreate
    } catch (err) {
      console.error("Create client failed", err);
      console.error("Requested URL:", err.config?.url);
      console.error("Full request config:", err.config);
      console.error("Status:", err.response?.status);
      console.error("Response data:", err.response?.data);
      const data = err?.response?.data;
      const errorMsg = data?.message || "Failed to create client";
      setErrors((p) => ({ ...p, form: errorMsg }));
      setSnack({ open: true, message: `Error: ${errorMsg}`, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };


  // update handler
  const handleUpdate = async (id) => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      if (form.file) data.append("logo", form.file);

      const res = await api.put(`/clients/${id}`, data, {
        timeout: form.file ? UPLOAD_TIMEOUT_MS : undefined,
      });
      const updated = res?.data?.client;
      if (updated) {
        setClients((prev) =>
          prev.map((c) => (c.id === id || c._id === id ? updated : c))
        );
        setSnack({ open: true, message: "Client updated successfully!", severity: "success" });
      } else {
        await fetchClients();
      }
      closeModal();
    } catch (err) {
      console.error("Update client failed", err);
      const msg = err.response?.data?.message || "Update failed";
      setSnack({ open: true, message: `Error: ${msg}`, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- DELETE handlers ----
  const handleMenuOpen = (e, client) => {
    setMenuAnchor(e.currentTarget);
    setSelectedClient(client);
  };
  const handleMenuClose = () => {
    setMenuAnchor(null);
  };
  const confirmDelete = () => {
    setMenuAnchor(null);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedClient || deleteInFlight) {
      setDeleteDialogOpen(false);
      return;
    }
    const id = selectedClient.id || selectedClient._id;
    const removedClient = selectedClient;

    setDeleteInFlight(true);
    setDeleteDialogOpen(false);
    setSelectedClient(null);
    setClients((prev) => prev.filter((c) => c.id !== id && c._id !== id));
    setSnack({ open: true, message: "Client deleted successfully!", severity: "success" });

    try {
      const res = await api.delete(`/clients/${id}`, { timeout: LIST_FETCH_TIMEOUT_MS });
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "Failed to delete client");
      }
    } catch (err) {
      console.error("Delete client failed:", err);
      setClients((prev) => {
        if (prev.some((c) => (c.id || c._id) === id)) return prev;
        return [removedClient, ...prev];
      });
      setSnack({
        open: true,
        message: err?.response?.data?.message || "Failed to delete client",
        severity: "error",
      });
    } finally {
      setDeleteInFlight(false);
    }
  };

  const firstChar = (s) => (s && s.length ? s[0].toUpperCase() : "?");

  return (
    <Layout>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "inherit" }}>All Clients</Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>Manage your client accounts</Typography>
        </Box>

        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateModal}
            sx={{
              textTransform: "none",
              borderRadius: 3,
              boxShadow: "none",
              bgcolor: "hsl(38, 70%, 55%)",
              "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" },
            }}
          >
            Create new client
          </Button>
        )}
      </Box>

      {loadingClients && clients.length === 0 ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredClients.map((client) => (
            <Grid key={client.id ?? client._id ?? client.name} item xs={12} sm={6} md={4} lg={3}>
              <Card
                variant="outlined"
                sx={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  borderRadius: 2,
                  bgcolor: isDarkMode ? "#1B212C" : "#F4F3F1",
                  borderColor: isDarkMode ? "#374151" : "rgba(0,0,0,0.12)",
                  boxShadow: isDarkMode ? "0 6px 18px rgba(0,0,0,0.4)" : "0 6px 18px rgba(2,6,23,0.04)",
                  transition: "transform .15s ease, box-shadow .15s ease",
                  "&:hover": {
                    transform: "translateY(-6px)",
                    boxShadow: isDarkMode ? "0 14px 28px rgba(0,0,0,0.5)" : "0 14px 28px rgba(2,6,23,0.10)"
                  },
                  position: "relative",
                  p: 2,
                  gap: 1
                }}
              >

                {isSuperAdmin && (
                  <IconButton sx={{ position: "absolute", top: 4, right: 4, color: "gray" }} onClick={(e) => handleMenuOpen(e, client)}>
                    <MoreVertIcon />
                  </IconButton>
                )}

                <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: "grid", placeItems: "center", background: "#FDF0D5", overflow: "hidden", mb: 0.5 }}>
                  {client?.logo ? (
                    <Box component="img" src={computeLogoUrl(client.logo)} alt="logo" sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={(e) => (e.currentTarget.style.display = "none")} />
                  ) : (
                    <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.light, color: "white", fontWeight: 700 }}>{firstChar(client?.name)}</Avatar>
                  )}
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 500, fontSize: "0.9rem", textAlign: "left", color: isDarkMode ? "#F9FAFB" : "inherit" }} noWrap>{client?.name}</Typography>

                {isSuperAdmin && (() => {
                  const clientId = String(client.id ?? client._id);
                  const isPlatformHome = isSafetynettClient(client);
                  const isActive = isPlatformHome
                    ? !actingClient
                    : actingClient?.id === clientId;
                  const label = isPlatformHome
                    ? isActive
                      ? "Platform superadmin"
                      : "Platform view"
                    : isActive
                      ? "Active company"
                      : "Switch company";
                  return (
                  <Button
                    variant={isActive ? "contained" : "outlined"}
                    startIcon={<SwapHorizIcon sx={{ fontSize: "1.1rem" }} />}
                    onClick={() => onSwitchCompany(client)}
                    sx={{
                      textTransform: "none",
                      borderRadius: 50,
                      px: 2,
                      py: 0.5,
                      fontSize: "0.75rem",
                      mt: 1,
                      ...(isActive
                        ? {
                            bgcolor: "hsl(38, 70%, 55%)",
                            color: "#111827",
                            borderColor: "hsl(38, 70%, 55%)",
                            "&:hover": { bgcolor: "hsl(38, 70%, 45%)" },
                          }
                        : {
                            borderColor: isDarkMode ? "#60A5FA" : "#0B4DA6",
                            color: isDarkMode ? "#60A5FA" : "#0B4DA6",
                            "&:hover": {
                              bgcolor: isDarkMode ? "rgba(96, 165, 250, 0.1)" : "#EDF5FF",
                              borderColor: isDarkMode ? "#60A5FA" : "#0B4DA6",
                            },
                          }),
                    }}
                  >
                    {label}
                  </Button>
                  );
                })()}

              </Card>
            </Grid>
          ))}
        </Grid>
      )}


      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            boxShadow: isDarkMode ? "0px 4px 20px rgba(0, 0, 0, 0.5)" : "none",
            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
            border: isDarkMode ? "1px solid #374151" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 3,
            minWidth: 180,
            color: isDarkMode ? "#F9FAFB" : "inherit",
          }
        }}
      >
        <MenuItem
          onClick={() => { handleMenuClose(); openEditModal(selectedClient); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={confirmDelete}
          sx={{ borderRadius: 2, py: 1, color: "#EF4444", fontSize: "0.95rem", "&:hover": { bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.05)" } }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Delete confirm */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Client</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Are you sure you want to delete <b style={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>{selectedClient?.name || "this client"}</b>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: "none", borderRadius: 50, px: 3 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit modal */}
      <Dialog
        open={openModal}
        onClose={closeModal}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6, // approx 24px-32px
            bgcolor: isDarkMode ? "#111827" : "#F4F3F1",
            p: 1.5,
            px: 2,
            position: "relative",
            color: isDarkMode ? "#F9FAFB" : "inherit",
          }
        }}
      >
        <IconButton
          onClick={closeModal}
          sx={{ position: "absolute", top: 16, right: 16, color: "text.secondary" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#1e293b", lineHeight: 1.2 }}>
            {isEditMode ? "Edit Client" : "Create New Client"}
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#64748b", mb: 3 }}>
            {isEditMode ? "Modify the client details below." : "Add a new client to your account."}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: isDarkMode ? "#E5E7EB" : "#1e293b" }}>
              Client Name
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter client name"
              value={form.name}
              onChange={(e) => handleChange("name")(e)}
              error={!!errors.name}
              helperText={errors.name}
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 50,
                  bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                  px: 1,
                  color: isDarkMode ? "#F9FAFB" : "inherit",
                  "& fieldset": { borderColor: isDarkMode ? "#374151" : "rgba(0,0,0,0.1)" },
                  "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 2 },
                },
                "& .MuiInputBase-input": { py: 1.5, px: 2 },
                "& .MuiInputBase-input::placeholder": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }}
            />
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: isDarkMode ? "#E5E7EB" : "#1e293b" }}>
              Client Logo
            </Typography>

            <input
              id="client-logo-file"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleChange("file")(e)}
            />

            <label htmlFor="client-logo-file">
              <Box
                sx={{
                  border: isDarkMode ? "2px dashed #374151" : "2px dashed rgba(0,0,0,0.1)",
                  borderRadius: 4,
                  p: 4,
                  textAlign: "center",
                  cursor: "pointer",
                  bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.012)",
                  transition: "background 0.2s",
                  "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1
                }}
              >
                {form.preview || form.existingLogo ? (
                  <Box
                    component="img"
                    src={form.preview || computeLogoUrl(form.existingLogo)}
                    alt="logo preview"
                    sx={{ width: 80, height: 80, objectFit: "contain", borderRadius: 2 }}
                  />
                ) : (
                  <>
                    <Box sx={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", mb: 1 }}>
                      <UploadIcon sx={{ color: "#64748b" }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#64748b" }}>
                      Click to upload logo
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDarkMode ? "#6B7280" : "#94a3b8" }}>
                      PNG, JPG up to 5MB
                    </Typography>
                  </>
                )}
              </Box>
            </label>
            {errors.file && (<Typography color="error" variant="caption" sx={{ mt: 1, display: "block" }}>{errors.file}</Typography>)}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button
              onClick={closeModal}
              disabled={submitting}
              sx={{
                textTransform: "none",
                borderRadius: 4,
                px: 4,
                py: 1.2,
                color: isDarkMode ? "#F9FAFB" : "#1e293b",
                fontWeight: 600,
                bgcolor: isDarkMode ? "#1B212C" : "white",
                border: isDarkMode ? "1px solid #374151" : "1px solid rgba(0,0,0,0.1)",
                "&:hover": { bgcolor: isDarkMode ? "#374151" : "#f8fafc" }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => { isEditMode ? handleUpdate(selectedClient?.id || selectedClient?._id) : handleCreate(); }}
              disabled={submitting || !form.name.trim() || (!form.file && !form.existingLogo)}
              sx={{
                textTransform: "none",
                borderRadius: 4,
                px: 4,
                py: 1.2,
                bgcolor: "hsl(38, 70%, 55%)",
                color: "white",
                fontWeight: 600,
                boxShadow: "none",
                "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" }
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : isEditMode ? "Save changes" : "Create Client"}
            </Button>
          </Box>
        </Box>

        {errors.form && (<Typography color="error" textAlign="center" sx={{ mt: 2 }}>{errors.form}</Typography>)}
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseSnack}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
