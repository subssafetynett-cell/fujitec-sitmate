import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
    Box, Typography, Button, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, TablePagination, IconButton, 
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
    Tooltip, Menu, MenuItem, ListItemIcon, ListItemText
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { 
    ClipboardList, Layout as LayoutIcon, Pencil, Trash2, 
    Download, Eye, Search, Plus
} from "lucide-react";
import Layout from "../components/Layout";
import PageContent from "../components/PageContent";
import { formatSubmitterDisplay, showSubmissionCreatorColumn } from "../utils/submitterDisplay";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import api, { fetchFormResponsesList } from "../services/api";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FormSelectionDialog from "../components/FormSelectionDialog";
import SheqInstallationForm from "./SheqInstallationForm";

const ShqInstallationSelectionPage = () => {
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
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [downloadTarget, setDownloadTarget] = useState(null);

    const customBlue = "#0284c7";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const subTextColor = isDarkMode ? "#94a3b8" : "#64748b";
    const borderColor = isDarkMode ? "#334155" : "#E2E8F0";

    const category = "SHEQ Installation";

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

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/forms/responses/${deleteId}`);
            setSubmissions(prev => prev.filter(s => (s.id || s._id) !== deleteId));
            setDeleteId(null);
        } catch (err) {
            console.error("Delete failed", err);
            alert("Failed to delete report.");
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

    const handleSelectForm = (item) => {
        const base = `/sheq-install-form?category=${encodeURIComponent(category)}`;
        if (item?.type === "sheq-template" && item.id) {
            navigate(`${base}&fromTemplate=${encodeURIComponent(item.id)}`);
        } else {
            navigate(base);
        }
        setFormDialogOpen(false);
    };

    return (
        <Layout disablePadding={true}>
            <PageContent>
                {/* Header Section */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: textColor, letterSpacing: "-0.01em" }}>
                            SHEQ Installation
                        </Typography>
                        <Typography variant="body1" sx={{ color: subTextColor }}>
                            Manage and track your SHEQ installation reports.
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<Plus size={20} />}
                            onClick={() => navigate(`/sheq-install-form?category=${encodeURIComponent(category)}`)}
                            sx={{
                                bgcolor: "#E89F17",
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: 600,
                                px: 2.5,
                                py: 1,
                                boxShadow: "none",
                                "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" }
                            }}
                        >
                             SHEQ FORM
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<LayoutIcon size={20} />}
                            onClick={() => setFormDialogOpen(true)}
                            sx={{
                                color: "#E89F17",
                                borderColor: "#E89F17",
                                borderRadius: "12px",
                                textTransform: "none",
                                fontWeight: 600,
                                px: 2.5,
                                py: 1,
                                "&:hover": { borderColor: "#cc8b14", bgcolor: "rgba(232, 159, 23, 0.05)" }
                            }}
                        >
                            CHOOSE FROM
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
                            <Typography variant="body2" sx={{ color: subTextColor }}>Start by creating a new installation report above.</Typography>
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
                                            <TableCell sx={{ fontWeight: 600, color: subTextColor, fontSize: "0.75rem" }}>Site address</TableCell>
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
                                            const site = answers.formData?.siteAddress || "N/A";
                                            const date = new Date(sub.createdAt).toLocaleDateString('en-GB');

                                            return (
                                                <TableRow key={subId} hover sx={{ "&:last-child td": { border: 0 } }}>
                                            <TableCell sx={{ color: textColor, fontWeight: 500 }}>{page * rowsPerPage + index + 1}</TableCell>
                                            <TableCell sx={{ color: textColor, fontWeight: 500 }}>{date}</TableCell>
                                            <TableCell>
                                                <Typography sx={{ color: textColor, fontWeight: 600, fontSize: "0.95rem" }}>{client}</Typography>
                                                <Typography variant="caption" sx={{ color: subTextColor }}>
                                                    {category === "SHEQ Installation" ? "SHEQ Installation" : (sub.form?.title || "Standard Form")}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ color: subTextColor }}>{site}</TableCell>
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
                        variant="contained" 
                        sx={{ bgcolor: "#ef4444", borderRadius: "10px", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#dc2626" } }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <FormSelectionDialog 
                open={formDialogOpen} 
                onClose={() => setFormDialogOpen(false)} 
                onSelect={handleSelectForm}
                sheqTemplateCategory={category}
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

export default ShqInstallationSelectionPage;
