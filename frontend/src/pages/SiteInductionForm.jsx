import React, { useState, useEffect } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
<<<<<<< HEAD
    IconButton, 
=======
    IconButton
>>>>>>> 6e15f2feaf07bdbadbbba37a840bbc66823e3c3e
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import { ArrowLeft } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useRef } from "react";
<<<<<<< HEAD
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";
import FormYesNoTickCells from "../components/FormYesNoTickCells";
=======
>>>>>>> 6e15f2feaf07bdbadbbba37a840bbc66823e3c3e

export default function SiteInductionForm() {
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
    const [headerData, setHeaderData] = useState({
        projectTitle: "",
        scopeOfWork: "",
        location: "",
        contractNo: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "SITE INDUCTION REGISTER",
        headerDateLabel: "Date",
        headerDocNoLabel: "Document No. & Rev",
        headerApprovedByLabel: "Approved by",
        projectTitle: "Project title",
        scopeOfWork: "Scope of Work",
        location: "Location",
        contractNo: "Contract no."
    });
    
    // Grid Data for Signatures (10 rows)
    const [attendees, setAttendees] = useState(
        Array.from({ length: 10 }, () => ({ date: "", name: "", signature: "", employedBy: "", occupation: "", competencyCard: "", cardDetails: "", inductor: "" }))
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
                downloadPdfFromRef(containerRef, `SiteInduction_${id}`, () => {
                    setDownloading(false);
                    // Close the newly opened tab
                    window.close();
                });
            }, 800);
        }
    }, [loading, action, id]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            // Fetch responses user has submitted to populate this form
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                const submission = res.data.data.find(r => r.id === submissionId || r._id === submissionId);
                if (submission && submission.answers) {
                    if (submission.answers.docInfo) setDocInfo(submission.answers.docInfo);
                    if (submission.answers.headerData) setHeaderData(submission.answers.headerData);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    if (submission.answers.attendees) setAttendees(submission.answers.attendees);
                    setFormMetadata({
                        name: submission.answers.name || `Site Induction - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const handleHeaderChange = (field) => (e) => {
        setHeaderData({ ...headerData, [field]: e.target.value });
    };

    const handleAttendeeChange = (index, field) => (e) => {
        const newAttendees = [...attendees];
        newAttendees[index] = { ...newAttendees[index], [field]: e.target.value };
        setAttendees(newAttendees);
    };

    const handleSaveClick = () => {
<<<<<<< HEAD
        if (!canEdit) return;
        setSaveDialogOpen(true);
=======
        if (id) {
            setSaveDialogOpen(true);
        } else {
            executeSave(false);
        }
>>>>>>> 6e15f2feaf07bdbadbbba37a840bbc66823e3c3e
    };

    const executeSave = async (asNew = false, name = "", tags = "") => {
        if (!canEdit) return;
        setSaving(true);
        try {
            const formData = { 
                docInfo, 
                headerData, 
                headerLabels, 
                attendees,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) formData.siteId = siteId;
            
            if (id && !asNew) {
                // Update existing
                await api.put(`/forms/responses/${id}`, { answers: formData });
            } else {
                // Determine template Form ID, then save a new response
                const formId = await getOrCreateTemplateForm("Site Induction Register");
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

    // Styling configurations matching layout
    const borderColor = "#CCC";
    const cellPadding = "4px 8px";
    
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB";
    const secondaryHeaderBgColor = isDarkMode ? "rgba(255,255,255,0.1)" : "#E5E7EB";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => siteId ? navigate('/sitepack-management', { state: { siteId, moduleTitle: category } }) : navigate('/general-forms')} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        Site Induction Register
                    </Typography>
                </Box>
                {canEdit && (
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
                )}
            </Box>

            <Box sx={{ width: '100%', overflowX: 'auto', mb: 8 }}>
                <Box sx={{ minWidth: (downloading || action === 'download') ? "1000px" : "100%", display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', px: { xs: 2, md: 0 } }}>
                    {/* Form Container */}
                    <Paper 
                        ref={containerRef}
                        elevation={3} 
                        sx={{ 
                            width: "100%", 
                            maxWidth: "1000px", 
                            p: 4, 
                            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                            color: textColor,
                            borderRadius: 2,
                            border: "2px solid #000000"
                        }}
                    >
                        {/* Top Header Logos and Document Info */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 4, width: '100%', maxWidth: '800px', mx: 'auto' }}>
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
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
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
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
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
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0 }}>
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
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page 1 of 1</Box>
                            </Box>
                        </Box>

                        
                    </Box>

                    {/* Briefing Info Header */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, borderBottom: 'none' }}>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {(downloading || action === 'download') ? 
                                (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.projectTitle}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                    value={headerLabels.projectTitle}
                                    onChange={(e) => setHeaderLabels({...headerLabels, projectTitle: e.target.value})}
                                />)
                            }
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '35%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderRight: `1px solid ${borderColor}` }}>
                            {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.projectTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.projectTitle} onChange={handleHeaderChange("projectTitle")} />)}
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {(downloading || action === 'download') ? 
                                (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.scopeOfWork}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                    value={headerLabels.scopeOfWork}
                                    onChange={(e) => setHeaderLabels({...headerLabels, scopeOfWork: e.target.value})}
                                />)
                            }
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.scopeOfWork || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.scopeOfWork} onChange={handleHeaderChange("scopeOfWork")} />)}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}` }}>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {(downloading || action === 'download') ? 
                                (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.location}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                    value={headerLabels.location}
                                    onChange={(e) => setHeaderLabels({...headerLabels, location: e.target.value})}
                                />)
                            }
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '35%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderRight: `1px solid ${borderColor}` }}>
                            {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.location || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.location} onChange={handleHeaderChange("location")} />)}
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {(downloading || action === 'download') ? 
                                (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.contractNo}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                    value={headerLabels.contractNo}
                                    onChange={(e) => setHeaderLabels({...headerLabels, contractNo: e.target.value})}
                                />)
                            }
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.contractNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.contractNo} onChange={handleHeaderChange("contractNo")} />)}
                        </Box>
                    </Box>

                    <Box sx={{ border: `1px solid ${borderColor}`, borderTop: 'none', borderBottom: 'none', p: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', bgcolor: secondaryHeaderBgColor }}>
                        I confirm that I have attended the site induction, understand the site rules and that I am not taking medication or drugs that could affect my concentration or safety on site
                    </Box>

                    {/* Signatures Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', bgcolor: headerBgColor }}>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Date</Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Name<br/>(capitals)</Box>
                            <Box sx={{ width: { xs: '100%', md: '12%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Signature</Box>
                            <Box sx={{ width: { xs: '100%', md: '13%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Employed by<br/><span style={{color: '#FF6B6B', fontSize: '0.7rem'}}>(this column to be completed by Subcontractors only)</span></Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Occupation</Box>
                            
                            <Box sx={{ width: { xs: '100%', md: '10%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: cellPadding, borderBottom: `1px solid ${borderColor}` }}>Approved<br/>competency<br/>card/ cert<br/><span style={{fontSize: '0.7rem', fontWeight: 'normal'}}>(i.e. CSCS/CPCS)</span></Box>
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, height: '25px' }}>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>Yes</Box>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>No</Box>
                                </Box>
                            </Box>

                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Type of card held<br/><span style={{fontSize: '0.7rem', fontWeight: 'normal', fontStyle: 'italic'}}>(Plus, Card number and<br/>Expiry Date)</span></Box>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding }}>Person giving induction</Box>
                        </Box>
                        
                        {attendees.map((att, index) => (
                            <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 9 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.date} onChange={handleAttendeeChange(index, "date")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.name || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.name} onChange={handleAttendeeChange(index, "name")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {att.signature && (att.signature.startsWith('data:image/') || att.signature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={att.signature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newAttendees = attendees.map((a, i) => i === index ? { ...a, signature: '' } : a);
                                                    setAttendees(newAttendees);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{att.signature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: 'column' }}>
                                                <TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.signature} onChange={handleAttendeeChange(index, "signature")} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none', mt: 0.5 }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                const newAttendees = attendees.map((a, i) => i === index ? { ...a, signature: ev.target.result } : a);
                                                                setAttendees(newAttendees);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '13%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.employedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.employedBy} onChange={handleAttendeeChange(index, "employedBy")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.occupation || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.occupation} onChange={handleAttendeeChange(index, "occupation")} />)}
                                </Box>

                                {/* Competency Card Yes/No split */}
                                <Box sx={{ width: { xs: '100%', md: '10%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderRight: `1px solid ${borderColor}` }}>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, borderRight: `1px solid ${borderColor}` }}>
                                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'center' }}>{att.competencyCard === "Yes" ? "✓" : "" || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem', textAlign: 'center' } }} value={att.competencyCard === "Yes" ? "✓" : ""} onClick={() => handleAttendeeChange(index, "competencyCard")({target:{value: "Yes"}})} />)}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '50%' } }}>
                                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'center' }}>{att.competencyCard === "No" ? "✓" : "" || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem', textAlign: 'center' } }} value={att.competencyCard === "No" ? "✓" : ""} onClick={() => handleAttendeeChange(index, "competencyCard")({target:{value: "No"}})} />)}
                                    </Box>
                                </Box>

                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.cardDetails || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.cardDetails} onChange={handleAttendeeChange(index, "cardDetails")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' } }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.inductor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.inductor} onChange={handleAttendeeChange(index, "inductor")} />)}
                                </Box>
                            </Box>
                        ))}
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
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={id}
                defaultName={formMetadata.name || `Site Induction - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
