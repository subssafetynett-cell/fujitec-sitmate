import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Paper,
    IconButton,
    InputAdornment,
    Divider,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
} from "@mui/material";
import { Save, FilePlus, X, Tag, Edit3, Globe, Lock } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
    GENERAL_FORM_VISIBILITY,
    normalizeGeneralFormVisibility,
} from "../utils/generalFormVisibility";

export default function SaveChoiceDialog({
    open,
    onClose,
    onSave,
    existingId,
    defaultName = "",
    defaultTags = "",
    defaultVisibility = GENERAL_FORM_VISIBILITY.PRIVATE,
    saving = false,
    /** General forms: clearer copy and empty name for brand-new templates. */
    templateFlow = false,
    /** Ask public vs private when saving from General Forms (not site pack). */
    showVisibilityChoice = false,
    dialogTitle,
    nameFieldLabel = "Form Name",
}) {
    const { isDarkMode } = useTheme();
    const [name, setName] = useState(defaultName);
    const [tags, setTags] = useState(defaultTags);
    const [visibility, setVisibility] = useState(
        normalizeGeneralFormVisibility(defaultVisibility)
    );

    useEffect(() => {
        if (!open) return;
        if (templateFlow && !existingId) {
            setName((defaultName || "").trim());
        } else {
            setName(defaultName || `Submission - ${new Date().toLocaleDateString()}`);
        }
        setTags(defaultTags);
        setVisibility(normalizeGeneralFormVisibility(defaultVisibility));
    }, [open, defaultName, defaultTags, defaultVisibility, templateFlow, existingId]);

    const handleAction = (asNew) => {
        if (!name.trim()) {
            alert("Please provide a name for this record.");
            return;
        }
        if (showVisibilityChoice) {
            onSave(asNew, name, tags, visibility);
        } else {
            onSave(asNew, name, tags);
        }
    };

    const visibilityCardSx = (selected) => ({
        p: 2,
        borderRadius: 3,
        cursor: "pointer",
        transition: "all 0.2s",
        border: selected ? "2px solid #E89F17" : `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`,
        bgcolor: selected
            ? "rgba(232, 159, 23, 0.08)"
            : isDarkMode
              ? "rgba(255,255,255,0.02)"
              : "rgba(0,0,0,0.01)",
        "&:hover": {
            borderColor: "#E89F17",
            bgcolor: "rgba(232, 159, 23, 0.05)",
        },
    });

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    p: 1,
                },
            }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                    {dialogTitle || (templateFlow ? "Save general form template" : "Save submission")}
                </Typography>
                <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                            Identification Details
                        </Typography>
                        <TextField
                            fullWidth
                            label={nameFieldLabel}
                            placeholder={templateFlow ? "e.g. Toolbox talk template – Q2 2026" : "e.g. Tool Box Talk - Phase 1"}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            size="medium"
                            onFocus={(e) => e.target.select()}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Edit3 size={18} color="#E89F17" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 3 },
                            }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Tags"
                            placeholder="Comma separated tags..."
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Tag size={16} color="#E89F17" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 2 },
                            }}
                        />
                    </Box>

                    {showVisibilityChoice ? (
                        <>
                            <Divider />
                            <Box>
                                <Typography
                                    variant="body2"
                                    sx={{ mb: 1.5, fontWeight: 600, color: isDarkMode ? "#E5E7EB" : "#374151" }}
                                >
                                    Who can see this saved form?
                                </Typography>
                                <FormControl component="fieldset" fullWidth>
                                    <RadioGroup
                                        value={visibility}
                                        onChange={(e) => setVisibility(e.target.value)}
                                    >
                                        <Paper
                                            variant="outlined"
                                            sx={visibilityCardSx(
                                                visibility === GENERAL_FORM_VISIBILITY.PUBLIC
                                            )}
                                            onClick={() =>
                                                setVisibility(GENERAL_FORM_VISIBILITY.PUBLIC)
                                            }
                                        >
                                            <FormControlLabel
                                                value={GENERAL_FORM_VISIBILITY.PUBLIC}
                                                control={<Radio sx={{ color: "#E89F17", "&.Mui-checked": { color: "#E89F17" } }} />}
                                                label={
                                                    <Box sx={{ py: 0.5 }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                            <Globe size={18} color="#E89F17" />
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                                Public
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Visible to everyone in your company. They can open and use this
                                                            saved form as a template.
                                                        </Typography>
                                                    </Box>
                                                }
                                                sx={{ alignItems: "flex-start", m: 0, width: "100%" }}
                                            />
                                        </Paper>
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                ...visibilityCardSx(
                                                    visibility === GENERAL_FORM_VISIBILITY.PRIVATE
                                                ),
                                                mt: 1.5,
                                            }}
                                            onClick={() =>
                                                setVisibility(GENERAL_FORM_VISIBILITY.PRIVATE)
                                            }
                                        >
                                            <FormControlLabel
                                                value={GENERAL_FORM_VISIBILITY.PRIVATE}
                                                control={<Radio sx={{ color: "#E89F17", "&.Mui-checked": { color: "#E89F17" } }} />}
                                                label={
                                                    <Box sx={{ py: 0.5 }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                            <Lock size={18} color="#E89F17" />
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                                Private
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Visible only to you. Other users in your company will not see
                                                            this saved form.
                                                        </Typography>
                                                    </Box>
                                                }
                                                sx={{ alignItems: "flex-start", m: 0, width: "100%" }}
                                            />
                                        </Paper>
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                        </>
                    ) : null}

                    <Divider />

                    <Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                            {templateFlow && !existingId
                                ? "Enter a name, then save. This name is stored with the template."
                                : "Select how you want to save your progress"}
                        </Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: existingId ? "1fr 1fr" : "1fr", gap: 2 }}>
                            {existingId && (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 3,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                                        "&:hover": {
                                            borderColor: "#E89F17",
                                            bgcolor: "rgba(232, 159, 23, 0.05)",
                                            transform: "translateY(-2px)",
                                        },
                                    }}
                                    onClick={() => handleAction(false)}
                                >
                                    <Box sx={{ p: 1, bgcolor: "rgba(232, 159, 23, 0.1)", borderRadius: 2, color: "#E89F17", width: "fit-content", mb: 1.5 }}>
                                        <Save size={20} />
                                    </Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                        Overwrite Existing
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Update current record history
                                    </Typography>
                                </Paper>
                            )}

                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    borderRadius: 3,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    border: "1px solid #E89F17",
                                    bgcolor: "rgba(232, 159, 23, 0.08)",
                                    "&:hover": {
                                        bgcolor: "rgba(232, 159, 23, 0.12)",
                                        transform: "translateY(-2px)",
                                    },
                                }}
                                onClick={() => handleAction(true)}
                            >
                                <Box sx={{ p: 1, bgcolor: "#E89F17", borderRadius: 2, color: "#FFFFFF", width: "fit-content", mb: 1.5 }}>
                                    <FilePlus size={20} />
                                </Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    Save as New
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Create separate independent copy
                                </Typography>
                            </Paper>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Button variant="text" onClick={onClose} sx={{ color: "text.secondary", textTransform: "none" }}>
                    Discard Changes
                </Button>
                {!existingId && (
                    <Button
                        variant="contained"
                        disabled={saving}
                        onClick={() => handleAction(true)}
                        sx={{ textTransform: "none", bgcolor: "#E89F17", "&:hover": { bgcolor: "#cc8b14" } }}
                    >
                        {saving ? "Saving…" : templateFlow ? "Save template" : "Save"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
