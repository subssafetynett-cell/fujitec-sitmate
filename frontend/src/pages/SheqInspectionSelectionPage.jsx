import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
    Box, Typography, Button, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, TablePagination, IconButton, 
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
    Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Snackbar, Alert
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { 
    Pencil, Trash2, 
    Download, Eye
} from "lucide-react";
import Layout from "../components/Layout";
import PageContent from "../components/PageContent";
import { formatSubmitterDisplay, showSubmissionCreatorColumn } from "../utils/submitterDisplay";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import api, { fetchFormResponsesList } from "../services/api";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FormSelectionDialog from "../components/FormSelectionDialog";
import TemplatePreviewDialog from "../components/TemplatePreviewDialog";
import SheqInstallationForm from "./SheqInstallationForm";
import { buildTemplatePreviewUrl, buildTemplateUseUrl } from "../constants/templateCatalog";
import { pathWithSearchParams } from "../utils/monitoringContext";

const SheqInspectionSelectionPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDarkMode } = useTheme();
    const { role } = useAuth();
    const showCreatorColumn = showSubmissionCreatorColumn(role);

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [deleteId, setDeleteId] = useState(null);
    const [deleteInFlight, setDeleteInFlight] = useState(false);
    const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
    const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
    const [templatePreviewUrl, setTemplatePreviewUrl] = useState("");
    const [downloadTarget, setDownloadTarget] = useState(null);

    const customBlue = "#0284c7";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const subTextColor = isDarkMode ? "#94a3b8" : "#64748b";
    const borderColor = isDarkMode ? "#334155" : "#E2E8F0";

    const category = "SHEQ Inspection";
    const listPath = "/sheq-inspection";

    // Responsible person + open/closed state come from the linked NC record,
    // with the saved findings as a fallback for older reports.
    const getNcMeta = (sub) => {
        const nc = sub?.nonconformance;
        const findings = sub?.answers?.formData?.nonconformanceFindings;
        const findingList =
            findings && typeof findings === "object" ? Object.values(findings) : [];
        const hasFindings = Boolean(nc) || findingList.length > 0;

        let responsible = "";
        if (nc?.assignee) {
            responsible = `${nc.assignee.firstName || ""} ${nc.assignee.lastName || ""}`.trim() || nc.assignee.email || "";
        }
        if (!responsible) {
            responsible = [
                ...new Set(
                    findingList.map((f) => String(f?.personResponsible || "").trim()).filter(Boolean)
                ),
            ].join(", ");
        }

        return {
            hasFindings,
            responsible,
            closed: nc?.status === "closed",
        };
    };

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchFormResponsesList({ category });
            if (res?.success) {
                setSubmissions(res.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch submissions", err);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions, location.key]);

    const getFillContextExtra = () => ({
        category,
        listPath,
    });

    const openFillPage = (url) => {
        if (!url) return;
        setTemplatesDialogOpen(false);
        navigate(url);
    };

    const handleDelete = async () => {
        if (!deleteId || deleteInFlight) return;

        const idToDelete = deleteId;
        const removed = submissions.find((s) => (s.id || s._id) === idToDelete);
        setDeleteInFlight(true);
        setDeleteId(null);
        setSubmissions((prev) => prev.filter((s) => (s.id || s._id) !== idToDelete));
        setSnack({ open: true, message: "Report deleted successfully", severity: "success" });

        try {
            const res = await api.delete(`/forms/responses/${idToDelete}`);
            if (!res?.data?.success) {
                throw new Error(res?.data?.message || "Failed to delete report");
            }
        } catch (err) {
            console.error("Delete failed", err);
            if (removed) {
                setSubmissions((prev) => {
                    if (prev.some((s) => (s.id || s._id) === idToDelete)) return prev;
                    return [removed, ...prev];
                });
            }
            setSnack({
                open: true,
                message: err?.response?.data?.message || err?.message || "Failed to delete report",
                severity: "error",
            });
        } finally {
            setDeleteInFlight(false);
        }
    };

    const handleAction = async (id, actionType) => {
        const sub = submissions.find(s => (s.id || s._id) === id);
        const isStandard = sub?.answers?.formData !== undefined;

        if (actionType === "edit") {
            if (isStandard) {
                navigate(`/sheq-install-form/${id}?category=${encodeURIComponent(category)}`);
            } else {
                navigate(`/forms/${sub.formId}/use?responseId=${id}`);
            }
        } else if (actionType === "view") {
            if (isStandard) {
                navigate(`/sheq-install-form/${id}?category=${encodeURIComponent(category)}&view=true`);
            } else {
                navigate(`/forms/${sub.formId}/use?responseId=${id}&view=true`);
            }
        } else if (actionType === "download") {
            if (isStandard) {
                setDownloadTarget({ id, category });
            } else {
                navigate(`/forms/${sub.formId}/use?responseId=${id}&view=true`);
            }
        }
    };

    const handleMenuOpen = (event, item) => {
        setAnchorEl(event.currentTarget);
        setSelectedItem(item);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedItem(null);
    };

    const handleMenuAction = (actionType) => {
        if (!selectedItem) return;
        const subId = selectedItem.id || selectedItem._id;
        
        if (actionType === "view") {
            handleAction(subId, "view"); 
        } else if (actionType === "edit") {
            handleAction(subId, "edit");
        } else if (actionType === "download") {
            handleAction(subId, "download");
        } else if (actionType === "delete") {
            setDeleteId(subId);
        }
        handleMenuClose();
    };

    const openBlankForm = () => {
        openFillPage(
            pathWithSearchParams("/sheq-install-form", {
                category,
                listPath,
            })
        );
    };

    const openTemplatePreview = (url) => {
        if (!url) return;
        setTemplatePreviewUrl(url);
        setTemplatePreviewOpen(true);
        setTemplatesDialogOpen(false);
    };

    const handleTemplateSelection = (item) => {
        const isPreview = Boolean(item?.preview);
        const extra = getFillContextExtra();

        if (item?.type === "sheq-blank") {
            const url = pathWithSearchParams("/sheq-install-form", {
                ...extra,
                ...(isPreview ? { preview: "true" } : {}),
            });
            if (isPreview) {
                openTemplatePreview(url);
                return;
            }
            openFillPage(url);
            return;
        }

        if (item?.type === "sheq-template" && item.id) {
            if (isPreview) {
                openTemplatePreview(
                    pathWithSearchParams(`/sheq-install-form/${item.id}`, {
                        category,
                        view: "true",
                    })
                );
                return;
            }
            openFillPage(
                pathWithSearchParams("/sheq-install-form", {
                    ...extra,
                    fromTemplate: item.id,
                })
            );
            return;
        }

        if (item?.type === "saved-template" && item.submission) {
            const rid = item.submission.id || item.submission._id;
            const url = pathWithSearchParams("/sheq-install-form", {
                ...extra,
                fromTemplate: rid,
                ...(isPreview ? { preview: "true" } : {}),
            });
            if (isPreview) {
                openTemplatePreview(url);
                return;
            }
            openFillPage(url);
            return;
        }

        if (item?.type === "catalog-template" && item.template) {
            const template = item.template;
            if (isPreview) {
                openTemplatePreview(buildTemplatePreviewUrl(template, extra));
                return;
            }
            const url = buildTemplateUseUrl(template, extra);
            if (url) openFillPage(url);
            return;
        }

        const form = item?.form;
        const formId = form?.id || form?._id;
        if (formId) {
            const params = new URLSearchParams({ ...extra });
            if (isPreview) {
                params.set("preview", "true");
                openTemplatePreview(`/forms/${formId}/use?${params.toString()}`);
                return;
            }
            openFillPage(`/forms/${formId}/use?${params.toString()}`);
        }
    };

    return (
        <Layout disablePadding={true}>
            <PageContent>
                {/* Header Section */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: textColor, letterSpacing: "-0.01em" }}>
                            SHEQ service
                        </Typography>
                        <Typography variant="body1" sx={{ color: subTextColor }}>
                            Manage and track your SHEQ service findings.
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <Button
                            variant="contained"
                            onClick={openBlankForm}
                            sx={{
                                bgcolor: "#E89F17",
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: 600,
                                px: 2.5,
                                py: 1,
                                boxShadow: "none",
                                "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
                            }}
                        >
                            Choose Form
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setTemplatesDialogOpen(true)}
                            sx={{
                                color: "#E89F17",
                                borderColor: "#E89F17",
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: 600,
                                px: 2.5,
                                py: 1,
                                "&:hover": {
                                    borderColor: "#cc8b14",
                                    bgcolor: "rgba(232, 159, 23, 0.05)",
                                },
                            }}
                        >
                            Select Forms
                        </Button>
                    </Box>
                </Box>

                {/* Submissions Table */}
                <Paper 
                    elevation={0} 
                    sx={{ 
                        borderRadius: "16px", 
                        border: `1px solid ${borderColor}`,
                        bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
                        overflow: "hidden"
                    }}
                >
                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                            <CircularProgress sx={{ color: customBlue }} />
                        </Box>
                    ) : submissions.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 10 }}>
                            <Typography variant="h6" sx={{ color: textColor, mb: 1 }}>No reports found</Typography>
                            <Typography variant="body2" sx={{ color: subTextColor }}>Start by creating a new service above.</Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead sx={{ bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "#f8fafc" }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Si No</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Date</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Client / Form name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Responsible person</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Status</TableCell>
                                            {showCreatorColumn && (
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Created by</TableCell>
                                            )}
                                            <TableCell align="right" sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {submissions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((sub, index) => {
                                            const subId = sub.id || sub._id;
                                            const answers = sub.answers || {};
                                            const client = answers.formData?.client || sub.form?.title || sub.formId?.title || "Untitled";
                                            const date = new Date(sub.createdAt).toLocaleDateString('en-GB');
                                            const ncMeta = getNcMeta(sub);

                                            return (
                                                <TableRow key={subId} hover sx={{ "&:last-child td": { border: 0 } }}>
                                            <TableCell sx={{ color: textColor, fontWeight: 500 }}>{page * rowsPerPage + index + 1}</TableCell>
                                            <TableCell sx={{ color: textColor, fontWeight: 500 }}>{date}</TableCell>
                                            <TableCell>
                                                <Typography sx={{ color: textColor, fontWeight: 600, fontSize: "0.95rem" }}>{client}</Typography>
                                                <Typography variant="caption" sx={{ color: subTextColor }}>
                                                    {category === "SHEQ Inspection" ? "SHEQ service" : (sub.form?.title || "Standard Form")}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ color: subTextColor, fontSize: "0.85rem" }}>
                                                {ncMeta.responsible || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {ncMeta.hasFindings ? (
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            display: "inline-block",
                                                            px: 1.25,
                                                            py: 0.4,
                                                            borderRadius: "999px",
                                                            fontSize: "0.72rem",
                                                            fontWeight: 700,
                                                            bgcolor: ncMeta.closed
                                                                ? "rgba(34, 197, 94, 0.12)"
                                                                : "rgba(239, 68, 68, 0.12)",
                                                            color: ncMeta.closed ? "#15803d" : "#dc2626",
                                                        }}
                                                    >
                                                        {ncMeta.closed ? "Closed" : "Opened"}
                                                    </Box>
                                                ) : (
                                                    <Typography component="span" sx={{ color: subTextColor, fontSize: "0.85rem" }}>—</Typography>
                                                )}
                                            </TableCell>
                                            {showCreatorColumn && (
                                            <TableCell sx={{ color: subTextColor, fontSize: "0.8rem" }}>
                                                {formatSubmitterDisplay(sub.submittedBy)}
                                            </TableCell>
                                            )}
                                            <TableCell align="right">
                                                <IconButton 
                                                    size="small" 
                                                    onClick={(e) => handleMenuOpen(e, sub)}
                                                    sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                                                >
                                                    <MoreVertIcon />
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
                                onPageChange={(e, p) => setPage(p)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                                sx={{ color: subTextColor, borderTop: `1px solid ${borderColor}` }}
                            />
                        </>
                    )}
                </Paper>
            </PageContent>

            {/* Delete Confirmation */}
            <Dialog 
                open={!!deleteId} 
                onClose={() => setDeleteId(null)}
                PaperProps={{ sx: { borderRadius: "16px", p: 1, bgcolor: isDarkMode ? "#1e293b" : "#fff" } }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: textColor }}>Delete Report?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: subTextColor }}>
                        Are you sure you want to delete this report? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setDeleteId(null)} sx={{ color: subTextColor, textTransform: "none", fontWeight: 600 }}>Cancel</Button>
                    <Button 
                        onClick={handleDelete}
                        disabled={deleteInFlight}
                        variant="contained" 
                        sx={{ bgcolor: "#ef4444", borderRadius: "10px", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#dc2626" } }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>

            <FormSelectionDialog
                open={templatesDialogOpen}
                onClose={() => setTemplatesDialogOpen(false)}
                onSelect={handleTemplateSelection}
                variant="full"
                sheqTemplateCategory={category}
            />

            <TemplatePreviewDialog
                open={templatePreviewOpen}
                url={templatePreviewUrl}
                onClose={() => {
                    setTemplatePreviewOpen(false);
                    setTemplatePreviewUrl("");
                }}
            />

            {/* Action Menu */}
            <Menu 
                anchorEl={anchorEl} 
                open={Boolean(anchorEl)} 
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        mt: 1,
                        boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                        p: 1,
                        minWidth: 160,
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <MenuItem onClick={() => handleMenuAction("view")} sx={{ borderRadius: 1.5, mb: 0.5, py: 1, fontSize: "0.9rem" }}>
                    <ListItemIcon><Eye size={18} color={isDarkMode ? "#9CA3AF" : "#374151"} /></ListItemIcon>
                    <ListItemText primary="View" />
                </MenuItem>
                <MenuItem onClick={() => handleMenuAction("edit")} sx={{ borderRadius: 1.5, mb: 0.5, py: 1, fontSize: "0.9rem" }}>
                    <ListItemIcon><Pencil size={18} color={isDarkMode ? "#9CA3AF" : "#374151"} /></ListItemIcon>
                    <ListItemText primary="Edit" />
                </MenuItem>
                <MenuItem onClick={() => handleMenuAction("download")} sx={{ borderRadius: 1.5, mb: 0.5, py: 1, fontSize: "0.9rem" }}>
                    <ListItemIcon><Download size={18} color={isDarkMode ? "#9CA3AF" : "#374151"} /></ListItemIcon>
                    <ListItemText primary="Download" />
                </MenuItem>
                <MenuItem onClick={() => handleMenuAction("delete")} sx={{ borderRadius: 1.5, py: 1, fontSize: "0.9rem", color: "#ef4444" }}>
                    <ListItemIcon><Trash2 size={18} color="#ef4444" /></ListItemIcon>
                    <ListItemText primary="Delete" />
                </MenuItem>
            </Menu>

            {downloadTarget &&
                createPortal(
                    <>
                        <Box
                            sx={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 1500,
                                bgcolor: "rgba(255,255,255,0.95)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                            }}
                        >
                            <CircularProgress />
                            <Typography color="text.secondary">Generating PDF...</Typography>
                        </Box>
                        <Box
                            aria-hidden
                            sx={{
                                position: "fixed",
                                left: 0,
                                top: 0,
                                width: 1100,
                                zIndex: 1499,
                                pointerEvents: "none",
                                opacity: 0.01,
                                overflow: "visible",
                            }}
                        >
                            <SheqInstallationForm
                                submissionId={downloadTarget.id}
                                category={downloadTarget.category}
                                isModal
                                autoDownload
                                onClose={() => setDownloadTarget(null)}
                            />
                        </Box>
                    </>,
                    document.body
                )}
        </Layout>
    );
};

export default SheqInspectionSelectionPage;
