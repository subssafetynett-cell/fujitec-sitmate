import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Download,
} from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api, {
  createSiteSubfolder,
  deleteSiteSubfolder,
  fetchAllFormResponsesList,
  fetchFormResponsesList,
  fetchSiteSubfolders,
  fetchSites,
  updateSiteSubfolder,
} from "../services/api";
import { getMonitoringSection } from "../constants/monitoringSections";
import {
  belongsInMonitoringSectionList,
  belongsInMonitoringSubmission,
  buildMonitoringBuilderFormUrl,
  buildMonitoringFormUrl,
  buildMonitoringSavedTemplateUrl,
  buildMonitoringSubmissionUrl,
  filterMonitoringBuilderForms,
  filterMonitoringSavedTemplates,
  filterMonitoringTemplates,
  formatMonitoringDate,
  getMonitoringSubmissionTitle,
  isMonitoringCustomBuilderSubmission,
  monitoringFolderPath,
  monitoringSitePath,
} from "../utils/monitoringContext";
import { CONTEXTUAL_FORM_DONE, withEmbeddedFill } from "../utils/embeddedFormFill";
import { isGeneralFormsPageSubmission } from "../utils/generalFormSubmissions";
import { fetchWithCache } from "../utils/fetchCache";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25];
const TEMPLATE_TAB_LIBRARY = "library";
const TEMPLATE_TAB_SAVED = "saved";
const TEMPLATE_TAB_BUILDER = "builder";

function getSiteId(site) {
  return site?._id || site?.id;
}

export default function MonitoringSectionPage({ section: sectionKey }) {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { siteId: routeSiteId, folderId: routeFolderId } = useParams();

  const section = getMonitoringSection(sectionKey);

  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePickerTab, setTemplatePickerTab] = useState(TEMPLATE_TAB_LIBRARY);
  const [savedSubmissions, setSavedSubmissions] = useState([]);
  const [builderForms, setBuilderForms] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState("create");
  const [editingFolder, setEditingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [templateFolderId, setTemplateFolderId] = useState(null);
  const [siteSearch, setSiteSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formPanelOpen, setFormPanelOpen] = useState(false);
  const [formPanelUrl, setFormPanelUrl] = useState("");
  const [formPanelTitle, setFormPanelTitle] = useState("");
  const [formPanelMode, setFormPanelMode] = useState("view");
  const [formPanelRow, setFormPanelRow] = useState(null);
  const formPanelWasEditRef = useRef(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuRow, setMenuRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const headingColor = isDarkMode ? "#F9FAFB" : "#111827";
  const subColor = isDarkMode ? "#9CA3AF" : "#6B7280";
  const borderColor = isDarkMode ? "#374151" : "#E5E7EB";
  const surfaceBg = isDarkMode ? "#1B212C" : "#FFFFFF";

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const data = await fetchWithCache("monitoring-sites", () => fetchSites(""), {
        ttlMs: 120_000,
      });
      setSites((data || []).filter((site) => site.isActive !== false));
    } catch (error) {
      console.error("Failed to load sites", error);
      setSnack({
        open: true,
        message: "Could not load sites. Please try again.",
        severity: "error",
      });
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const loadFolders = useCallback(async (siteId) => {
    if (!siteId) return;
    setLoadingFolders(true);
    try {
      const { subfolders } = await fetchSiteSubfolders(siteId, {
        monitoringSection: sectionKey,
      });
      setFolders(subfolders || []);
    } catch (error) {
      console.error("Failed to load folders", error);
      setSnack({
        open: true,
        message: "Could not load folders for this site.",
        severity: "warning",
      });
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, [sectionKey]);

  const loadSubmissions = useCallback(
    async (siteId, folderId) => {
      if (!section) return;
      // Flat section list (Performance Monitoring pages — no site/folder required).
      if (!siteId || !folderId) {
        setLoadingSubmissions(true);
        try {
          const res = await fetchAllFormResponsesList({ category: section.category });
          const rows = (res?.data || []).filter((row) =>
            belongsInMonitoringSectionList(row, sectionKey)
          );
          rows.sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          });
          setSubmissions(rows);
        } catch (error) {
          console.error("Failed to load monitoring forms", error);
          setSnack({
            open: true,
            message: "Could not load saved forms for this page.",
            severity: "error",
          });
        } finally {
          setLoadingSubmissions(false);
        }
        return;
      }

      setLoadingSubmissions(true);
      try {
        const res = await fetchAllFormResponsesList({ siteId, subfolderId: folderId });
        const rows = (res?.data || []).filter((row) =>
          belongsInMonitoringSubmission(row, sectionKey, { siteId, folderId })
        );
        rows.sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setSubmissions(rows);
      } catch (error) {
        console.error("Failed to load monitoring forms", error);
        setSnack({
          open: true,
          message: "Could not load saved forms for this folder.",
          severity: "error",
        });
      } finally {
        setLoadingSubmissions(false);
      }
    },
    [section, sectionKey]
  );

  // Deep site/folder URLs are no longer used — keep users on the flat section page.
  useEffect(() => {
    if (routeSiteId && section?.basePath) {
      navigate(section.basePath, { replace: true });
    }
  }, [routeSiteId, section?.basePath, navigate]);

  useEffect(() => {
    if (routeSiteId) return;
    loadSubmissions();
  }, [routeSiteId, loadSubmissions]);

  useEffect(() => {
    if (!routeSiteId) {
      setSelectedSite(null);
      setFolders([]);
      setSelectedFolder(null);
      return;
    }
    loadFolders(routeSiteId);
  }, [routeSiteId, loadFolders]);

  useEffect(() => {
    if (!routeSiteId) return;
    if (loadingSites) return;
    const match = sites.find((site) => getSiteId(site) === routeSiteId);
    if (match) setSelectedSite(match);
    else setSelectedSite({ id: routeSiteId, _id: routeSiteId, name: "Site" });
  }, [routeSiteId, sites, loadingSites]);

  useEffect(() => {
    if (!routeSiteId || !routeFolderId) {
      setSelectedFolder(null);
      return;
    }
    loadSubmissions(routeSiteId, routeFolderId);
  }, [routeSiteId, routeFolderId, loadSubmissions]);

  useEffect(() => {
    if (!routeFolderId || loadingFolders) return;
    const match = folders.find((folder) => folder.id === routeFolderId);
    if (match) setSelectedFolder(match);
    else setSelectedFolder({ id: routeFolderId, name: "Folder" });
  }, [routeFolderId, folders, loadingFolders]);

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((site) =>
      String(site.name || "").toLowerCase().includes(q)
    );
  }, [sites, siteSearch]);

  const filteredTemplates = useMemo(
    () => filterMonitoringTemplates(templateSearch),
    [templateSearch]
  );

  const filteredSavedSubmissions = useMemo(
    () => filterMonitoringSavedTemplates(savedSubmissions, templateSearch),
    [savedSubmissions, templateSearch]
  );

  const filteredBuilderForms = useMemo(
    () => filterMonitoringBuilderForms(builderForms, templateSearch),
    [builderForms, templateSearch]
  );

  useEffect(() => {
    if (!templateDialogOpen) return undefined;
    let cancelled = false;
    const loadPickerData = async () => {
      setPickerLoading(true);
      setSavedSubmissions([]);
      setBuilderForms([]);
      try {
        const [responsesRes, formsRes] = await Promise.all([
          fetchFormResponsesList({ category: "General forms,__empty__" }),
          api.get("/forms"),
        ]);
        if (cancelled) return;
        if (responsesRes?.success) {
          const saved = (responsesRes.data || [])
            .filter(isGeneralFormsPageSubmission)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setSavedSubmissions(saved);
        }
        if (formsRes.data?.success) {
          const userCreatedForms = (formsRes.data.data || []).filter(
            (form) =>
              !(
                form.fields?.length === 1 &&
                form.fields[0].id === "custom_hardcoded_form_data"
              )
          );
          setBuilderForms(userCreatedForms);
        }
      } catch (error) {
        console.error("Failed to load template picker data", error);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    };
    loadPickerData();
    return () => {
      cancelled = true;
    };
  }, [templateDialogOpen]);

  const paginatedRows = submissions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (!section) {
    return (
      <Layout pageTitle="Monitoring">
        <Typography sx={{ color: subColor }}>Unknown monitoring section.</Typography>
      </Layout>
    );
  }

  const handleOpenFolder = (folder) => {
    navigate(monitoringFolderPath(sectionKey, routeSiteId, folder.id));
  };

  const handleBack = () => {
    if (routeFolderId) {
      navigate(monitoringSitePath(sectionKey, routeSiteId));
      return;
    }
    if (routeSiteId) {
      navigate(section.basePath);
      return;
    }
  };

  const openCreateFolderDialog = () => {
    setFolderDialogMode("create");
    setEditingFolder(null);
    setNewFolderName("");
    setFolderDialogOpen(true);
  };

  const openEditFolderDialog = (folder) => {
    setFolderDialogMode("edit");
    setEditingFolder(folder);
    setNewFolderName(folder.name || "");
    setFolderDialogOpen(true);
  };

  const closeTemplateDialog = () => {
    setTemplateDialogOpen(false);
    setTemplateFolderId(null);
    setTemplatePickerTab(TEMPLATE_TAB_LIBRARY);
    setTemplateSearch("");
  };

  const openTemplateDialog = () => {
    setTemplatePickerTab(TEMPLATE_TAB_LIBRARY);
    setTemplateSearch("");
    setTemplateFolderId(routeFolderId || null);
    setTemplateDialogOpen(true);
  };

  const handlePickFolderForTemplate = (folderId) => {
    setTemplateFolderId(folderId);
    setFolderPickerOpen(false);
    setTemplatePickerTab(TEMPLATE_TAB_LIBRARY);
    setTemplateSearch("");
    setTemplateDialogOpen(true);
  };

  const activeTemplateFolderId = routeFolderId || templateFolderId;

  const openFillPage = (url) => {
    if (!url) {
      setSnack({
        open: true,
        message: "This template cannot be opened from monitoring.",
        severity: "warning",
      });
      return;
    }
    closeTemplateDialog();
    navigate(url);
  };

  const fillContext = {
    sectionKey,
    siteId: routeSiteId || undefined,
    folderId: activeTemplateFolderId || undefined,
  };

  const handleUseTemplate = (template) => {
    const url = buildMonitoringFormUrl(template, { ...fillContext, preview: false });
    openFillPage(url);
  };

  const handlePreviewTemplate = (template) => {
    const url = buildMonitoringFormUrl(template, { ...fillContext, preview: true });
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleUseSavedTemplate = (submission) => {
    const url = buildMonitoringSavedTemplateUrl(submission, { ...fillContext, preview: false });
    openFillPage(url);
  };

  const handlePreviewSavedTemplate = (submission) => {
    const url = buildMonitoringSavedTemplateUrl(submission, { ...fillContext, preview: true });
    if (!url) return;
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleUseBuilderForm = (form) => {
    const formId = form._id || form.id;
    if (!formId) return;
    const url = buildMonitoringBuilderFormUrl(formId, { ...fillContext, preview: false });
    openFillPage(url);
  };

  const handlePreviewBuilderForm = (form) => {
    const formId = form._id || form.id;
    if (!formId) return;
    const url = buildMonitoringBuilderFormUrl(formId, { ...fillContext, preview: true });
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleSaveFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !routeSiteId) return;
    setCreatingFolder(true);
    try {
      if (folderDialogMode === "edit" && editingFolder?.id) {
        await updateSiteSubfolder(routeSiteId, editingFolder.id, name);
        setSnack({ open: true, message: "Folder updated.", severity: "success" });
        setFolderDialogOpen(false);
        setNewFolderName("");
        setEditingFolder(null);
        await loadFolders(routeSiteId);
        return;
      }

      const { subfolder } = await createSiteSubfolder(routeSiteId, name, {
        monitoringSection: sectionKey,
      });
      setSnack({ open: true, message: "Folder created.", severity: "success" });
      setFolderDialogOpen(false);
      setNewFolderName("");
      await loadFolders(routeSiteId);
      if (subfolder?.id) {
        navigate(monitoringFolderPath(sectionKey, routeSiteId, subfolder.id));
      }
    } catch (error) {
      console.error("Save folder failed", error);
      setSnack({
        open: true,
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Could not save folder.",
        severity: "error",
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderDeleteTarget?.id || !routeSiteId) return;
    setDeletingFolder(true);
    try {
      await deleteSiteSubfolder(routeSiteId, folderDeleteTarget.id);
      setSnack({ open: true, message: "Folder deleted.", severity: "success" });
      setFolderDeleteTarget(null);
      if (routeFolderId === folderDeleteTarget.id) {
        navigate(monitoringSitePath(sectionKey, routeSiteId));
        return;
      }
      await loadFolders(routeSiteId);
    } catch (error) {
      console.error("Delete folder failed", error);
      setSnack({
        open: true,
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Could not delete folder.",
        severity: "error",
      });
    } finally {
      setDeletingFolder(false);
    }
  };

  const getSubmissionTitle = (row) => getMonitoringSubmissionTitle(row);

  const openFormPanel = (row, mode) => {
    if (!row) return;
    const url = buildMonitoringSubmissionUrl(row, {
      sectionKey,
      siteId: routeSiteId || row?.answers?.siteId || row?.siteId || undefined,
      folderId:
        routeFolderId || row?.answers?.subfolderId || row?.subfolderId || undefined,
      mode,
    });
    if (!url) {
      setSnack({
        open: true,
        message: "This form cannot be opened from monitoring.",
        severity: "warning",
      });
      return;
    }
    formPanelWasEditRef.current = mode === "edit";
    setFormPanelRow(row);
    setFormPanelTitle(getSubmissionTitle(row));
    setFormPanelMode(mode);
    setFormPanelUrl(mode === "edit" ? withEmbeddedFill(url) : url);
    setFormPanelOpen(true);
  };

  const closeFormPanel = useCallback(() => {
    const wasEdit = formPanelWasEditRef.current;
    setFormPanelOpen(false);
    setFormPanelUrl("");
    setFormPanelRow(null);
    formPanelWasEditRef.current = false;

    if (!wasEdit) return;

    if (routeSiteId && routeFolderId) {
      loadSubmissions(routeSiteId, routeFolderId);
      return;
    }
    loadSubmissions();
  }, [routeSiteId, routeFolderId, loadSubmissions]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== CONTEXTUAL_FORM_DONE) return;
      closeFormPanel();
      setSnack({
        open: true,
        message: "Form saved. It will appear in this list.",
        severity: "success",
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [closeFormPanel]);

  const downloadSubmission = (row, format) => {
    if (!row) return;
    const mode = format === "word" ? "download_word" : "download_pdf";
    const url = buildMonitoringSubmissionUrl(row, {
      sectionKey,
      siteId: routeSiteId || row?.answers?.siteId || row?.siteId || undefined,
      folderId:
        routeFolderId || row?.answers?.subfolderId || row?.subfolderId || undefined,
      mode,
    });
    if (!url) {
      setSnack({
        open: true,
        message: "Download is not available for this form.",
        severity: "warning",
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openSubmission = (row, mode) => {
    openFormPanel(row, mode);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const id = deleteTarget.id || deleteTarget._id;
      await api.delete(`/forms/responses/${id}`);
      setSnack({ open: true, message: "Form deleted.", severity: "success" });
      setDeleteTarget(null);
      if (routeSiteId && routeFolderId) {
        await loadSubmissions(routeSiteId, routeFolderId);
      } else {
        await loadSubmissions();
      }
      const maxPage = Math.max(0, Math.ceil((submissions.length - 1) / rowsPerPage) - 1);
      if (page > maxPage) setPage(maxPage);
    } catch (error) {
      console.error("Delete failed", error);
      setSnack({
        open: true,
        message: error?.response?.data?.message || "Could not delete this form.",
        severity: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const siteName = selectedSite?.name || "Site";
  const folderName = selectedFolder?.name || "Folder";
  const insideFolder = Boolean(routeSiteId && routeFolderId);
  const insideSite = Boolean(routeSiteId && !routeFolderId);

  const actionButtons = (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <Button
        variant="contained"
        startIcon={<FileText size={18} />}
        onClick={openTemplateDialog}
        sx={{
          bgcolor: "#E89F17",
          textTransform: "none",
          fontWeight: 600,
          borderRadius: "10px",
          px: 2.5,
          boxShadow: "none",
          "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
        }}
      >
        Select Forms
      </Button>
    </Box>
  );

  return (
    <Layout pageTitle={section.title}>
      <Box sx={{ width: "100%", minWidth: 0, py: 2 }}>
        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(232, 159, 23, 0.12)",
                color: "#E89F17",
                display: "flex",
                flexShrink: 0,
              }}
            >
              <TrendingUp size={22} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: headingColor, mb: 0.5 }}>
                {section.title}
              </Typography>
              <Typography sx={{ color: subColor, fontSize: "0.95rem", maxWidth: 720 }}>
                {section.subtitle ||
                  "Select a form to fill, then review saved submissions on this page."}
              </Typography>
            </Box>
          </Box>
          {actionButtons}
        </Box>

        {routeSiteId ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#E89F17" }} />
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${borderColor}`,
              bgcolor: surfaceBg,
              overflow: "hidden",
            }}
          >
            {loadingSubmissions ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress sx={{ color: "#E89F17" }} />
              </Box>
            ) : submissions.length === 0 ? (
              <Box sx={{ py: 8, px: 3, textAlign: "center" }}>
                <Typography sx={{ fontWeight: 600, color: headingColor, mb: 0.5 }}>
                  No saved forms yet
                </Typography>
                <Typography sx={{ color: subColor, fontSize: "0.9rem", mb: 3 }}>
                  Select a form to fill and save — it will appear in this list.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Plus size={18} />}
                  onClick={openTemplateDialog}
                  sx={{
                    bgcolor: "#E89F17",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { bgcolor: "#cc8b14" },
                  }}
                >
                  Select Forms
                </Button>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F9FAFB",
                          "& th": {
                            fontWeight: 600,
                            color: subColor,
                            fontSize: "0.8rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            borderBottom: `1px solid ${borderColor}`,
                          },
                        }}
                      >
                        <TableCell width={72}>SL No</TableCell>
                        <TableCell>Form</TableCell>
                        <TableCell width={160}>Saved</TableCell>
                        <TableCell width={90} align="right">
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedRows.map((row, index) => {
                        const slNo = page * rowsPerPage + index + 1;
                        const title = getSubmissionTitle(row);
                        return (
                          <TableRow
                            key={row.id || row._id}
                            hover
                            sx={{ "& td": { borderBottom: `1px solid ${borderColor}` } }}
                          >
                            <TableCell sx={{ color: headingColor, fontWeight: 500 }}>
                              {slNo}
                            </TableCell>
                            <TableCell sx={{ color: headingColor, fontWeight: 500 }}>
                              {title}
                            </TableCell>
                            <TableCell sx={{ color: subColor }}>
                              {formatMonitoringDate(row.updatedAt || row.createdAt)}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                aria-label="Form actions"
                                onClick={(e) => {
                                  setMenuAnchor(e.currentTarget);
                                  setMenuRow(row);
                                }}
                              >
                                <MoreHorizontal size={18} color={subColor} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={submissions.length}
                  page={page}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                  sx={{ borderTop: `1px solid ${borderColor}`, color: subColor }}
                />
              </>
            )}
          </Paper>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setMenuRow(null);
        }}
      >
        <MenuItem
          onClick={() => {
            openSubmission(menuRow, "view");
            setMenuAnchor(null);
            setMenuRow(null);
          }}
        >
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            openSubmission(menuRow, "edit");
            setMenuAnchor(null);
            setMenuRow(null);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            downloadSubmission(menuRow, "pdf");
            setMenuAnchor(null);
            setMenuRow(null);
          }}
        >
          Download as PDF
        </MenuItem>
        {isMonitoringCustomBuilderSubmission(menuRow) ? (
          <MenuItem
            onClick={() => {
              downloadSubmission(menuRow, "word");
              setMenuAnchor(null);
              setMenuRow(null);
            }}
          >
            Download as Word
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            setDeleteTarget(menuRow);
            setMenuAnchor(null);
            setMenuRow(null);
          }}
          sx={{ color: "#DC2626" }}
        >
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={templateDialogOpen}
        onClose={closeTemplateDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
            border: `1px solid ${borderColor}`,
            overflow: "hidden",
            boxShadow: isDarkMode
              ? "0 24px 48px rgba(0,0,0,0.45)"
              : "0 24px 48px rgba(15,23,42,0.12)",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: headingColor,
            pb: 1.5,
            pt: 2.5,
            px: 3,
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: "rgba(232, 159, 23, 0.12)",
              color: "#E89F17",
              display: "flex",
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            <FileText size={20} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, color: headingColor, fontSize: "1.1rem" }}>
              Select Forms
            </Typography>
            <Typography variant="body2" sx={{ color: subColor, mt: 0.5 }}>
              Choose from templates, saved templates, or form builder forms.
            </Typography>
          </Box>
        </DialogTitle>
        <Box sx={{ px: 3, borderBottom: `1px solid ${borderColor}`, bgcolor: isDarkMode ? "#111827" : "#F9FAFB" }}>
          <Tabs
            value={templatePickerTab}
            onChange={(_, value) => setTemplatePickerTab(value)}
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                minHeight: 40,
                color: subColor,
              },
              "& .Mui-selected": { color: "#E89F17" },
              "& .MuiTabs-indicator": { bgcolor: "#E89F17" },
            }}
          >
            <Tab
              value={TEMPLATE_TAB_LIBRARY}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  Templates
                  <Chip size="small" label={filteredTemplates.length} sx={{ height: 20, fontSize: "0.7rem" }} />
                </Box>
              }
            />
            <Tab
              value={TEMPLATE_TAB_SAVED}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  Saved Templates
                  <Chip size="small" label={filteredSavedSubmissions.length} sx={{ height: 20, fontSize: "0.7rem" }} />
                </Box>
              }
            />
            <Tab
              value={TEMPLATE_TAB_BUILDER}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  Formbuilder Template
                  <Chip size="small" label={filteredBuilderForms.length} sx={{ height: 20, fontSize: "0.7rem" }} />
                </Box>
              }
            />
          </Tabs>
        </Box>
        <DialogContent
          dividers
          sx={{
            maxHeight: "70vh",
            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
            px: 3,
            py: 2.5,
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder={
              templatePickerTab === TEMPLATE_TAB_SAVED
                ? "Search saved templates..."
                : templatePickerTab === TEMPLATE_TAB_BUILDER
                  ? "Search form builder forms..."
                  : "Search templates..."
            }
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color={subColor} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
              },
            }}
            sx={{ mb: 2.5 }}
          />

          {pickerLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress sx={{ color: "#E89F17" }} />
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                gap: 2,
              }}
            >
              {templatePickerTab === TEMPLATE_TAB_LIBRARY &&
                (filteredTemplates.length === 0 ? (
                  <Typography sx={{ color: subColor, gridColumn: "1 / -1", py: 2, textAlign: "center" }}>
                    No templates match your search.
                  </Typography>
                ) : (
                  filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      elevation={0}
                      sx={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 2,
                        bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              bgcolor: "rgba(232, 159, 23, 0.12)",
                              color: "#E89F17",
                              display: "flex",
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={18} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            {template.group ? (
                              <Typography
                                variant="caption"
                                sx={{ color: "#E89F17", fontWeight: 600, display: "block", mb: 0.25 }}
                              >
                                {template.group}
                              </Typography>
                            ) : null}
                            <Typography sx={{ fontWeight: 600, color: headingColor, fontSize: "0.9rem" }}>
                              {template.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: subColor, mt: 0.5 }}>
                              {template.description}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Eye size={16} />}
                            onClick={() => handlePreviewTemplate(template)}
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            Preview
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={() => handleUseTemplate(template)}
                            sx={{
                              bgcolor: "#E89F17",
                              textTransform: "none",
                              fontWeight: 600,
                              "&:hover": { bgcolor: "#cc8b14" },
                            }}
                          >
                            Use
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))
                ))}

              {templatePickerTab === TEMPLATE_TAB_SAVED &&
                (filteredSavedSubmissions.length === 0 ? (
                  <Typography sx={{ color: subColor, gridColumn: "1 / -1", py: 2, textAlign: "center" }}>
                    No saved templates yet. Save a template from the Templates page to see it here.
                  </Typography>
                ) : (
                  filteredSavedSubmissions.map((submission) => {
                    const rid = submission.id || submission._id;
                    const primary =
                      submission.name ||
                      submission.answers?.name ||
                      submission.form?.title ||
                      "Untitled";
                    const secondary =
                      submission.answers?.templateModuleTitle ||
                      (submission.form?.title && primary !== submission.form.title
                        ? submission.form.title
                        : null);
                    const savedLabel = submission.createdAt
                      ? `Saved ${formatMonitoringDate(submission.createdAt)}`
                      : null;
                    return (
                      <Card
                        key={rid}
                        elevation={0}
                        sx={{
                          border: `1px solid ${borderColor}`,
                          borderRadius: 2,
                          bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: "rgba(232, 159, 23, 0.12)",
                                color: "#E89F17",
                                display: "flex",
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              {secondary ? (
                                <Typography
                                  variant="caption"
                                  sx={{ color: "#E89F17", fontWeight: 600, display: "block", mb: 0.25 }}
                                >
                                  {secondary}
                                </Typography>
                              ) : null}
                              <Typography sx={{ fontWeight: 600, color: headingColor, fontSize: "0.9rem" }}>
                                {primary}
                              </Typography>
                              {savedLabel ? (
                                <Typography variant="body2" sx={{ color: subColor, mt: 0.5 }}>
                                  {savedLabel}
                                </Typography>
                              ) : null}
                            </Box>
                          </Box>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={<Eye size={16} />}
                              onClick={() => handlePreviewSavedTemplate(submission)}
                              sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                              Preview
                            </Button>
                            <Button
                              fullWidth
                              variant="contained"
                              onClick={() => handleUseSavedTemplate(submission)}
                              sx={{
                                bgcolor: "#E89F17",
                                textTransform: "none",
                                fontWeight: 600,
                                "&:hover": { bgcolor: "#cc8b14" },
                              }}
                            >
                              Use
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })
                ))}

              {templatePickerTab === TEMPLATE_TAB_BUILDER &&
                (filteredBuilderForms.length === 0 ? (
                  <Typography sx={{ color: subColor, gridColumn: "1 / -1", py: 2, textAlign: "center" }}>
                    No form builder forms match your search. Create forms in the Form Builder first.
                  </Typography>
                ) : (
                  filteredBuilderForms.map((form) => {
                    const formId = form._id || form.id;
                    return (
                      <Card
                        key={formId}
                        elevation={0}
                        sx={{
                          border: `1px solid ${borderColor}`,
                          borderRadius: 2,
                          bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: "rgba(232, 159, 23, 0.12)",
                                color: "#E89F17",
                                display: "flex",
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600, color: headingColor, fontSize: "0.9rem" }}>
                                {form.title || "Untitled form"}
                              </Typography>
                              {form.description ? (
                                <Typography variant="body2" sx={{ color: subColor, mt: 0.5 }}>
                                  {form.description}
                                </Typography>
                              ) : (
                                <Typography variant="body2" sx={{ color: subColor, mt: 0.5 }}>
                                  Custom form from the form builder
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={<Eye size={16} />}
                              onClick={() => handlePreviewBuilderForm(form)}
                              sx={{ textTransform: "none", fontWeight: 600 }}
                            >
                              Preview
                            </Button>
                            <Button
                              fullWidth
                              variant="contained"
                              onClick={() => handleUseBuilderForm(form)}
                              sx={{
                                bgcolor: "#E89F17",
                                textTransform: "none",
                                fontWeight: 600,
                                "&:hover": { bgcolor: "#cc8b14" },
                              }}
                            >
                              Use
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })
                ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${borderColor}`,
            bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB",
          }}
        >
          <Button
            onClick={closeTemplateDialog}
            sx={{ textTransform: "none", fontWeight: 600, color: subColor }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={folderDialogOpen} onClose={() => !creatingFolder && setFolderDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: headingColor }}>
          {folderDialogMode === "edit" ? "Edit folder" : "Create folder"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            disabled={creatingFolder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) handleSaveFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFolderDialogOpen(false)} disabled={creatingFolder} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveFolder}
            disabled={creatingFolder || !newFolderName.trim()}
            sx={{
              bgcolor: "#E89F17",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#cc8b14" },
            }}
          >
            {creatingFolder
              ? folderDialogMode === "edit"
                ? "Saving…"
                : "Creating…"
              : folderDialogMode === "edit"
                ? "Save"
                : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: headingColor }}>
          Choose a folder
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ color: subColor, fontSize: "0.9rem", mb: 2 }}>
            Select which folder to add the template form to.
          </Typography>
          {folders.map((folder) => (
            <Button
              key={folder.id}
              fullWidth
              variant="outlined"
              startIcon={<Folder size={18} />}
              onClick={() => handlePickFolderForTemplate(folder.id)}
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                fontWeight: 600,
                mb: 1,
                borderColor,
                color: headingColor,
              }}
            >
              {folder.name}
            </Button>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFolderPickerOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(folderDeleteTarget)}
        onClose={() => !deletingFolder && setFolderDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: headingColor }}>
          Delete folder?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: subColor }}>
            Delete &ldquo;{folderDeleteTarget?.name}&rdquo;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setFolderDeleteTarget(null)}
            disabled={deletingFolder}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteFolder}
            disabled={deletingFolder}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deletingFolder ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={formPanelOpen}
        onClose={closeFormPanel}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { height: "min(90vh, 900px)", borderRadius: 3, display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: headingColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            pr: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {formPanelTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: subColor, mt: 0.25 }}>
              {formPanelMode === "view"
                ? "Read-only preview"
                : "Fill and save here — the form stays on this page"}
            </Typography>
          </Box>
          {formPanelMode === "view" && formPanelRow ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={16} />}
              onClick={() => downloadSubmission(formPanelRow, "pdf")}
              sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
            >
              Download PDF
            </Button>
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, overflow: "hidden" }}>
          {formPanelUrl ? (
            <iframe
              src={formPanelUrl}
              title={formPanelTitle || "Form"}
              style={{ border: "none", width: "100%", height: "100%" }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${borderColor}` }}>
          <Button onClick={closeFormPanel} sx={{ textTransform: "none" }}>
            Close
          </Button>
          {formPanelMode === "view" && formPanelRow ? (
            <Button
              variant="contained"
              startIcon={<Download size={16} />}
              onClick={() => downloadSubmission(formPanelRow, "pdf")}
              sx={{
                bgcolor: "#E89F17",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { bgcolor: "#cc8b14" },
              }}
            >
              Download PDF
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { height: "85vh", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: headingColor }}>
          Form preview
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: "100%", overflow: "hidden" }}>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Form preview"
              style={{ border: "none", width: "100%", height: "100%" }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPreviewOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: headingColor }}>
          Delete form?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: subColor }}>
            This will permanently remove the saved form from this folder.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
