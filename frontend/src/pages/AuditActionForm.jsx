import React, { useState, useEffect, useRef } from "react";
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

export default function AuditActionForm() {
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

    // Common Document Header
    const [docInfo, setDocInfo] = useState({
        date: "",
        docNo: "",
        approvedBy: ""
    ,
        logo: ""
,
        logoRight: ""
    });

    const [formData, setFormData] = useState({
        detailsOfObservation: "",
        raisedBy: "",
        agreedWithObs: "",
        proposedAction: "",
        agreedWithAct: "",
        dateForCompletion: "",
        
        followUpAction: "",
        auditedBy: "",
        auditDate: "",
        auditSignature: "",
        
        auditSummary: "",
        clause: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "AUDIT ACTION FORM",
        headerDateLabel: "Date",
        headerDocNoLabel: "Document No. & Rev",
        headerApprovedByLabel: "Approved by",
        actionForm: "ACTION FORM",
        reference: "Reference",
        detailsObservation: "Details of Observation",
        raisedBy: "Raised by",
        agreedWithObs: "Agreed with",
        proposedHeader: "PROPOSED / AGREED ACTION",
        agreedWithAct: "Agreed with",
        dateCompletion: "Date for Completion",
        followUpHeader: "FOLLOW UP ACTION",
        followUpSub: "The agreed action has\\has not been implemented and found to be effective",
        auditedBy: "AUDITED BY",
        dateLabel: "DATE",
        sigLabel: "SIG",
        reportCont: "AUDIT REPORT CONTINUATION",
        auditSummary: "AUDIT SUMMARY",
        clause: "Clause"
    });

    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    useEffect(() => {
        if (!loading && action === "download" && id) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `AuditAction_${id}`, () => {
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
                    if (submission.answers.formData) setFormData(submission.answers.formData);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    setFormMetadata({
                        name: submission.answers.name || `Audit Action - ${new Date(submission.createdAt).toLocaleDateString()}`,
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
            const payload = { 
                docInfo, 
                formData, 
                headerLabels,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) payload.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: payload });
            } else {
                const formId = await getOrCreateTemplateForm("Audit Action Form");
                await api.post(`/forms/${formId}/responses`, {
                    answers: payload,
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

    const updateField = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const borderColor = isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.05)" : "#E5E7EB";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
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
                        Audit Action Form
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
                <Paper 
                    ref={containerRef}
                    elevation={ (downloading || action === 'download') ? 0 : 3 } 
                    sx={{ 
                        width: "100%", 
                        minWidth: (downloading || action === 'download') ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: 4, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: 2,
                        border: (downloading || action === 'download') ? "1px solid #ccc" : "none"
                    }}
                >
                    {/* PAGE 1 */}
                    
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
                        
                        <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    <Typography sx={{ fontWeight: 'bold' }}>{headerLabels.formTitle}</Typography>
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', textAlign: 'center', input: { textAlign: 'center' } } }}
                                        value={headerLabels.formTitle}
                                        onChange={(e) => setHeaderLabels({...headerLabels, formTitle: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.headerDateLabel}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={headerLabels.headerDateLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, headerDateLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.headerDocNoLabel}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={headerLabels.headerDocNoLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, headerDocNoLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    <Box sx={{ pl: 1, pr: 0.5, whiteSpace: 'nowrap' }}>
                                        {(downloading || action === 'download') ? (
                                            <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.headerApprovedByLabel}</Typography>
                                        ) : (
                                            <TextField
                                                variant="standard"
                                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit', maxWidth: '100px' } }}
                                                value={headerLabels.headerApprovedByLabel}
                                                onChange={(e) => setHeaderLabels({...headerLabels, headerApprovedByLabel: e.target.value})}
                                            />
                                        )}
                                    </Box>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 0.5, py: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page 1 of 2</Box>
                            </Box>
                        </Box>

                        
                    </Box>

                    {/* Table 1 */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 8 }}>
                        {/* Header Row */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.actionForm}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', textAlign: 'center' } }}
                                        value={headerLabels.actionForm}
                                        onChange={(e) => setHeaderLabels({...headerLabels, actionForm: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, textAlign: 'left' }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.reference}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.reference}
                                        onChange={(e) => setHeaderLabels({...headerLabels, reference: e.target.value})}
                                    />)
                                }
                            </Box>
                        </Box>
                        
                        {/* Details of Observation */}
                        <Box sx={{ borderBottom: `1px solid ${borderColor}`, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ p: 0, fontWeight: 'bold' }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.detailsObservation}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.detailsObservation}
                                        onChange={(e) => setHeaderLabels({...headerLabels, detailsObservation: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ flex: 1, px: 1, pb: 1 }}>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.detailsOfObservation || ' '}</Typography>) : (<TextField fullWidth multiline minRows={8} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.detailsOfObservation} onChange={updateField("detailsOfObservation")} />)}
                            </Box>
                        </Box>

                        {/* Raised by / Agreed with */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexWrap: 'wrap', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.raisedBy}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.raisedBy}
                                            onChange={(e) => setHeaderLabels({...headerLabels, raisedBy: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.raisedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.raisedBy} onChange={updateField("raisedBy")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexWrap: 'wrap' }}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.agreedWithObs}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.agreedWithObs}
                                            onChange={(e) => setHeaderLabels({...headerLabels, agreedWithObs: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.agreedWithObs || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.agreedWithObs} onChange={updateField("agreedWithObs")} />)}
                            </Box>
                        </Box>

                        {/* Right Logo / Upload */}
                        <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {docInfo.logoRight ? (
                                <>
                                    <Box component="img" src={docInfo.logoRight} alt="Uploaded Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                                    {(action !== 'download') && (
                                        <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                            Change Logo
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setDocInfo({...docInfo, logoRight: ev.target.result});
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
                                                reader.onload = (ev) => setDocInfo({...docInfo, logoRight: ev.target.result});
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </Button>
                                ) : (
                                    <Typography variant="caption" color="text.secondary">No Logo</Typography>
                                )
                            )}
                        </Box>

                        {/* PROPOSED ACTION Header */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.proposedHeader}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', textAlign: 'center' } }}
                                        value={headerLabels.proposedHeader}
                                        onChange={(e) => setHeaderLabels({...headerLabels, proposedHeader: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, p: cellPadding }}></Box>
                        </Box>

                        {/* Action Details */}
                        <Box sx={{ borderBottom: `1px solid ${borderColor}`, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ flex: 1, p: 1 }}>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.proposedAction || ' '}</Typography>) : (<TextField fullWidth multiline minRows={8} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.proposedAction} onChange={updateField("proposedAction")} />)}
                            </Box>
                        </Box>

                        {/* Agreed with / Date for Completion */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexWrap: 'wrap', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.agreedWithAct}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.agreedWithAct}
                                            onChange={(e) => setHeaderLabels({...headerLabels, agreedWithAct: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.agreedWithAct || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, pb: 1 } }} value={formData.agreedWithAct} onChange={updateField("agreedWithAct")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexWrap: 'wrap' }}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.dateCompletion}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.dateCompletion}
                                            onChange={(e) => setHeaderLabels({...headerLabels, dateCompletion: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.dateForCompletion || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, pb: 1 } }} value={formData.dateForCompletion} onChange={updateField("dateForCompletion")} />)}
                            </Box>
                        </Box>
                    </Box>

                    {/* PAGE BREAK CONTENT (simulated visual break) */}
                    <Box sx={{ height: '40px' }}></Box>

                    {/* PAGE 2 - Top Header Logos and Document Info */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 4 }}>
                        
                        
                        <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                AUDIT ACTION FORM
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>Date</Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>Document No. & Rev</Box>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    <Box sx={{ pl: 1, pr: 0.5, whiteSpace: 'nowrap' }}>Approved by</Box>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 0.5, py: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page 2 of 2</Box>
                            </Box>
                        </Box>

                        
                    </Box>

                    {/* Follow Up Action Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.followUpHeader}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', textAlign: 'center' } }}
                                        value={headerLabels.followUpHeader}
                                        onChange={(e) => setHeaderLabels({...headerLabels, followUpHeader: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, textAlign: 'left' }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.followUpSub}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', fontSize: '0.9rem' } }}
                                        value={headerLabels.followUpSub}
                                        onChange={(e) => setHeaderLabels({...headerLabels, followUpSub: e.target.value})}
                                    />)
                                }
                            </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, minHeight: '200px' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0 }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.auditedBy}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.auditedBy}
                                            onChange={(e) => setHeaderLabels({...headerLabels, auditedBy: e.target.value})}
                                        />)
                                    }
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.auditedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditedBy} onChange={updateField("auditedBy")} />)}
                                </Box>
                                <Box sx={{ p: 0, mt: 2 }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.dateLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.dateLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, dateLabel: e.target.value})}
                                        />)
                                    }
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.auditDate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditDate} onChange={updateField("auditDate")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ p: 0 }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sigLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.sigLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, sigLabel: e.target.value})}
                                        />)
                                    }
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.auditSignature || ' '}</Typography>) : (<TextField fullWidth multiline minRows={4} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditSignature} onChange={updateField("auditSignature")} />)}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.followUpAction || ' '}</Typography>) : (<TextField fullWidth multiline minRows={4} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2, pb: 1, height: '100%' } }} value={formData.followUpAction} onChange={updateField("followUpAction")} placeholder="Follow up notes..." />)}
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    {/* Audit Report Continuation */}
                    <Box sx={{ border: `1px solid ${borderColor}` }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor, fontWeight: 'bold' }}>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.reportCont}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.reportCont}
                                        onChange={(e) => setHeaderLabels({...headerLabels, reportCont: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding }}>PAGE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; OF &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, minHeight: '500px' }}>
                            <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0, fontWeight: 'bold' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.auditSummary}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.auditSummary}
                                            onChange={(e) => setHeaderLabels({...headerLabels, auditSummary: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ flex: 1, p: 1 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.auditSummary || ' '}</Typography>) : (<TextField fullWidth multiline minRows={18} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.auditSummary} onChange={updateField("auditSummary")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ p: 0, fontWeight: 'bold' }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.clause}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.clause}
                                            onChange={(e) => setHeaderLabels({...headerLabels, clause: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ flex: 1, p: 1 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.clause || ' '}</Typography>) : (<TextField fullWidth multiline minRows={18} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.clause} onChange={updateField("clause")} />)}
                                </Box>
                            </Box>
                        </Box>
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
                defaultName={formMetadata.name || `Audit Action - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
