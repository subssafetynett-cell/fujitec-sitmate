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
    Divider
} from "@mui/material";
import { Save, FilePlus, X, Tag, Edit3 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function SaveChoiceDialog({ 
    open, 
    onClose, 
    onSave, 
    existingId, 
    defaultName = "", 
    defaultTags = "",
    saving = false 
}) {
    const { isDarkMode } = useTheme();
    const [name, setName] = useState(defaultName);
    const [tags, setTags] = useState(defaultTags);

    useEffect(() => {
        if (open) {
            setName(defaultName || `Submission - ${new Date().toLocaleDateString()}`);
            setTags(defaultTags);
        }
    }, [open, defaultName, defaultTags]);

    const handleAction = (asNew) => {
        if (!name.trim()) {
            alert("Please provide a name for this record.");
            return;
        }
        onSave(asNew, name, tags);
    };

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
                    p: 1
                }
            }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                    Save Submission
                </Typography>
                <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                            Identification Details
                        </Typography>
                        <TextField
                            fullWidth
                            label="Form Name"
                            placeholder="e.g. Tool Box Talk - Phase 1"
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
                                sx: { borderRadius: 3 }
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
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Box>

                    <Divider />

                    <Box>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                            Select how you want to save your progress
                        </Typography>
                        
                        <Box sx={{ display: 'grid', gridTemplateColumns: existingId ? '1fr 1fr' : '1fr', gap: 2 }}>
                            {existingId && (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 3,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                                        "&:hover": {
                                            borderColor: "#E89F17",
                                            bgcolor: "rgba(232, 159, 23, 0.05)",
                                            transform: 'translateY(-2px)'
                                        }
                                    }}
                                    onClick={() => handleAction(false)}
                                >
                                    <Box sx={{ p: 1, bgcolor: "rgba(232, 159, 23, 0.1)", borderRadius: 2, color: "#E89F17", width: 'fit-content', mb: 1.5 }}>
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
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: '1px solid #E89F17',
                                    bgcolor: "rgba(232, 159, 23, 0.08)",
                                    "&:hover": {
                                        bgcolor: "rgba(232, 159, 23, 0.12)",
                                        transform: 'translateY(-2px)'
                                    }
                                }}
                                onClick={() => handleAction(true)}
                            >
                                <Box sx={{ p: 1, bgcolor: "#E89F17", borderRadius: 2, color: "#FFFFFF", width: 'fit-content', mb: 1.5 }}>
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

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button 
                    variant="text" 
                    onClick={onClose} 
                    sx={{ color: "text.secondary", textTransform: 'none' }}
                >
                    Discard Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
}
