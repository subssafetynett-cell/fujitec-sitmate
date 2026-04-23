import React, { useState, useEffect } from "react";
import { 
    Box, Typography, Grid, Card, CardContent, CardActionArea, 
    Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, 
    Button, CircularProgress, IconButton, TextField, InputAdornment, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { FileText, Search, Edit3, Trash2, ExternalLink } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

const TEMPLATES = [
    {
        id: "tool-box-talk",
        title: "Tool Box Talk Register",
        description: "Record all tool box talk topics and attendees",
        path: "/general-forms/tool-box-talk",
    },
    {
        id: "rams-briefing",
        title: "RAMS Briefing Form",
        description: "Risk Assessment & Method Statement Briefing",
        path: "/general-forms/rams-briefing",
    },
    {
        id: "site-induction",
        title: "Site Induction Register",
        description: "Sign-off register for site inductions",
        path: "/general-forms/site-induction",
    },
    {
        id: "management-site-inspection",
        title: "Management Site Inspection Report",
        description: "Comprehensive site H&S walkthrough",
        path: "/general-forms/management-site-inspection",
    },
    {
        id: "daily-safe-start-briefing",
        title: "Daily Safe Start Briefing Sheet",
        description: "Start Right Daily Safety Briefing",
        path: "/general-forms/daily-safe-start-briefing",
    },
    {
        id: "audit-action-form",
        title: "Audit Action Form",
        description: "Review and report observations & assigned actions",
        path: "/general-forms/audit-action-form",
    },
    {
        id: "site-induction-form",
        title: "Site Induction Form",
        description: "Personal and comprehensive 3-page site induction record",
        path: "/general-forms/site-induction-form",
    },
    {
        id: "loler-inspection-form",
        title: "LOLER Inspection Form",
        description: "Official Equipment inspection and certification",
        path: "/general-forms/loler-inspection-form",
    },
    {
        id: "puwer-inspection-form",
        title: "PUWER Inspection Form",
        description: "Plant equipment formal maintenance certification",
        path: "/general-forms/puwer-inspection-form",
    },
    {
        id: "adstone-site-induction",
        title: "Adstone Site Induction Form",
        description: "Site Documentation and Induction Briefing Form",
        path: "/general-forms/adstone-site-induction",
    }
];

export default function GeneralFormsList() {
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const search = searchParams.get("search") || "";

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subSearch, setSubSearch] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trashId, setTrashId] = useState(null);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                setSubmissions(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch submissions", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfirm = (id) => {
        setTrashId(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!trashId) return;
        try {
            await api.delete(`/forms/responses/${trashId}`);
            setSubmissions(submissions.filter(s => s.id !== trashId && s._id !== trashId));
            setDeleteDialogOpen(false);
            setTrashId(null);
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Failed to delete submission");
        }
    };

    const getEditPath = (submission) => {
        const title = submission.form?.title;
        const template = TEMPLATES.find(t => t.title === title);
        if (template) {
            return `${template.path}/${submission.id || submission._id}`;
        }
        // Fallback to generic form viewer if it's a dynamic form
        return `/forms/${submission.formId}/use?action=edit&responseId=${submission.id || submission._id}`;
    };

    const filteredTemplates = TEMPLATES.filter((form) =>
        (form.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (form.description || "").toLowerCase().includes(search.toLowerCase())
    );

    const filteredSubmissions = submissions.filter(s => 
        (s.form?.title || "").toLowerCase().includes(subSearch.toLowerCase()) ||
        (new Date(s.createdAt).toLocaleDateString()).includes(subSearch)
    );

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827", mb: 1 }}>
                        General Forms
                    </Typography>
                    <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                        View and manage your submitted general forms.
                    </Typography>
                </Box>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", mb: 2 }}>
                Available Templates
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 6 }}>
                {filteredTemplates.map((form) => (
                    <Card
                        key={form.id}
                        sx={{
                            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                            borderRadius: 4,
                            height: 160,
                            display: 'flex',
                            flexDirection: 'column',
                            transition: "all 0.2s",
                            "&:hover": { borderColor: "#E89F17", transform: "translateY(-4px)" }
                        }}
                        elevation={0}
                    >
                        <CardActionArea
                            onClick={() => navigate(form.path)}
                            sx={{ height: "100%", p: 2 }}
                        >
                            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", p: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                    <Box
                                        sx={{
                                            p: 1.5,
                                            bgcolor: "rgba(232, 159, 23, 0.1)",
                                            borderRadius: 2,
                                            color: "#E89F17",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            mr: 2
                                        }}
                                    >
                                        <FileText size={18} />
                                    </Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#111827", lineHeight: 1.2 }}>
                                        {form.title}
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", flexGrow: 1 }}>
                                    {form.description}
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                ))}
            </Box>
            <Box sx={{ mt: 8, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        Manage Submissions
                    </Typography>
                    <TextField
                        size="small"
                        placeholder="Search submissions..."
                        value={subSearch}
                        onChange={(e) => setSubSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search size={16} />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 2, bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }
                        }}
                    />
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={30} sx={{ color: "#E89F17" }} />
                    </Box>
                ) : filteredSubmissions.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB", borderRadius: 4, border: `1px dashed ${isDarkMode ? "#374151" : "#E5E7EB"}` }}>
                        <Typography color="text.secondary">No submissions found.</Typography>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`, bgcolor: "transparent", overflow: "hidden" }}>
                        <Table>
                            <TableHead sx={{ bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB" }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>Form Title</TableCell>
                                    <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>Submitted Date</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSubmissions.map((sub) => (
                                    <TableRow key={sub.id || sub._id} sx={{ "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" } }}>
                                        <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Box sx={{ p: 1, bgcolor: "rgba(232, 159, 23, 0.1)", borderRadius: 1.5, color: "#E89F17", display: 'flex' }}>
                                                    <FileText size={16} />
                                                </Box>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                                        {sub.name || sub.answers?.name || sub.form?.title || "Untitled Form"}
                                                    </Typography>
                                                    {sub.form?.title && (sub.name || sub.answers?.name) && (
                                                        <Typography variant="caption" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", display: 'block' }}>
                                                            {sub.form.title}
                                                        </Typography>
                                                    )}
                                                    {((sub.tags && sub.tags.length > 0) || (sub.answers?.tags && sub.answers.tags.length > 0)) && (
                                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.8 }}>
                                                            {(typeof (sub.tags || sub.answers?.tags) === 'string' 
                                                                ? (sub.tags || sub.answers?.tags).split(',').map(t => t.trim()) 
                                                                : (sub.tags || sub.answers?.tags)
                                                            ).filter(Boolean).map((tag, i) => (
                                                                <Chip 
                                                                    key={i} 
                                                                    label={tag} 
                                                                    size="small" 
                                                                    variant="filled"
                                                                    sx={{ 
                                                                        fontSize: '0.65rem', 
                                                                        height: 20,
                                                                        bgcolor: isDarkMode ? "rgba(232, 159, 23, 0.2)" : "rgba(232, 159, 23, 0.15)",
                                                                        color: "#E89F17",
                                                                        fontWeight: 600,
                                                                        borderRadius: 1
                                                                    }} 
                                                                />
                                                            ))}
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                                            {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                <Button
                                                    size="small"
                                                    startIcon={<Edit3 size={16} />}
                                                    onClick={() => navigate(getEditPath(sub))}
                                                    sx={{ 
                                                        color: "#E89F17", 
                                                        textTransform: 'none',
                                                        "&:hover": { bgcolor: "rgba(232, 159, 23, 0.1)" }
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => handleDeleteConfirm(sub.id || sub._id)}
                                                    sx={{ color: isDarkMode ? "#EF4444" : "#DC2626" }}
                                                >
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        padding: 2,
                        minWidth: 320,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: '1.25rem' }}>
                    Delete Submission?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        Are you sure you want to delete this submission? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ borderTop: isDarkMode ? "1px solid #374151" : "none", pt: 2 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        variant="outlined"
                        sx={{
                            textTransform: 'none',
                            color: isDarkMode ? "#9CA3AF" : 'text.primary',
                            borderColor: isDarkMode ? "#374151" : 'divider',
                            borderRadius: 50,
                            px: 3
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        disableElevation
                        onClick={handleDelete}
                        sx={{
                            textTransform: 'none',
                            borderRadius: 50,
                            px: 3,
                            bgcolor: "#EF4444"
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Layout>
    );
}
