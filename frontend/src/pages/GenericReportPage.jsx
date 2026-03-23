import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    TextField
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import { Eye, Pencil, Download, Mail, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import FormSelectionDialog from "../components/FormSelectionDialog";
import FormRenderer from "../components/FormRenderer";
import api from "../services/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// helper to build absolute URL for logos
const computeLogoUrl = (logo) => {
    if (!logo) return null;
    if (/^https?:\/\//i.test(logo)) return logo;
    const host = import.meta.env.VITE_BACKEND_URL || "https://api.site-mateai.co.uk";
    return `${host.replace(/\/$/, "")}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

const getSubheading = (title) => {
    switch (title) {
        case "Health & Safety concern":
            return "Submit and track health & safety observations and issues.";
        case "Sustainability concern":
            return "Report and monitor environmental and sustainability matters.";
        case "Quality concern":
            return "Document and manage quality control observations and defects.";
        case "Positive observation":
            return "Highlight and share positive safety practices and behaviors.";
        case "Concern and positive feedback report":
            return "Overview of all logged concerns and positive feedback across sites.";
        case "Weekly supervisor health & safety inspection":
            return "Conduct and review weekly site safety inspections.";
        case "Weekly supervisor reports":
            return "View and manage weekly submitted supervisor reports.";
        case "SHEQ Inspection service report":
            return "Manage SHEQ service inspections, audits, and their findings.";
        case "SHEQ Inspection installation":
            return "Record and analyze SHEQ installation observations.";
        case "SHEQ Inspection installation report":
            return "View detailed SHEQ installation reports and audits.";
        case "Client level analysis":
            return "Analyze performance and safety metrics across the entire client portfolio.";
        case "Site level analysis":
            return "Analyze performance and safety metrics for specific operational sites.";
        case "Friday pack forms":
            return "Manage and review Friday pack form submissions.";
        default:
            return `Manage and track ${title ? title.toLowerCase() : "reports"}.`;
    }
};

export default function GenericReportPage({ pageTitle }) {
    const { isDarkMode } = useTheme();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchParams] = useSearchParams();
    const search = searchParams.get("search") || "";
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    const [selectedForm, setSelectedForm] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [logoUrl, setLogoUrl] = useState(null);

    useEffect(() => {
        try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                let rawLogo = null;
                // Check if clientId is an object (populated) or just ID
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
    }, []);

    // Modes: 
    // - initial: List view
    // - filling: New submission
    // - editing: Editing existing submission
    // - viewed: Read-only view
    const [viewMode, setViewMode] = useState("initial");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Submissions list state
    const [submissions, setSubmissions] = useState([]);


    // Success Dialog state
    const [successOpen, setSuccessOpen] = useState(false);
    const [lastResponse, setLastResponse] = useState(null);

    // Delete Dialog
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Menu State
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuItem, setMenuItem] = useState(null);

    // Edit State
    const [editingId, setEditingId] = useState(null);

    // PDF Ref
    const printRef = useRef();

    // Email State
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailingItem, setEmailingItem] = useState(null);


    const fetchSubmissions = useCallback(async () => {
        try {
            const res = await api.get("/forms/responses", {
                params: { category: pageTitle }
            });
            if (res.data?.success) {
                setSubmissions(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch submissions", err);
        }
    }, [pageTitle]);

    // Reset state when title changes (e.g. navigating between sidebar items)
    useEffect(() => {
        setViewMode("initial");
        setSelectedForm(null);
        setFormValues({});
        fetchSubmissions();
    }, [pageTitle, fetchSubmissions]);

    const handleSelectForm = (form) => {
        setSelectedForm(form);
        setFormValues({});
        setEditingId(null);
        setViewMode("filling");
        setDialogOpen(false);
    };

    const handleFormChange = (fieldId, value) => {
        setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const handleSubmit = async () => {
        if (!selectedForm) return;

        setIsSubmitting(true);
        try {
            // Process answers to handle files
            const processedAnswers = {};
            for (const [key, value] of Object.entries(formValues)) {
                if (value instanceof File) {
                    processedAnswers[key] = await toBase64(value);
                } else if (!key.endsWith("_preview")) {
                    processedAnswers[key] = value;
                }
            }

            let res;
            if (viewMode === "editing" && editingId) {
                // Update existing
                res = await api.put(`/forms/responses/${editingId}`, {
                    answers: processedAnswers
                });
            } else {
                // Create new
                // Check for id or _id to support both during migration, but prefer id
                const formId = selectedForm.id || selectedForm._id;
                res = await api.post(`/forms/${formId}/responses`, {
                    formId: formId,
                    answers: processedAnswers,
                    category: pageTitle
                });
            }

            if (res.data?.success) {
                const newSub = res.data.data;
                const displaySub = viewMode === "editing" ? { ...newSub, formId: selectedForm } : { ...newSub, formId: selectedForm, answers: formValues };

                setLastResponse({
                    ...displaySub,
                    answers: formValues // Ensure we have latest values
                });

                setSuccessOpen(true);
                fetchSubmissions();
            }
        } catch (err) {
            console.error("Submission failed", err);
            alert("Failed to save form. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuccessClose = () => {
        setSuccessOpen(false);
        if (lastResponse) {
            setEditingId(null);
            setSelectedForm(lastResponse.formId);
            setFormValues(lastResponse.answers);
            setViewMode("viewed");
            setLastResponse(null);
        } else {
            setViewMode("initial");
        }
    };

    const handleMenuClick = (event, item) => {
        setAnchorEl(event.currentTarget);
        setMenuItem(item);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setMenuItem(null);
    };

    const handleAction = (action) => {
        if (!menuItem) return;
        const item = menuItem;
        handleMenuClose();

        switch (action) {
            case "view":
                openSubmissionView(item, "viewed");
                break;
            case "edit":
                openSubmissionView(item, "editing");
                break;
            case "delete":
                setItemToDelete(item);
                setDeleteConfirmOpen(true);
                break;
            case "download":
                // Open and then download
                openSubmissionView(item, "viewed");
                setTimeout(() => {
                    alert("Please click the 'Download PDF' button in the viewer.");
                }, 500);
                break;
            case "email":
                setEmailingItem(item);
                setEmailDialogOpen(true);
                break;
            default:
                break;
        }
    };

    const openSubmissionView = async (sub, mode) => {
        try {
            // Prisma response has `formId` as string and `form` as object
            // Mongoose might have `formId` populated
            const formId = sub.form?.id || sub.formId?._id || sub.formId;

            if (!formId) {
                console.error("No form ID found in submission", sub);
                return;
            }

            const formRes = await api.get(`/forms/${formId}`);
            if (formRes.data?.success) {
                setSelectedForm(formRes.data.data);
                setFormValues(sub.answers || {});
                setEditingId(sub.id || sub._id);
                setViewMode(mode);
            }
        } catch (e) {
            console.error("Could not load form definition", e);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        try {
            const itemId = itemToDelete.id || itemToDelete._id;
            await api.delete(`/forms/responses/${itemId}`);
            fetchSubmissions();
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
        } catch (e) {
            console.error(e);
            alert("Failed to delete");
        }
    };

    const handleDownloadPdf = async () => {
        if (printRef.current) {
            try {
                // Use CORS to ensure external images (like logo) are captured
                const canvas = await html2canvas(printRef.current, {
                    useCORS: true,
                    scale: 2, // Improve quality
                    allowTaint: true,
                    logging: true,
                    // If your logo is on a different domain, make sure backend sends CORS headers for image
                    // or handle proxy. But standard CORS usually works with useCORS: true
                });
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF("p", "mm", "a4");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
                pdf.save(`report-${selectedForm?.title || "download"}.pdf`);
            } catch (err) {
                console.error("PDF generation failed", err);
                alert("Could not generate PDF. Please try again.");
            }
        }
    };

    const handleEmailSend = async () => {
        if (!recipientEmail || !emailingItem) return;
        try {
            const itemId = emailingItem.id || emailingItem._id;
            const res = await api.post(`/forms/responses/${itemId}/email`, { email: recipientEmail });
            if (res.data?.success) {
                alert("Email sent successfully!");
                setEmailDialogOpen(false);
                setRecipientEmail("");
                setEmailingItem(null);
            }
        } catch (e) {
            console.error(e);
            const msg = e.response?.data?.error || e.response?.data?.message || "Failed to send email";
            alert(`Error: ${msg}`);
        }
    };

    return (
        <Layout pageTitle={pageTitle}>
            <Box sx={{ flex: 1, px: 4, py: 4, height: "100%", overflowY: "auto" }}>
                <Box sx={{ maxWidth: 1000, mx: "auto" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4, alignItems: "center" }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", }}>
                                All Reports - {pageTitle}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", mt: 0.5 }}>
                                {getSubheading(pageTitle)}
                            </Typography>
                        </Box>
                        {(viewMode !== "initial") && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {viewMode === "viewed" && (
                                    <Button 
                                        startIcon={<Download size={18} />} 
                                        variant="contained" 
                                        onClick={handleDownloadPdf}
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 4,
                                            px: 3,
                                            py: 0.8,
                                            fontWeight: 600,
                                            bgcolor: "#EAB308",
                                            color: "#FFFFFF",
                                            boxShadow: "none",
                                            "&:hover": { bgcolor: "#CA8A04", boxShadow: "none" }
                                        }}
                                    >
                                        Download PDF
                                    </Button>
                                )}
                                <Button 
                                    variant="outlined" 
                                    onClick={() => setViewMode("initial")}
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: 4,
                                        px: 3,
                                        py: 0.8,
                                        fontWeight: 600,
                                        color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                        borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                                        "&:hover": { 
                                            bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "#F3F4F6", 
                                            borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" 
                                        }
                                    }}
                                >
                                    Back to List
                                </Button>
                            </Box>
                        )}
                        {viewMode === "initial" && (
                            <Box sx={{ display: "flex", gap: 2 }}>
                                <Button 
                                    variant="contained" 
                                    onClick={() => setDialogOpen(true)}
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: 4,
                                        px: 4,
                                        py: 1,
                                        bgcolor: "hsl(38, 70%, 55%)",
                                        color: "white",
                                        fontWeight: 600,
                                        boxShadow: "none",
                                        "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" }
                                    }}
                                >
                                    Choose Form
                                </Button>
                            </Box>
                        )}
                    </Box>

                    {viewMode === "initial" && (
                        <Paper sx={{ width: '100%', mb: 2, borderRadius: 3, boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)", border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }}>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Sl No</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Form Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Date</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Status</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(() => {
                                            const filtered = submissions.filter((row) => {
                                                const title = row.form?.title || row.formId?.title || "Untitled";
                                                return title.toLowerCase().includes(search.toLowerCase());
                                            });
                                            const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
                                            
                                            if (filtered.length === 0) {
                                                return <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: isDarkMode ? "#9CA3AF" : "inherit", borderBottom: "none" }}>No submissions found.</TableCell></TableRow>;
                                            }

                                            return paginated.map((row, idx) => {
                                                const slNo = page * rowsPerPage + idx + 1;
                                                return (
                                                <TableRow key={row.id || row._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{slNo}</TableCell>
                                                    <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{row.form?.title || row.formId?.title || "Untitled"}</TableCell>
                                                    <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell sx={{ borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}><Chip label="Submitted" color="success" size="small" sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', fontWeight: 500, border: 'none' }} /></TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>
                                                        <IconButton onClick={(e) => handleMenuClick(e, row)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            });
                                        })()}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 1 }}>
                                <TablePagination
                                    component="div"
                                    count={submissions.filter((row) => (row.form?.title || row.formId?.title || "Untitled").toLowerCase().includes(search.toLowerCase())).length}
                                    page={page}
                                    onPageChange={handleChangePage}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    rowsPerPageOptions={[5, 10, 25]}
                                    sx={{
                                        border: 'none',
                                        color: isDarkMode ? "#F9FAFB" : "inherit",
                                        '& .MuiTablePagination-actions': { color: isDarkMode ? "#F9FAFB" : "inherit" },
                                        '& .MuiTablePagination-select': { color: isDarkMode ? "#F9FAFB" : "inherit" },
                                        '& .MuiTablePagination-selectIcon': { color: isDarkMode ? "#9CA3AF" : "inherit" },
                                    }}
                                />
                            </Box>
                        </Paper>
                    )}

                    {(viewMode === "filling" || viewMode === "editing") && selectedForm && (
                        <Paper sx={{ p: 4, borderRadius: 3, boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)", border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }}>
                            <Typography variant="h6" gutterBottom sx={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>{viewMode === "editing" ? "Edit Report" : "New Report"}</Typography>
                            <FormRenderer
                                form={selectedForm}
                                values={formValues}
                                onChange={handleFormChange}
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                                logoUrl={logoUrl}
                            />
                        </Paper>
                    )}

                    {viewMode === "viewed" && selectedForm && (
                        <Box sx={{ width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', py: 4 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    width: '210mm',
                                    minHeight: '297mm',
                                    p: '20mm',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxSizing: 'border-box',
                                    borderRadius: 4,
                                    border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                                    boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                                }}
                                ref={printRef}
                            >
                                {/* Form Content - Grows to push footer down */}
                                <Box sx={{ flex: 1 }}>
                                    <FormRenderer
                                        form={selectedForm}
                                        values={formValues}
                                        readOnly={true}
                                        hideTitle={true} // Clean view
                                    />
                                </Box>

                                {/* Footer: Black Line + Logo Bottom Right */}
                                <Box sx={{ mt: 4, pt: 2, borderTop: "2px solid black", display: "flex", justifyContent: "flex-end" }}>
                                    <Box
                                        component="img"
                                        src={logoUrl || "/logo.png"}
                                        alt="Company Logo"
                                        sx={{
                                            height: 40,
                                            width: "auto"
                                        }}
                                    />
                                </Box>
                            </Paper>
                        </Box>
                    )}
                </Box>
            </Box>

            <FormSelectionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSelect={handleSelectForm} />

            {/* Success Dialog */}
            <Dialog open={successOpen} maxWidth="xs" fullWidth>
                <DialogTitle>Success 🎉</DialogTitle>
                <DialogContent><Typography>Operation completed successfully.</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={handleSuccessClose} variant="contained">View Report</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Delete Report?</DialogTitle>
                <DialogContent>Are you sure you want to delete this report? This action cannot be undone.</DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Email Dialog */}
            <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
                <DialogTitle>Send Report by Email</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Recipient Email"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleEmailSend} variant="contained">Send</Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu 
                anchorEl={anchorEl} 
                open={Boolean(anchorEl)} 
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        borderRadius: 5,
                        mt: 1,
                        boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                        p: 1,
                        minWidth: 180,
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <MenuItem onClick={() => handleAction("view")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <Eye size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> View
                </MenuItem>
                <MenuItem onClick={() => handleAction("edit")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <Pencil size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => handleAction("delete")} sx={{ borderRadius: 2, py: 1, fontSize: "0.95rem", color: "#EF4444", "&:hover": { bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)" } }}>
                    <Trash2 size={18} style={{ marginRight: 12, color: "#EF4444" }} /> Delete
                </MenuItem>
            </Menu>
        </Layout>
    );
}
