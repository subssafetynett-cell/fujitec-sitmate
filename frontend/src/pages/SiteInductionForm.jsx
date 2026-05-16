import React, { useState, useEffect } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton, 
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import GeneralFormTableRowControls, {
    GeneralFormTableRowControlsHeaderSpacer,
} from "../components/GeneralFormTableRowControls";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useRef } from "react";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";
import FormYesNoTickCells from "../components/FormYesNoTickCells";

export default function SiteInductionForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const category = searchParams.get("category") || "General forms";
    const action = searchParams.get("action");
    const containerRef = useRef(null);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({ name: "", tags: "" });

    // Header Data
    const [docInfo, setDocInfo] = useState({
        date: "",
        docNo: "",
        approvedBy: "",
        logo: "",
        logoRight: "",
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
    
    const EMPTY_ATTENDEE = { date: "", name: "", signature: "", employedBy: "", occupation: "", competencyCard: "", cardDetails: "", inductor: "" };
    const [attendees, setAttendees] = useState(() =>
        Array.from({ length: 10 }, () => ({ ...EMPTY_ATTENDEE }))
    );
    const [persistedSiteId, setPersistedSiteId] = useState(null);

    const { canEdit, siteId, pdfLayout, contentReadOnly } = useGeneralFormTemplateAccess(
        action,
        downloading,
        persistedSiteId
    );

    useEffect(() => {
        if (!persistedResponseId && !fromTemplateId) setPersistedSiteId(null);
    }, [persistedResponseId, fromTemplateId]);

    useEffect(() => {
        if (seedSubmissionId) {
            loadSubmission(seedSubmissionId);
        }
    }, [seedSubmissionId]);

    useEffect(() => {
        const docKey = persistedResponseId || seedSubmissionId;
        if (!loading && action === "download" && docKey) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `SiteInduction_${docKey}`, () => {
                    setDownloading(false);
                    // Close the newly opened tab
                    window.close();
                });
            }, 800);
        }
    }, [loading, action, persistedResponseId, seedSubmissionId]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            // Fetch responses user has submitted to populate this form
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                const submission = res.data.data.find(r => r.id === submissionId || r._id === submissionId);
                if (submission && submission.answers) {
                    setPersistedSiteId(submission.answers.siteId ?? null);
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

    const setAttendeeCompetencyCard = (index, choice) => {
        setAttendees((prev) =>
            prev.map((a, i) => (i === index ? { ...a, competencyCard: choice } : a))
        );
    };

    const insertAttendeeAfter = (index) => {
        setAttendees((a) => {
            if (a.length >= 35) return a;
            const next = [...a];
            next.splice(index + 1, 0, { ...EMPTY_ATTENDEE });
            return next;
        });
    };
    const removeAttendeeAt = (index) => {
        setAttendees((a) => (a.length <= 1 ? a : a.filter((_, i) => i !== index)));
    };

    const handleSaveClick = () => {
        setSaveDialogOpen(true);
    };

    const executeSave = async (asNew = false, name = "", tags = "") => {
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
            
            if (persistedResponseId && !asNew) {
                // Update existing
                await api.put(`/forms/responses/${persistedResponseId}`, { answers: formData });
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
                    disabled={saving || !canEdit || downloading}
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
                <Box sx={{ minWidth: pdfLayout ? "1000px" : "100%", display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', px: { xs: 2, md: 0 } }}>
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
                            border: pdfLayout ? "1px solid #ccc" : "2px solid #000000",
                            boxShadow: pdfLayout ? "none" : undefined
                        }}
                    >
                        {/* Top Header Logos and Document Info */}
                        <FormDocumentHeader
                            borderColor={borderColor}
                            readOnly={contentReadOnly}
                            leftImageSrc={docInfo.logo}
                            onLeftImageChange={(url) => setDocInfo((prev) => ({ ...prev, logo: url }))}
                            rightImageSrc={docInfo.logoRight}
                            onRightImageChange={(url) => setDocInfo((prev) => ({ ...prev, logoRight: url }))}
                            sx={{ mb: 4 }}
                        >
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (
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
                                    {contentReadOnly ? (
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <FormHeaderApprovedRow
                                borderColor={borderColor}
                                contentReadOnly={contentReadOnly}
                                label={headerLabels.headerApprovedByLabel}
                                onLabelChange={(e) => setHeaderLabels({ ...headerLabels, headerApprovedByLabel: e.target.value })}
                                value={docInfo.approvedBy}
                                onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                                valueTextColor={textColor}
                            />
                        </FormDocumentHeader>

                    {/* Briefing Info Header */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, borderBottom: 'none' }}>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {contentReadOnly ? 
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
                            {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.projectTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.projectTitle} onChange={handleHeaderChange("projectTitle")} />)}
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {contentReadOnly ? 
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
                            {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.scopeOfWork || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.scopeOfWork} onChange={handleHeaderChange("scopeOfWork")} />)}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}` }}>
                        <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {contentReadOnly ? 
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
                            {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.location || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.location} onChange={handleHeaderChange("location")} />)}
                        </Box>
                        <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                            {contentReadOnly ? 
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
                            {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.contractNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }} value={headerData.contractNo} onChange={handleHeaderChange("contractNo")} />)}
                        </Box>
                    </Box>

                    <Box sx={{ border: `1px solid ${borderColor}`, borderTop: 'none', borderBottom: 'none', p: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', bgcolor: secondaryHeaderBgColor }}>
                        I confirm that I have attended the site induction, understand the site rules and that I am not taking medication or drugs that could affect my concentration or safety on site
                    </Box>

                    {/* Signatures Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', bgcolor: headerBgColor }}>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
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
                            <GeneralFormTableRowControlsHeaderSpacer
                                downloading={downloading}
                                action={action}
                                borderColor={borderColor}
                                headerBgColor={headerBgColor}
                                accessLocked={!canEdit}
                            />
                        </Box>

                        {attendees.map((att, index) => (
                            <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < attendees.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.date} onChange={handleAttendeeChange(index, "date")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.name || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.name} onChange={handleAttendeeChange(index, "name")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {att.signature && (att.signature.startsWith('data:image/') || att.signature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={att.signature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!contentReadOnly && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newAttendees = attendees.map((a, i) => i === index ? { ...a, signature: '' } : a);
                                                    setAttendees(newAttendees);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        contentReadOnly ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{att.signature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                                <SignatureCapture
                                                    value={
                                                        att.signature && (att.signature.startsWith('data:image/') || att.signature.startsWith('http'))
                                                            ? att.signature
                                                            : null
                                                    }
                                                    onChange={(url) => {
                                                        const newAttendees = attendees.map((a, i) => (i === index ? { ...a, signature: url || '' } : a));
                                                        setAttendees(newAttendees);
                                                    }}
                                                    readOnly={contentReadOnly}
                                                    compact
                                                />
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '13%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.employedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.employedBy} onChange={handleAttendeeChange(index, "employedBy")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.occupation || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.occupation} onChange={handleAttendeeChange(index, "occupation")} />)}
                                </Box>

                                {/* Competency Card Yes/No */}
                                <Box sx={{ width: { xs: '100%', md: '10%' }, borderRight: `1px solid ${borderColor}` }}>
                                    <FormYesNoTickCells
                                        value={att.competencyCard}
                                        readOnly={contentReadOnly}
                                        isDarkMode={isDarkMode}
                                        borderColor={borderColor}
                                        onYes={() => setAttendeeCompetencyCard(index, "Yes")}
                                        onNo={() => setAttendeeCompetencyCard(index, "No")}
                                    />
                                </Box>

                                <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.cardDetails || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.cardDetails} onChange={handleAttendeeChange(index, "cardDetails")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' } }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{att.inductor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5, height: '100%', fontSize: '0.85rem' } }} value={att.inductor} onChange={handleAttendeeChange(index, "inductor")} />)}
                                </Box>
                            </Box>
                            <GeneralFormTableRowControls
                                downloading={downloading}
                                action={action}
                                rowIndex={index}
                                rowCount={attendees.length}
                                minRows={1}
                                maxRows={35}
                                borderColor={borderColor}
                                onInsertAfter={insertAttendeeAfter}
                                onRemoveAt={removeAttendeeAt}
                                accessLocked={!canEdit}
                            />
                            </Box>
                        ))}
                    </Box>

                                        {/* Signature Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6, mb: 2 }}>
                            <Box sx={{ width: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Box sx={{ width: '100%', borderBottom: `1px solid ${borderColor}`, mb: 1, pb: 1 }}>
                                    <SignatureCapture
                                        value={docInfo.signature || null}
                                        onChange={(url) => setDocInfo({ ...docInfo, signature: url || "" })}
                                        readOnly={contentReadOnly}
                                    />
                                </Box>
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
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `Site Induction - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
                templateFlow
                nameFieldLabel="Template name"
            />
        </Layout>
    );
}
