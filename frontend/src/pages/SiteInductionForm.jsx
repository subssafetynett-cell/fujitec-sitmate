import React, { useState, useEffect } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton,
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import {
    appendSitepackToAnswers,
    resolveFormCategoryFromSearchParams,
} from "../utils/sitepackContext";
import { saveGeneralFormResponse } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useRef } from "react";
import SignatureCapture from "../components/SignatureCapture";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import { useGeneralFormSaveNavigate } from "../hooks/useGeneralFormSaveNavigate";
import { appendTemplatesPageMetadata, templateSaveButtonLabel } from "../utils/templatePageContext";

const FORM_TITLE = "Site Induction Register";
const FORM_BASE_PATH = "/general-forms/site-induction";
import FormLogoUploadSlot from "../components/FormLogoUploadSlot";

export default function SiteInductionForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const [searchParams] = useSearchParams();
    const category = resolveFormCategoryFromSearchParams(searchParams);
    const action = searchParams.get("action");
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({
        name: "",
        tags: "",
        visibility: GENERAL_FORM_VISIBILITY.PRIVATE,
    });

    // Header Data
    const [docInfo, setDocInfo] = useState({
        date: "",
        docNo: "",
        approvedBy: "",
        logo: "",
        logoRight: "",
        signature: "",
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
        contractNo: "Contract no.",
        confirmationText:
            "I confirm that I have attended the site induction, understand the site rules and that I am not taking medication or drugs that could affect my concentration or safety on site",
        attendeeDateLabel: "Date",
        attendeeNameLabel: "Name",
        attendeeNameSubLabel: "(capitals)",
        attendeeSignatureLabel: "Signature",
        attendeeEmployedByLabel: "Employed by",
        attendeeEmployedBySubLabel:
            "(this column to be completed by Subcontractors only)",
        attendeeOccupationLabel: "Occupation",
        competencyHeader: "Approved competency card/ cert",
        competencySubLabel: "(i.e. CSCS/CPCS)",
        competencyYesLabel: "Yes",
        competencyNoLabel: "No",
        cardTypeLabel: "Type of card held",
        cardTypeSubLabel: "(Plus, Card number and Expiry Date)",
        inductorLabel: "Person giving induction",
    });
    
    // Grid Data for Signatures (10 rows)
    const [attendees, setAttendees] = useState(
        Array.from({ length: 10 }, () => ({ date: "", name: "", signature: "", employedBy: "", occupation: "", competencyCard: "", cardDetails: "", inductor: "" }))
    );

    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId } = useGeneralFormTemplateAccess(
        action,
        downloading,
        persistedSiteId,
        persistedSubfolderId
    );

    const navigateAfterFirstSave = useGeneralFormSaveNavigate(FORM_BASE_PATH);

    const performSave = async (
        asNew = false,
        name = "",
        tags = "",
        visibility = formMetadata.visibility
    ) => {
        if (!canEdit) return false;
        setSaving(true);
        try {
            let payload = {
                docInfo,
                headerData,
                headerLabels,
                attendees,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags,
            };
            payload = appendTemplatesPageMetadata(payload, searchParams, FORM_TITLE);
            payload = appendSitepackToAnswers(payload, { siteId, subfolderId, monitoringSection: searchParams.get("monitoringSection") });
            payload = withGeneralFormVisibility(payload, visibility, {
                hasSiteContext: Boolean(siteId),
            });

            const savedId = await saveGeneralFormResponse({
                formTitle: FORM_TITLE,
                persistedResponseId,
                asNew,
                payload,
                category,
            });
            navigateAfterFirstSave(savedId, asNew);

            setFormMetadata({
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags,
                visibility: payload.visibility ?? formMetadata.visibility,
            });
            return true;
        } catch (e) {
            console.error("Failed to save", e);
            alert("Failed to save the form.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const {
        navigateBack,
        finishSaveAndNavigate,
        resetDirty,
        UnsavedDialog,
    } = useGeneralFormLeave({
        enabled: canEdit && !downloading,
        loading,
        watchDeps: [docInfo, headerData, headerLabels, attendees],
        siteId,

        subfolderId,
        category,
        saving,
        canQuickSave: Boolean(persistedResponseId && formMetadata.name?.trim()),
        onQuickSave: () =>
            performSave(false, formMetadata.name, formMetadata.tags, formMetadata.visibility),
        onOpenSaveDialog: () => setSaveDialogOpen(true),
    });

    useEffect(() => {
        if (!persistedResponseId && !fromTemplateId) {
            setPersistedSiteId(null);
            setPersistedSubfolderId(null);
        }
    }, [persistedResponseId, fromTemplateId]);

    useEffect(() => {
        if (seedSubmissionId) {
            loadSubmission(seedSubmissionId);
        }
    }, [seedSubmissionId]);

    useEffect(() => {
        if (!loading && action === "download" && seedSubmissionId) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `SiteInduction_${seedSubmissionId}`, () => {
                    setDownloading(false);
                    // Close the newly opened tab
                    window.close();
                });
            }, 300);
        }
    }, [loading, action, seedSubmissionId]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            // Fetch responses user has submitted to populate this form
            const res = await api.get(`/forms/responses/${submissionId}`);
            if (res.data?.success) {
                const submission = res.data.data;
                if (submission && submission.answers) {
                    setPersistedSiteId(submission.answers.siteId ?? null);
                    setPersistedSubfolderId(submission.answers.subfolderId ?? null);
                    if (submission.answers.docInfo) setDocInfo(submission.answers.docInfo);
                    if (submission.answers.headerData) setHeaderData(submission.answers.headerData);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    if (submission.answers.attendees) setAttendees(submission.answers.attendees);
                    setFormMetadata({
                        name: submission.answers.name || `Site Induction - ${new Date(submission.createdAt).toLocaleDateString()}`,
                        tags: submission.answers.tags || "",
                        visibility: submission.answers.visibility || GENERAL_FORM_VISIBILITY.PUBLIC,
                    });
                    resetDirty();
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
        if (!canEdit) return;
        if (persistedResponseId) {
            setSaveDialogOpen(true);
        } else {
            executeSave(false);
        }
    };

    const executeSave = async (asNew = false, name = "", tags = "", visibility) => {
        if (!canEdit) return;
        const ok = await performSave(
            asNew,
            name,
            tags,
            visibility ?? formMetadata.visibility
        );
        if (ok) {
            setSaveDialogOpen(false);
            finishSaveAndNavigate();
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
                    <IconButton onClick={navigateBack} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        Site Induction Register
                    </Typography>
                </Box>
                {canEdit && (
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <GeneralFormSubmissionDeleteButton
                        responseId={persistedResponseId}
                        canEdit={canEdit}
                        isSitePackContext={Boolean(siteId)}
                        disabled={saving || downloading}
                    />
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
                        {templateSaveButtonLabel({ saving, downloading })}
                    </Button>
                </Box>
                )}
            </Box>

            <GeneralFormTemplateInfoBanner
                canEdit={canEdit}
                isSitePackContext={Boolean(siteId)}
                pdfLayout={downloading || action === 'download'}
            />

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
                            <FormLogoUploadSlot
                                imageSrc={docInfo.logo}
                                companyLogoUrl={logoUrl}
                                onImageChange={(url) => setDocInfo((prev) => ({ ...prev, logo: url }))}
                                readOnly={action === 'download'}
                                exportMode={downloading || action === 'download'}
                            />
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

                        {/* Right Logo / Upload */}
                        <Box
                            sx={{
                                width: { xs: '100%', md: '30%' },
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {docInfo.logoRight ? (
                                <>
                                    <Box
                                        component="img"
                                        src={docInfo.logoRight}
                                        alt="Uploaded Right Logo"
                                        sx={{
                                            width: { xs: '100%', md: '80%' },
                                            maxHeight: '100px',
                                            objectFit: 'contain',
                                            mb: (action !== 'download') ? 1 : 0,
                                        }}
                                    />
                                    {(action !== 'download') && (
                                        <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                            Change Logo
                                            <input
                                                type="file"
                                                hidden
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) =>
                                                            setDocInfo({ ...docInfo, logoRight: ev.target.result });
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </Button>
                                    )}
                                </>
                            ) : (
                                (action !== 'download') ? (
                                    <Button variant="outlined" component="label" size="small">
                                        Upload Logo
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) =>
                                                        setDocInfo({ ...docInfo, logoRight: ev.target.result });
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </Button>
                                ) : (
                                    <Typography variant="caption" color="text.secondary">No Logo</Typography>
                                )
                            )}
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
                        {(downloading || action === 'download') ? (
                            <Typography sx={{ fontWeight: 'bold' }}>{headerLabels.confirmationText}</Typography>
                        ) : (
                            <TextField
                                fullWidth
                                multiline
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: { color: textColor, textAlign: "center", input: { textAlign: "center" }, fontWeight: "bold" },
                                }}
                                value={headerLabels.confirmationText}
                                onChange={(e) => setHeaderLabels({ ...headerLabels, confirmationText: e.target.value })}
                            />
                        )}
                    </Box>

                    {/* Signatures Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', bgcolor: headerBgColor }}>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    headerLabels.attendeeDateLabel
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", input: { textAlign: "center" }, fontWeight: "bold" } }}
                                        value={headerLabels.attendeeDateLabel}
                                        onChange={(e) => setHeaderLabels({ ...headerLabels, attendeeDateLabel: e.target.value })}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    <>
                                        {headerLabels.attendeeNameLabel}
                                        <br />
                                        {headerLabels.attendeeNameSubLabel}
                                    </>
                                ) : (
                                    <TextField
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", textarea: { textAlign: "center", fontWeight: "bold" } } }}
                                        value={`${headerLabels.attendeeNameLabel}\n${headerLabels.attendeeNameSubLabel}`}
                                        onChange={(e) => {
                                            const [line1 = "", ...rest] = e.target.value.split("\n");
                                            setHeaderLabels({
                                                ...headerLabels,
                                                attendeeNameLabel: line1,
                                                attendeeNameSubLabel: rest.join(" ").trim() || headerLabels.attendeeNameSubLabel,
                                            });
                                        }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '12%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    headerLabels.attendeeSignatureLabel
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", input: { textAlign: "center" }, fontWeight: "bold" } }}
                                        value={headerLabels.attendeeSignatureLabel}
                                        onChange={(e) => setHeaderLabels({ ...headerLabels, attendeeSignatureLabel: e.target.value })}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '13%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    <>
                                        {headerLabels.attendeeEmployedByLabel}
                                        <br />
                                        <span style={{ color: '#FF6B6B', fontSize: '0.7rem' }}>
                                            {headerLabels.attendeeEmployedBySubLabel}
                                        </span>
                                    </>
                                ) : (
                                    <TextField
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", textarea: { textAlign: "center", fontWeight: "bold" } } }}
                                        value={`${headerLabels.attendeeEmployedByLabel}\n${headerLabels.attendeeEmployedBySubLabel}`}
                                        onChange={(e) => {
                                            const [line1 = "", ...rest] = e.target.value.split("\n");
                                            setHeaderLabels({
                                                ...headerLabels,
                                                attendeeEmployedByLabel: line1,
                                                attendeeEmployedBySubLabel: rest.join(" ").trim() || headerLabels.attendeeEmployedBySubLabel,
                                            });
                                        }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    headerLabels.attendeeOccupationLabel
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", input: { textAlign: "center" }, fontWeight: "bold" } }}
                                        value={headerLabels.attendeeOccupationLabel}
                                        onChange={(e) => setHeaderLabels({ ...headerLabels, attendeeOccupationLabel: e.target.value })}
                                    />
                                )}
                            </Box>
                            
                            <Box sx={{ width: { xs: '100%', md: '10%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: cellPadding, borderBottom: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
                                        <>
                                            {headerLabels.competencyHeader}
                                            <br />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>{headerLabels.competencySubLabel}</span>
                                        </>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            multiline
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { textAlign: "center", textarea: { textAlign: "center", fontWeight: "bold" } } }}
                                            value={`${headerLabels.competencyHeader}\n${headerLabels.competencySubLabel}`}
                                            onChange={(e) => {
                                                const [line1 = "", ...rest] = e.target.value.split("\n");
                                                setHeaderLabels({
                                                    ...headerLabels,
                                                    competencyHeader: line1,
                                                    competencySubLabel: rest.join(" ").trim() || headerLabels.competencySubLabel,
                                                });
                                            }}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, height: '25px' }}>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>
                                        {(downloading || action === 'download') ? headerLabels.competencyYesLabel : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                InputProps={{ disableUnderline: true, sx: { input: { textAlign: "center", color: '#FF6B6B', fontWeight: 700 } } }}
                                                value={headerLabels.competencyYesLabel}
                                                onChange={(e) => setHeaderLabels({ ...headerLabels, competencyYesLabel: e.target.value })}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>
                                        {(downloading || action === 'download') ? headerLabels.competencyNoLabel : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                InputProps={{ disableUnderline: true, sx: { input: { textAlign: "center", color: '#FF6B6B', fontWeight: 700 } } }}
                                                value={headerLabels.competencyNoLabel}
                                                onChange={(e) => setHeaderLabels({ ...headerLabels, competencyNoLabel: e.target.value })}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            </Box>

                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
                                    <>
                                        {headerLabels.cardTypeLabel}
                                        <br />
                                        <span style={{ fontSize: '0.7rem', fontWeight: 'normal', fontStyle: 'italic' }}>{headerLabels.cardTypeSubLabel}</span>
                                    </>
                                ) : (
                                    <TextField
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", textarea: { textAlign: "center", fontWeight: "bold" } } }}
                                        value={`${headerLabels.cardTypeLabel}\n${headerLabels.cardTypeSubLabel}`}
                                        onChange={(e) => {
                                            const [line1 = "", ...rest] = e.target.value.split("\n");
                                            setHeaderLabels({
                                                ...headerLabels,
                                                cardTypeLabel: line1,
                                                cardTypeSubLabel: rest.join(" ").trim() || headerLabels.cardTypeSubLabel,
                                            });
                                        }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding }}>
                                {(downloading || action === 'download') ? (
                                    headerLabels.inductorLabel
                                ) : (
                                    <TextField
                                        fullWidth
                                        multiline
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { textAlign: "center", textarea: { textAlign: "center", fontWeight: "bold" } } }}
                                        value={headerLabels.inductorLabel}
                                        onChange={(e) => setHeaderLabels({ ...headerLabels, inductorLabel: e.target.value })}
                                    />
                                )}
                            </Box>
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
                                    {typeof att.signature === 'string' && att.signature && (att.signature.startsWith('data:image/') || att.signature.startsWith('http')) ? (
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
                                            <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                                <SignatureCapture
                                                    value={
                                                        typeof att.signature === 'string' &&
                                                        att.signature &&
                                                        (att.signature.startsWith('data:image/') || att.signature.startsWith('http'))
                                                            ? att.signature
                                                            : null
                                                    }
                                                    onChange={(url) => {
                                                        const newAttendees = attendees.map((a, i) =>
                                                            i === index ? { ...a, signature: url || "" } : a
                                                        );
                                                        setAttendees(newAttendees);
                                                    }}
                                                    readOnly={false}
                                                    compact
                                                />
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
                                <Box sx={{ width: '100%', borderBottom: `1px solid ${borderColor}`, mb: 1, pb: 1 }}>
                                    <SignatureCapture
                                        value={docInfo.signature || null}
                                        onChange={(url) => setDocInfo({ ...docInfo, signature: url || "" })}
                                        readOnly={downloading || action === 'download'}
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
                defaultVisibility={formMetadata.visibility}
                showVisibilityChoice={!siteId}
                saving={saving}
                templateFlow={!siteId}
                isSitePackContext={Boolean(siteId)}
                nameFieldLabel={siteId ? "Form name" : "Template name"}
            />
            {UnsavedDialog}
        </Layout>
    );
}
