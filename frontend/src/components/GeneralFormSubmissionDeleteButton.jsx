import React, { useState } from "react";
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    CircularProgress,
} from "@mui/material";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";

/**
 * Delete a saved template submission from /general-forms/:id (not site pack fills).
 */
export default function GeneralFormSubmissionDeleteButton({
    responseId,
    canEdit = false,
    isSitePackContext = false,
    disabled = false,
}) {
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    if (!responseId || !canEdit || isSitePackContext) return null;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/forms/responses/${responseId}`);
            setOpen(false);
            navigate("/general-forms");
        } catch (err) {
            console.error("Failed to delete submission", err);
            alert(err?.response?.data?.message || "Failed to delete submission");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Button
                variant="outlined"
                color="error"
                onClick={(e) => {
                    e.currentTarget.blur();
                    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                    setOpen(true);
                }}
                disabled={disabled || deleting}
                startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <Trash2 size={18} />}
                sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    borderRadius: "8px",
                    borderColor: isDarkMode ? "#EF4444" : "#DC2626",
                    color: isDarkMode ? "#FCA5A5" : "#DC2626",
                    "&:hover": {
                        borderColor: "#B91C1C",
                        bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "rgba(220, 38, 38, 0.06)",
                    },
                }}
            >
                Delete
            </Button>

            <Dialog
                open={open}
                onClose={() => !deleting && setOpen(false)}
                disableRestoreFocus
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 1,
                        minWidth: 320,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 600 }}>Delete saved template?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        This will permanently remove this saved template from Manage Submissions. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setOpen(false)}
                        disabled={deleting}
                        sx={{ textTransform: "none", borderRadius: 50 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDelete}
                        disabled={deleting}
                        sx={{ textTransform: "none", borderRadius: 50, minWidth: 88 }}
                    >
                        {deleting ? "Deleting…" : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
