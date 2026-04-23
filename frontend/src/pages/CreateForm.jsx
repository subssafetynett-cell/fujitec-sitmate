import React, { useState } from "react";
import { 
    Box, Typography, Button, Paper, IconButton, CircularProgress, 
    TextField, Grid, Divider, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow 
} from "@mui/material";
import { 
    UploadCloud, ArrowLeft, FileText, CheckCircle2, 
    Image as ImageIcon, Layout as LayoutIcon, Table as TableIcon 
} from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

export default function CreateForm() {
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState(0);
    const [success, setSuccess] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [inferredFields, setInferredFields] = useState([]);

    const analysisSteps = [
        "Uploading document...",
        "Analyzing form structure...",
        "Detecting input fields...",
        "Identifying image regions...",
        "Detecting tables and columns...",
        "Converting images to upload buttons...",
        "Finalizing digital form..."
    ];

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setSuccess(false);
            setShowPreview(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileChange(e);
    };

    const handleUpload = () => {
        if (!file) return;
        setUploading(true);
        setAnalyzing(true);
        setAnalysisStep(0);

        // Simulate analysis process
        let step = 0;
        const interval = setInterval(() => {
            step++;
            if (step < analysisSteps.length) {
                setAnalysisStep(step);
            } else {
                clearInterval(interval);
                completeConversion();
            }
        }, 700);
    };

    const completeConversion = () => {
        // Define inferred fields including a table
        const fields = [
            { id: "f1", type: "text", label: "Project Name", name: "project_name", defaultValue: "Safety Inspection Alpha" },
            { id: "f2", type: "date", label: "Inspection Date", name: "inspection_date", defaultValue: new Date().toISOString().split('T')[0] },
            { id: "f3", type: "text", label: "Inspector Name", name: "inspector_name", defaultValue: "John Smith" },
            { 
                id: "f4", 
                type: "table", 
                label: "Hazard Observation Table", 
                columns: ["Item #", "Description of Hazard", "Risk Level", "Corrective Action"],
                rows: [
                    ["1", "Exposed wiring in Zone B", "High", "Electrical team notified"],
                    ["2", "Slippery floor near entrance", "Medium", "Warning signs placed"],
                    ["3", "Damaged scaffolding", "Critical", "Area cordoned off"]
                ]
            },
            { id: "f5", type: "textarea", label: "General Comments", name: "observations", defaultValue: "All safety protocols followed except for noted hazards." },
            { id: "f6", type: "image_upload", label: "Site Evidence Photo", name: "site_photo" },
            { id: "f7", type: "signature", label: "Inspector Signature", name: "signature" }
        ];

        setInferredFields(fields);
        
        localStorage.setItem("formbuilder_form", JSON.stringify(fields));
        localStorage.setItem("formbuilder_title", file?.name?.replace(/\.[^/.]+$/, "") || "Newly Imported Form");
        
        setUploading(false);
        setAnalyzing(false);
        setSuccess(true);
        setFile(null);

        setTimeout(() => {
            setShowPreview(true);
        }, 800);
    };

    const renderPreviewTable = (field) => {
        return (
            <Box sx={{ mb: 4, width: '100%' }}>
                <Typography sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                    <TableIcon size={18} color="#E89F17" /> {field.label}
                </Typography>
                <TableContainer component={Paper} elevation={0} sx={{ 
                    border: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`, 
                    borderRadius: 2,
                    bgcolor: 'transparent'
                }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: isDarkMode ? "#1F2937" : "#F9FAFB" }}>
                            <TableRow>
                                {field.columns.map((col, idx) => (
                                    <TableCell key={idx} sx={{ fontWeight: 700, borderBottom: `2px solid ${isDarkMode ? "#374151" : "#E5E7EB"}` }}>
                                        {col}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {field.rows.map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                    {row.map((cell, cellIdx) => (
                                        <TableCell key={cellIdx} sx={{ borderBottom: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}` }}>
                                            {cell}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: isDarkMode ? "rgba(232, 159, 23, 0.05)" : "#FFFBEB" }}>
                                <TableCell colSpan={field.columns.length} align="center" sx={{ py: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                    + Add Row (AI Detected Table Structure)
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    const renderPreviewField = (field) => {
        const labelStyle = { fontWeight: 600, mb: 1, display: 'block', fontSize: '0.9rem', color: isDarkMode ? "#9CA3AF" : "#4B5563" };
        
        if (field.type === "table") return renderPreviewTable(field);

        if (field.type === "image_upload") {
            return (
                <Box sx={{ mb: 3 }}>
                    <Typography sx={labelStyle}>{field.label}</Typography>
                    <Box sx={{ 
                        border: "2px dashed #cbd5e1", 
                        borderRadius: "12px", 
                        p: 3, 
                        textAlign: "center", 
                        bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "#f8fafc"
                    }}>
                        <ImageIcon size={32} color="#E89F17" style={{ marginBottom: '8px', opacity: 0.7 }} />
                        <Typography variant="body2" color="text.secondary">Detected Image Area</Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<UploadCloud size={16} />}
                            sx={{ mt: 1.5, textTransform: 'none', borderRadius: 2, color: '#E89F17', borderColor: '#E89F17' }}
                        >
                            Upload New Image
                        </Button>
                    </Box>
                </Box>
            );
        }

        if (field.type === "signature") {
             return (
                <Box sx={{ mb: 3 }}>
                    <Typography sx={labelStyle}>{field.label}</Typography>
                    <Box sx={{ 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "12px", 
                        height: 80, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "#fff"
                    }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>Sign here</Typography>
                    </Box>
                </Box>
            );
        }

        return (
            <Box sx={{ mb: 3 }}>
                <Typography sx={labelStyle}>{field.label}</Typography>
                <TextField 
                    fullWidth 
                    size="small" 
                    variant="outlined" 
                    defaultValue={field.defaultValue}
                    multiline={field.type === "textarea"}
                    rows={field.type === "textarea" ? 3 : 1}
                    type={field.type === "date" ? "date" : "text"}
                    sx={{ 
                        "& .MuiOutlinedInput-root": { borderRadius: "10px" }
                    }} 
                />
            </Box>
        );
    };

    if (showPreview) {
        return (
            <Layout>
                <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <IconButton onClick={() => setShowPreview(false)} sx={{ bgcolor: isDarkMode ? "#374151" : "#E5E7EB" }}>
                            <ArrowLeft size={20} color={isDarkMode ? "#F9FAFB" : "#111827"} />
                        </IconButton>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                            Form Preview
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        onClick={() => navigate("/form-build")}
                        startIcon={<LayoutIcon size={18} />}
                        sx={{
                            bgcolor: "#E89F17",
                            "&:hover": { bgcolor: "#cc8b14" },
                            textTransform: 'none',
                            borderRadius: 3,
                            fontWeight: 600,
                            px: 3
                        }}
                    >
                        Edit in Form Builder
                    </Button>
                </Box>

                <Grid container spacing={4} justifyContent="center">
                    <Grid item xs={12} md={10} lg={9}>
                        <Paper 
                            elevation={4}
                            sx={{ 
                                p: 6, 
                                borderRadius: 4, 
                                bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Box sx={{ 
                                position: 'absolute', 
                                top: 20, 
                                right: -30, 
                                bgcolor: '#10B981', 
                                color: '#fff', 
                                px: 6, 
                                py: 0.5, 
                                transform: 'rotate(45deg)',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                boxShadow: 2,
                                zIndex: 10
                            }}>
                                AI CONVERTED
                            </Box>

                            <Typography variant="h5" fontWeight={800} sx={{ mb: 1, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                {localStorage.getItem("formbuilder_title") || "Untitled Form"}
                            </Typography>
                            <Divider sx={{ mb: 4, opacity: 0.1 }} />

                            <Grid container spacing={2}>
                                {inferredFields.map((field) => (
                                    <Grid item xs={12} sm={(field.type === "textarea" || field.type === "table") ? 12 : 6} key={field.id}>
                                        {renderPreviewField(field)}
                                    </Grid>
                                ))}
                            </Grid>

                            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="contained" sx={{ bgcolor: '#E89F17', px: 4, borderRadius: 2 }}>
                                    Save to My Forms
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Layout>
        );
    }

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: isDarkMode ? "#374151" : "#E5E7EB" }}>
                    <ArrowLeft size={20} color={isDarkMode ? "#F9FAFB" : "#111827"} />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                    Create Form
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 2, md: 5 } }}>
                <Paper 
                    elevation={3}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{ 
                        p: 4, 
                        width: '100%', 
                        maxWidth: 600, 
                        bgcolor: isDarkMode ? (isDragging ? "rgba(232, 159, 23, 0.05)" : "#1B212C") : (isDragging ? "#FFF7ED" : "#FFFFFF"), 
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        borderRadius: 4,
                        textAlign: 'center',
                        border: isDragging ? "2px solid #E89F17" : "1px solid transparent",
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Box sx={{ mb: 4 }}>
                        <Box 
                            sx={{ 
                                display: 'inline-flex', 
                                p: 2, 
                                borderRadius: '50%', 
                                bgcolor: 'rgba(232, 159, 23, 0.1)', 
                                color: '#E89F17',
                                mb: 2 
                            }}
                        >
                            <FileText size={40} />
                        </Box>
                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            AI Form Importer
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Upload a PDF or Image. Our AI will automatically convert it into a digital form, detecting tables, columns, and replacing images with upload buttons.
                        </Typography>
                    </Box>

                    <Box 
                        sx={{ 
                            border: `2px dashed ${file ? '#10B981' : (isDragging ? '#E89F17' : (isDarkMode ? '#374151' : '#E5E7EB'))}`, 
                            borderRadius: 4, 
                            p: 6, 
                            mb: 4,
                            transition: 'all 0.3s ease',
                            bgcolor: file ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                            '&:hover': {
                                borderColor: file ? '#10B981' : '#E89F17',
                                bgcolor: 'rgba(232, 159, 23, 0.02)'
                            }
                        }}
                    >
                        {analyzing ? (
                            <Box sx={{ py: 3 }}>
                                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                                    <CircularProgress size={60} sx={{ color: '#E89F17' }} />
                                    <Box
                                        sx={{
                                            top: 0,
                                            left: 0,
                                            bottom: 0,
                                            right: 0,
                                            position: 'absolute',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Typography variant="caption" component="div" color="text.secondary" fontWeight={700}>
                                            {Math.round(((analysisStep + 1) / analysisSteps.length) * 100)}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Typography variant="h6" fontWeight={600} gutterBottom>
                                    AI is Processing...
                                </Typography>
                                <Typography variant="body2" color="#E89F17" fontWeight={500}>
                                    {analysisSteps[analysisStep]}
                                </Typography>
                            </Box>
                        ) : success && !showPreview ? (
                            <Box sx={{ py: 2 }}>
                                <CheckCircle2 size={48} color="#10B981" style={{ marginBottom: '16px' }} />
                                <Typography variant="h6" color="#10B981" fontWeight={600}>
                                    Conversion Complete!
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Opening your digital form preview...
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                <UploadCloud 
                                    size={48} 
                                    color={file ? "#10B981" : (isDragging ? "#E89F17" : "#E89F17")} 
                                    style={{ marginBottom: '16px', opacity: file ? 1 : 0.7 }} 
                                />
                                <Typography variant="body1" fontWeight={500} sx={{ mb: 1 }}>
                                    {file ? file.name : (isDragging ? "Drop your file here!" : "Choose a file or drag and drop")}
                                </Typography>
                                {file && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                        {(file.size / 1024).toFixed(2)} KB
                                    </Typography>
                                )}
                                <Button
                                    variant="outlined"
                                    component="label"
                                    sx={{
                                        mt: 1,
                                        borderColor: "#E89F17",
                                        color: "#E89F17",
                                        "&:hover": { borderColor: "#cc8b14", bgcolor: 'rgba(232, 159, 23, 0.05)' },
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        px: 3
                                    }}
                                >
                                    {file ? "Change File" : "Select File"}
                                    <input type="file" hidden onChange={handleFileChange} />
                                </Button>
                            </>
                        )}
                    </Box>

                    {file && !analyzing && !success && (
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleUpload}
                            disabled={uploading}
                            sx={{
                                py: 1.5,
                                bgcolor: "#E89F17",
                                "&:hover": { bgcolor: "#cc8b14" },
                                textTransform: 'none',
                                borderRadius: 3,
                                fontWeight: 700,
                                fontSize: '1rem',
                                boxShadow: '0 4px 14px 0 rgba(232, 159, 23, 0.39)'
                            }}
                        >
                            {uploading ? "Uploading..." : "Convert to Form"}
                        </Button>
                    )}
                </Paper>
            </Box>
        </Layout>
    );
}
