import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItemButton,
    ListItemText,
    Typography,
    CircularProgress,
    TextField,
    Box,
    Divider,
} from "@mui/material";
import api from "../services/api";

function isStandardSheqSubmission(sub) {
    const ans = sub?.answers;
    return Boolean(ans?.formData !== undefined || ans?.formSections?.length);
}

function getSubmissionLabel(sub) {
    const ans = sub?.answers || {};
    const client = ans.formData?.client?.trim();
    const name = ans.name?.trim();
    if (client) return client;
    if (name) return name;
    return "Untitled report";
}

export default function FormSelectionDialog({
    open,
    onClose,
    onSelect,
    /** When set, lists saved reports for this category instead of form-builder definitions. */
    sheqTemplateCategory = null,
}) {
    const [forms, setForms] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const sheqMode = Boolean(sheqTemplateCategory);

    useEffect(() => {
        if (!open) {
            setSearch("");
            return;
        }
        if (sheqMode) {
            loadSheqTemplates();
        } else {
            loadForms();
        }
    }, [open, sheqMode, sheqTemplateCategory]);

    const loadForms = async () => {
        setLoading(true);
        try {
            const res = await api.get("/forms");
            if (res.data?.success) {
                const userCreatedForms = (res.data.data || []).filter(
                    (f) => !(f.fields?.length === 1 && f.fields[0].id === "custom_hardcoded_form_data")
                );
                setForms(userCreatedForms);
            }
        } catch (err) {
            console.error("Failed to load forms", err);
        } finally {
            setLoading(false);
        }
    };

    const loadSheqTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get("/forms/responses", {
                params: { category: sheqTemplateCategory, compact: true },
            });
            if (res.data?.success) {
                const standard = (res.data.data || []).filter(isStandardSheqSubmission);
                standard.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setSubmissions(standard);
            }
        } catch (err) {
            console.error("Failed to load SHEQ templates", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredForms = forms.filter((f) =>
        (f.title || "").toLowerCase().includes(search.toLowerCase())
    );

    const filteredSubmissions = submissions.filter((sub) => {
        const label = getSubmissionLabel(sub).toLowerCase();
        const site = (sub.answers?.formData?.siteAddress || "").toLowerCase();
        const q = search.toLowerCase();
        return label.includes(q) || site.includes(q);
    });

    const dialogTitle = sheqMode ? "Choose a report to copy" : "Choose a Form";
    const searchPlaceholder = sheqMode ? "Search saved reports..." : "Search forms...";

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 600 }}>{dialogTitle}</DialogTitle>
            <DialogContent dividers>
                <TextField
                    fullWidth
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ mb: 2 }}
                    size="small"
                />

                {sheqMode && (
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                        Start from a saved SHEQ service report or use the default checklist layout.
                    </Typography>
                )}

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : sheqMode ? (
                    <List disablePadding>
                        <ListItemButton
                            onClick={() =>
                                onSelect({ type: "sheq-blank", title: "Default SHEQ service checklist" })
                            }
                        >
                            <ListItemText
                                primary="Default SHEQ service checklist"
                                secondary="Standard vehicle / site audit layout"
                            />
                        </ListItemButton>
                        {filteredSubmissions.length > 0 && <Divider sx={{ my: 1 }} />}
                        {filteredSubmissions.map((sub) => {
                            const subId = sub.id || sub._id;
                            const date = new Date(sub.createdAt).toLocaleDateString("en-GB");
                            const site = sub.answers?.formData?.siteAddress;
                            return (
                                <ListItemButton
                                    key={subId}
                                    onClick={() =>
                                        onSelect({
                                            type: "sheq-template",
                                            id: subId,
                                            title: getSubmissionLabel(sub),
                                        })
                                    }
                                >
                                    <ListItemText
                                        primary={getSubmissionLabel(sub)}
                                        secondary={
                                            site
                                                ? `${date} · ${site}`
                                                : `${date} · Saved report`
                                        }
                                    />
                                </ListItemButton>
                            );
                        })}
                        {filteredSubmissions.length === 0 && search && (
                            <Typography sx={{ textAlign: "center", py: 3, color: "text.secondary" }}>
                                No matching reports.
                            </Typography>
                        )}
                    </List>
                ) : filteredForms.length > 0 ? (
                    <List>
                        {filteredForms.map((form) => (
                            <ListItemButton key={form.id || form._id} onClick={() => onSelect(form)}>
                                <ListItemText
                                    primary={form.title}
                                    secondary={`${form.fields?.length || 0} fields`}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                ) : (
                    <Typography sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                        No forms found.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
