import React, { useState, useEffect } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useRef } from "react";

export default function RamsBriefingForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const siteId = searchParams.get("siteId");
    const category = searchParams.get("category") || "General forms";
    const action = searchParams.get("action");
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({ name: "", tags: "" });
    
    // Header Data
    const [docInfo, setDocInfo] = useState({ date: "", docNo: "", approvedBy: "" ,
        logo: ""
,
        logoRight: ""
    });
    const [briefingData, setBriefingData] = useState({
        personConducting: "",
        jobTitle: "",
        projectName: "",
        principalContractor: "",
        inducteeName: "",
        inducteeJobTitle: ""
    });

    const [briefingLabels, setBriefingLabels] = useState({
        headerTitle: "RAMS BRIEFING REGISTER",
        headerDate: "Date",
        headerDocNo: "Document No. & Rev",
        headerApprovedBy: "Approved by",
        formSubtitle: "Risk Assessment & Method Statement (RAMS) Briefing Form",
        personConducting: "Name of Person conducting Briefing",
        jobTitle: "Job Title",
        projectName: "Project Name / Title",
        principalContractor: "Name of Principal Contractor",
        inducteeName: "Name of Inductee",
        inducteeJobTitle: "Job Title"
    });
    
    // Grid Data for Signatures (15 rows)
    const [signatures, setSignatures] = useState(
        Array.from({ length: 15 }, () => ({ documentTitle: "", date: "", signatureInductee: "", signatureInductor: "" }))
    );

    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    useEffect(() => {
        if (!loading && action === "download" && id) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `RAMSBriefing_${id}`, () => {
                    setDownloading(false);
                    window.close();
                });
            }, 800);
        }
    }, [loading, action, id]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                const submission = res.data.data.find(r => r.id === submissionId || r._id === submissionId);
                if (submission && submission.answers) {
                    if (submission.answers.docInfo) setDocInfo(submission.answers.docInfo);
                    if (submission.answers.briefingData) setBriefingData(submission.answers.briefingData);
                    if (submission.answers.briefingLabels) setBriefingLabels(submission.answers.briefingLabels);
                    if (submission.answers.signatures) setSignatures(submission.answers.signatures);
                    setFormMetadata({
                        name: submission.answers.name || `RAMS Briefing - ${new Date(submission.createdAt).toLocaleDateString()}`,
                        tags: submission.answers.tags || ""
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load submission", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBriefingChange = (field) => (e) => {
        setBriefingData({ ...briefingData, [field]: e.target.value });
    };

    const handleSignatureChange = (index, field) => (e) => {
        const newSignatures = [...signatures];
        newSignatures[index] = { ...newSignatures[index], [field]: e.target.value };
        setSignatures(newSignatures);
    };

    const handleSaveClick = () => {
        if (id) {
            setSaveDialogOpen(true);
        } else {
            executeSave(false);
        }
    };

    const executeSave = async (asNew = false, name = "", tags = "") => {
        setSaving(true);
        try {
            const formData = { 
                docInfo, 
                briefingData, 
                briefingLabels, 
                signatures,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) formData.siteId = siteId;
            if (siteId) formData.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: formData });
            } else {
                const formId = await getOrCreateTemplateForm("RAMS Briefing Form");
                await api.post(`/forms/${formId}/responses`, {
                    answers: formData,
                    category: category
                });
            }
            
            setSaveDialogOpen(false);
            if (siteId) {
                navigate('/sitepack-management', { state: { siteId, moduleTitle: category } });
            } else {
                navigate('/general-forms');
            }
        } catch (e) {
            console.error("Failed to save", e);
            alert("Failed to save the form.");
        } finally {
            setSaving(false);
        }
    };

    // Styling configurations to match light/dark modes
    const borderColor = "#CCC";
    const cellPadding = "8px 12px";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => siteId ? navigate('/sitepack-management', { state: { siteId, moduleTitle: category } }) : navigate('/general-forms')} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        RAMS Briefing Form
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    onClick={handleSaveClick}
                    disabled={saving}
                    sx={{ 
                        bgcolor: "#E89F17", 
                        color: "#FFFFFF", 
                        fontWeight: 600, 
                        borderRadius: "8px",
                        boxShadow: "none",
                        "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" } 
                    }}
                >
                    {downloading ? "Downloading PDF..." : (saving ? "Saving..." : "Save Form")}
                </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
                {/* Form Container */}
                <Paper 
                    ref={containerRef}
                    elevation={3} 
                    sx={{ 
                        width: "100%", 
                        minWidth: (downloading || action === 'download') ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: 4, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        borderRadius: 2,
                        border: (downloading || action === 'download') ? "1px solid #ccc" : "none",
                        boxShadow: (downloading || action === 'download') ? "none" : undefined
                    }}
                >
                    {/* Top Header Logos and Document Info */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 4 }}>
                                                {/* Left Logo / Upload */}
                        <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${borderColor}` }}>
                            {docInfo.logo ? (
                                <>
                                    <Box component="img" src={docInfo.logo} alt="Uploaded Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                                    {(action !== 'download') && (
                                        <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                            Change Logo
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setDocInfo({...docInfo, logo: ev.target.result});
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </Button>
                                    )}
                                </>
                            ) : (
                                (action !== 'download') ? (
                                    <Button variant="outlined" component="label" size="small">
                                        Upload Logo
                                        <input type="file" hidden accept="image/*" onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setDocInfo({...docInfo, logo: ev.target.result});
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </Button>
                                ) : (
                                    <Typography variant="caption" color="text.secondary">No Logo</Typography>
                                )
                            )}
                        </Box>
                        
                        {/* Center Info */}
                        <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    <Typography sx={{ fontWeight: 'bold' }}>{briefingLabels.headerTitle}</Typography>
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', textAlign: 'center', input: { textAlign: 'center' } } }}
                                        value={briefingLabels.headerTitle}
                                        onChange={(e) => setBriefingLabels({...briefingLabels, headerTitle: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{briefingLabels.headerDate}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={briefingLabels.headerDate}
                                            onChange={(e) => setBriefingLabels({...briefingLabels, headerDate: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{briefingLabels.headerDocNo}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={briefingLabels.headerDocNo}
                                            onChange={(e) => setBriefingLabels({...briefingLabels, headerDocNo: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    <Box sx={{ pl: 1, pr: 0.5, whiteSpace: 'nowrap' }}>
                                        {(downloading || action === 'download') ? (
                                            <Typography sx={{ fontWeight: 'inherit' }}>{briefingLabels.headerApprovedBy}</Typography>
                                        ) : (
                                            <TextField
                                                variant="standard"
                                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit', maxWidth: '100px' } }}
                                                value={briefingLabels.headerApprovedBy}
                                                onChange={(e) => setBriefingLabels({...briefingLabels, headerApprovedBy: e.target.value})}
                                            />
                                        )}
                                    </Box>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 0.5, py: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page 1 of 1</Box>
                            </Box>
                        </Box>

                        
                    </Box>

                    {/* Form Title */}
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                        {(downloading || action === 'download') ? (
                            <Typography variant="h6" sx={{ textAlign: "center" }}>{briefingLabels.formSubtitle}</Typography>
                        ) : (
                            <TextField
                                fullWidth
                                variant="standard"
                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', fontSize: '1.25rem', textAlign: 'center', input: { textAlign: 'center' } } }}
                                value={briefingLabels.formSubtitle}
                                onChange={(e) => setBriefingLabels({...briefingLabels, formSubtitle: e.target.value})}
                            />
                        )}
                    </Box>

                    {/* Briefing Info Table 1 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, mb: 3 }}>
                        {[
                            { key: "personConducting" },
                            { key: "jobTitle" },
                            { key: "projectName" },
                            { key: "principalContractor" }
                        ].map((row, index) => (
                            <Box key={row.key} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 3 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{briefingLabels[row.key]}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                            value={briefingLabels[row.key]}
                                            onChange={(e) => setBriefingLabels({...briefingLabels, [row.key]: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingData[row.key] || ' '}</Typography>) : (<TextField multiline 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }}
                                        value={briefingData[row.key]}
                                        onChange={handleBriefingChange(row.key)}
                                    />)}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    <Typography sx={{ mb: 3, fontSize: '0.95rem', lineHeight: 1.5 }}>
                        I confirm that I have read and understand the requirements of this method statement and associated risk assessments and have communicated them to operatives/persons under my control and to those who may be affected by its requirements.
                    </Typography>

                    {/* Briefing Info Table 2 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, mb: 3 }}>
                        {[
                            { key: "inducteeName" },
                            { key: "inducteeJobTitle" }
                        ].map((row, index) => (
                            <Box key={row.key} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{briefingLabels[row.key]}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                            value={briefingLabels[row.key]}
                                            onChange={(e) => setBriefingLabels({...briefingLabels, [row.key]: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingData[row.key] || ' '}</Typography>) : (<TextField multiline 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }}
                                        value={briefingData[row.key]}
                                        onChange={handleBriefingChange(row.key)}
                                    />)}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    <Typography sx={{ mb: 3, fontSize: '0.95rem', lineHeight: 1.5 }}>
                        I hereby confirm that I have received, read and fully understood the approved site Risk Assessment & Method Statement (RAMS) and sign to say that I fully agree to adhere to the contents of the method statement(s) and the associated risk assessments.<br/>
                        I have attended a site induction/briefing that explained the general site rules and necessary site specific arrangements
                    </Typography>

                    {/* Signatures Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>Document Title</Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>Date</Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>Signature of<br/>Inductee</Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>Signature of<br/>Inductor</Box>
                        </Box>
                        
                        {signatures.map((sig, index) => (
                            <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 14 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{sig.documentTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={sig.documentTitle} onChange={handleSignatureChange(index, "documentTitle")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{sig.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={sig.date} onChange={handleSignatureChange(index, "date")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {sig.signatureInductee && (sig.signatureInductee.startsWith('data:image/') || sig.signatureInductee.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={sig.signatureInductee} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductee: '' } : s);
                                                    setSignatures(newSigs);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{sig.signatureInductee || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                                <TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, height: '100%' } }} value={sig.signatureInductee} onChange={handleSignatureChange(index, "signatureInductee")} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ mr: 1, whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none' }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductee: ev.target.result } : s);
                                                                setSignatures(newSigs);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, display: 'flex', alignItems: 'center' }}>
                                    {sig.signatureInductor && (sig.signatureInductor.startsWith('data:image/') || sig.signatureInductor.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={sig.signatureInductor} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductor: '' } : s);
                                                    setSignatures(newSigs);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{sig.signatureInductor || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                                <TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, height: '100%' } }} value={sig.signatureInductor} onChange={handleSignatureChange(index, "signatureInductor")} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ mr: 1, whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none' }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductor: ev.target.result } : s);
                                                                setSignatures(newSigs);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Declaration Statement */}
                    <Box sx={{ mt: 4 }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '1rem', mb: 0.5 }}>
                            Declaration Statement
                        </Typography>
                        <Typography sx={{ fontStyle: 'italic', fontSize: '0.95rem', mb: 3 }}>
                            By signing above, I confirm that I will work safely in accordance with the above documentation, attend weekly toolbox talks and training, follow site rules as per site induction and shall be responsible for my own health and safety as well as that of others and shall report any concerns immediately to the Site Person in charge
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                            If you have any doubt about information given or contained in this method statement – ask for clarification.
                        </Typography>
                    </Box>

                                        {/* Signature Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6, mb: 2 }}>
                            <Box sx={{ width: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {docInfo.signature ? (
                                    <>
                                        <Box component="img" src={docInfo.signature} alt="Signature" sx={{ width: '100%', maxHeight: '80px', objectFit: 'contain', borderBottom: `1px solid ${borderColor}`, mb: 1 }} />
                                        {(action !== 'download') && (
                                            <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                                Change Signature
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo({...docInfo, signature: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    (action !== 'download') ? (
                                        <Box sx={{ width: '100%', height: '60px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                            <Button variant="outlined" component="label" size="small">
                                                Upload Signature
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo({...docInfo, signature: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box sx={{ width: '100%', height: '60px', borderBottom: `1px solid ${borderColor}`, mb: 1 }} />
                                    )
                                )}
                                <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Signature</Typography>
                            </Box>
                        </Box>

                    </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={id}
                defaultName={formMetadata.name || `RAMS Briefing - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
