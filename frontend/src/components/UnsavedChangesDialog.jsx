import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
} from "@mui/material";
import { useTheme } from "../context/ThemeContext";

export default function UnsavedChangesDialog({
    open,
    onCancel,
    onDiscard,
    onSave,
    saving = false,
    title = "Save changes?",
    message = "You have unsaved changes. Do you want to save before leaving?",
}) {
    const { isDarkMode } = useTheme();

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onCancel}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827", pb: 1 }}>
                {title}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", lineHeight: 1.6 }}>
                    {message}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: "wrap", gap: 1, justifyContent: "flex-end" }}>
                <Button
                    onClick={onCancel}
                    disabled={saving}
                    sx={{ textTransform: "none", color: "text.secondary" }}
                >
                    Stay on page
                </Button>
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={onDiscard}
                    disabled={saving}
                    sx={{ textTransform: "none" }}
                >
                    Leave without saving
                </Button>
                <Button
                    variant="contained"
                    onClick={onSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{
                        textTransform: "none",
                        bgcolor: "#E89F17",
                        "&:hover": { bgcolor: "#cc8b14" },
                    }}
                >
                    {saving ? "Saving…" : "Save changes"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
