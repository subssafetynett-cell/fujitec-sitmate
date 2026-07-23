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
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import api from "../services/api";
import {
    appendSitepackToAnswers,
    resolveFormCategoryFromSearchParams,
} from "../utils/sitepackContext";
import { saveGeneralFormResponse } from "../services/formUtils";
import { useGeneralFormExportDownload } from "../hooks/useGeneralFormExportDownload";
import { useRef } from "react";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormEditableParagraph from "../components/FormEditableParagraph";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";
import FormTableCellTextField from "../components/FormTableCellTextField";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import { useGeneralFormSaveNavigate } from "../hooks/useGeneralFormSaveNavigate";
import {
    appendTemplatesPageMetadata,
    templateSaveButtonLabel,
    isTemplatesPageEditContext,
    isContextualFormFill,
} from "../utils/templatePageContext";
import brandLogoLeftUrl from "../assets/pdf-logo-left.png";
import brandLogoRightUrl from "../assets/pdf-logo-right.png";

const DEFAULT_BRIEFING_LABELS = {
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
    inducteeJobTitle: "Job Title",
    confirmReadParagraph:
        "I confirm that I have read and understand the requirements of this method statement and associated risk assessments and have communicated them to operatives/persons under my control and to those who may be affected by its requirements.",
    ramsReceiveParagraph:
        "I hereby confirm that I have received, read and fully understood the approved site Risk Assessment & Method Statement (RAMS) and sign to say that I fully agree to adhere to the contents of the method statement(s) and the associated risk assessments.",
    siteInductionParagraph:
        "I have attended a site induction/briefing that explained the general site rules and necessary site specific arrangements",
    sigTableDocumentTitle: "Document Title",
    sigTableDate: "Date",
    sigTableInductee: "Signature of Inductee",
    sigTableInductor: "Signature of Inductor",
    declarationTitle: "Declaration Statement",
    declarationBody:
        "By signing above, I confirm that I will work safely in accordance with the above documentation, attend weekly toolbox talks and training, follow site rules as per site induction and shall be responsible for my own health and safety as well as that of others and shall report any concerns immediately to the Site Person in charge",
    clarificationNote:
        "If you have any doubt about information given or contained in this method statement – ask for clarification.",
};

const FORM_TITLE = "RAMS Briefing Form";
const FORM_BASE_PATH = "/general-forms/rams-briefing";

/**
 * PDF: keep whole sections/rows together (no mid-row cuts) and omit the
 * branded page-chrome logos — those belong in the form left/right logo slots.
 */
const RAMS_BRIEFING_PDF_OPTIONS = {
    paginateBlocks: true,
    skipBrandLogos: true,
    skipBuiltInFooter: true,
    marginX: 8,
    headerInsetMm: 4,
    footerInsetMm: 10,
    blockGapMm: 0,
    blockScale: 1.75,
    jpegQuality: 0.82,
};

export default function RamsBriefingForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const navigate = useNavigate();
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
    });
    const [briefingData, setBriefingData] = useState({
        personConducting: "",
        jobTitle: "",
        projectName: "",
        principalContractor: "",
        inducteeName: "",
        inducteeJobTitle: ""
    });

    const [briefingLabels, setBriefingLabels] = useState(() => ({ ...DEFAULT_BRIEFING_LABELS }));
    
    const EMPTY_SIG_ROW = { documentTitle: "", date: "", signatureInductee: "", signatureInductor: "" };
    const [signatures, setSignatures] = useState(() =>
        Array.from({ length: 15 }, () => ({ ...EMPTY_SIG_ROW }))
    );
    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId, pdfLayout, contentReadOnly, isSitePackContext } = useGeneralFormTemplateAccess(action, downloading, persistedSiteId, persistedSubfolderId);
    /** Site pack / template fill: always allow typing in data cells (not label-only template edit). */
    const canFillFields =
        !pdfLayout &&
        (canEdit ||
            isSitePackContext ||
            Boolean(fromTemplateId) ||
            isContextualFormFill(searchParams));
    /** General Forms template edit: editable boilerplate sentences and labels. */
    const canEditTemplateText = canEdit && !isSitePackContext && !pdfLayout;

    const navigateAfterFirstSave = useGeneralFormSaveNavigate(FORM_BASE_PATH);

    const performSave = async (
        asNew = false,
        name = "",
        tags = "",
        visibility = formMetadata.visibility
    ) => {
        setSaving(true);
        try {
            let payload = {
                docInfo,
                briefingData,
                briefingLabels,
                signatures,
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

    const { navigateBack, finishSaveAndNavigate, resetDirty, UnsavedDialog } = useGeneralFormLeave({
        enabled: canEdit && !downloading,
        loading,
        watchDeps: [docInfo, briefingData, briefingLabels, signatures],
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

    useGeneralFormExportDownload({
        action,
        loading,
        docKey: persistedResponseId || seedSubmissionId,
        containerRef,
        fileBaseName: "RAMSBriefing",
        pdfOptions: RAMS_BRIEFING_PDF_OPTIONS,
        setDownloading,
    });

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get(`/forms/responses/${submissionId}`);
            if (res.data?.success) {
                const submission = res.data.data;
                if (submission && submission.answers) {
                    setPersistedSiteId(submission.answers.siteId ?? null);
                    setPersistedSubfolderId(submission.answers.subfolderId ?? null);
                    if (submission.answers.docInfo) setDocInfo(submission.answers.docInfo);
                    if (submission.answers.briefingData) setBriefingData(submission.answers.briefingData);
                    if (submission.answers.briefingLabels) {
                        setBriefingLabels({ ...DEFAULT_BRIEFING_LABELS, ...submission.answers.briefingLabels });
                    }
                    if (submission.answers.signatures) setSignatures(submission.answers.signatures);
                    setFormMetadata({
                        name: submission.answers.name || `RAMS Briefing - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const handleBriefingChange = (field) => (e) => {
        setBriefingData({ ...briefingData, [field]: e.target.value });
    };

    const handleSignatureChange = (index, field) => (e) => {
        const newSignatures = [...signatures];
        newSignatures[index] = { ...newSignatures[index], [field]: e.target.value };
        setSignatures(newSignatures);
    };

    const insertSignatureAfter = (index) => {
        setSignatures((s) => {
            if (s.length >= 40) return s;
            const next = [...s];
            next.splice(index + 1, 0, { ...EMPTY_SIG_ROW });
            return next;
        });
    };
    const removeSignatureAt = (index) => {
        setSignatures((s) => (s.length <= 1 ? s : s.filter((_, i) => i !== index)));
    };

    const handleSaveClick = () => {
        setSaveDialogOpen(true);
    };

    const executeSave = async (asNew = false, name = "", tags = "", visibility) => {
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

    // Styling configurations to match light/dark modes
    const borderColor = "#CCC";
    const cellPadding = "8px 12px";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={navigateBack} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        RAMS Briefing Form
                    </Typography>
                </Box>
                {canEdit && (
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <GeneralFormSubmissionDeleteButton
                        responseId={persistedResponseId}
                        canEdit={canEdit}
                        isSitePackContext={isSitePackContext}
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
                isSitePackContext={isSitePackContext}
                pdfLayout={pdfLayout}
            />

            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
                {/* Form Container */}
                <Paper 
                    ref={containerRef}
                    elevation={pdfLayout ? 0 : 3} 
                    sx={{ 
                        width: "100%", 
                        minWidth: pdfLayout ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: 4, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none",
                        boxShadow: pdfLayout ? "none" : undefined
                    }}
                >
                    {/* Form header box — repeated on every PDF page */}
                    <Box data-pdf-page-header sx={{ mb: pdfLayout ? 2 : 4 }}>
                    <FormDocumentHeader
                        borderColor={borderColor}
                        readOnly={contentReadOnly}
                        exportMode={pdfLayout}
                        leftImageSrc={docInfo.logo}
                        leftCompanyLogoUrl={logoUrl || brandLogoLeftUrl}
                        onLeftImageChange={(url) => setDocInfo((prev) => ({ ...prev, logo: url }))}
                        rightImageSrc={docInfo.logoRight}
                        rightCompanyLogoUrl={logoUrl || brandLogoRightUrl}
                        onRightImageChange={(url) => setDocInfo((prev) => ({ ...prev, logoRight: url }))}
                        sx={{ mb: 0 }}
                    >
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (
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
                                    {contentReadOnly ? (
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <FormHeaderApprovedRow
                                borderColor={borderColor}
                                contentReadOnly={contentReadOnly}
                                pdfLayout={pdfLayout}
                                label={briefingLabels.headerApprovedBy}
                                onLabelChange={(e) => setBriefingLabels({ ...briefingLabels, headerApprovedBy: e.target.value })}
                                value={docInfo.approvedBy}
                                onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                                valueTextColor={isDarkMode ? "#F9FAFB" : "#111827"}
                                pageText="Page 1 of 1"
                            />
                    </FormDocumentHeader>
                    </Box>

                    {/* Form Title */}
                    <Box data-pdf-block sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                        {!canEditTemplateText ? (
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
                    <Box data-pdf-block sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, mb: 3 }}>
                        {[
                            { key: "personConducting" },
                            { key: "jobTitle" },
                            { key: "projectName" },
                            { key: "principalContractor" }
                        ].map((row, index) => (
                            <Box key={row.key} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 3 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    {!canEditTemplateText ? 
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
                                    {!canFillFields ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingData[row.key] || ' '}</Typography>) : (<TextField multiline 
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

                    <Box data-pdf-block sx={{ mb: 3 }}>
                    <FormEditableParagraph
                        value={briefingLabels.confirmReadParagraph}
                        onChange={(e) => setBriefingLabels({ ...briefingLabels, confirmReadParagraph: e.target.value })}
                        readOnly={!canEditTemplateText}
                        isDarkMode={isDarkMode}
                        minRows={3}
                        sx={{ mb: 0 }}
                    />
                    </Box>

                    {/* Briefing Info Table 2 */}
                    <Box data-pdf-block sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, mb: 3 }}>
                        {[
                            { key: "inducteeName" },
                            { key: "inducteeJobTitle" }
                        ].map((row, index) => (
                            <Box key={row.key} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                    {!canEditTemplateText ? 
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
                                    {!canFillFields ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingData[row.key] || ' '}</Typography>) : (<TextField multiline 
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

                    <Box data-pdf-block sx={{ mb: 2 }}>
                    <FormEditableParagraph
                        value={briefingLabels.ramsReceiveParagraph}
                        onChange={(e) => setBriefingLabels({ ...briefingLabels, ramsReceiveParagraph: e.target.value })}
                        readOnly={!canEditTemplateText}
                        isDarkMode={isDarkMode}
                        minRows={3}
                        sx={{ mb: 0 }}
                    />
                    </Box>
                    <Box data-pdf-block sx={{ mb: 3 }}>
                    <FormEditableParagraph
                        value={briefingLabels.siteInductionParagraph}
                        onChange={(e) => setBriefingLabels({ ...briefingLabels, siteInductionParagraph: e.target.value })}
                        readOnly={!canEditTemplateText}
                        isDarkMode={isDarkMode}
                        minRows={2}
                        sx={{ mb: 0 }}
                    />
                    </Box>

                    {/* Signatures Table */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                        <Box data-pdf-block sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            {[
                                { key: "sigTableDocumentTitle", width: "40%", borderRight: true },
                                { key: "sigTableDate", width: "20%", borderRight: true },
                                { key: "sigTableInductee", width: "20%", borderRight: true },
                                { key: "sigTableInductor", width: "20%", borderRight: false },
                            ].map(({ key, width, borderRight: hasBorder }) => (
                                <Box
                                    key={key}
                                    sx={{
                                        width: { xs: "100%", md: width },
                                        p: cellPadding,
                                        ...(hasBorder ? { borderRight: `1px solid ${borderColor}` } : {}),
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                    }}
                                >
                                    {canEditTemplateText ? (
                                        <TextField
                                            fullWidth
                                            multiline
                                            variant="standard"
                                            InputProps={{
                                                disableUnderline: true,
                                                sx: {
                                                    fontWeight: "bold",
                                                    textAlign: "center",
                                                    input: { textAlign: "center" },
                                                    color: isDarkMode ? "#F9FAFB" : "#111827",
                                                },
                                            }}
                                            value={briefingLabels[key]}
                                            onChange={(e) => setBriefingLabels({ ...briefingLabels, [key]: e.target.value })}
                                        />
                                    ) : (
                                        <Typography sx={{ fontWeight: "bold", whiteSpace: "pre-line" }}>
                                            {briefingLabels[key]}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                            </Box>
                            <GeneralFormTableRowControlsHeaderSpacer
                                downloading={downloading}
                                action={action}
                                borderColor={borderColor}
                                headerBgColor={isDarkMode ? "rgba(255,255,255,0.06)" : "#F9FAFB"}
                                accessLocked={!canEdit}
                            />
                        </Box>

                        {signatures.map((sig, index) => (
                            <Box
                                key={index}
                                data-pdf-block
                                sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < signatures.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box
                                    sx={{
                                        width: { xs: "100%", md: "40%" },
                                        borderRight: `1px solid ${borderColor}`,
                                        display: "flex",
                                        alignItems: "stretch",
                                        minHeight: 100,
                                    }}
                                >
                                    <FormTableCellTextField
                                        value={sig.documentTitle}
                                        onChange={handleSignatureChange(index, "documentTitle")}
                                        readOnly={!canFillFields}
                                        placeholder="Document title"
                                        isDarkMode={isDarkMode}
                                        minRows={2}
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        width: { xs: "100%", md: "20%" },
                                        borderRight: `1px solid ${borderColor}`,
                                        display: "flex",
                                        alignItems: "stretch",
                                        minHeight: 100,
                                    }}
                                >
                                    <FormTableCellTextField
                                        value={sig.date}
                                        onChange={handleSignatureChange(index, "date")}
                                        readOnly={!canFillFields}
                                        placeholder="Date"
                                        isDarkMode={isDarkMode}
                                        minRows={2}
                                    />
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {sig.signatureInductee && (sig.signatureInductee.startsWith('data:image/') || sig.signatureInductee.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={sig.signatureInductee} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {canFillFields && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductee: '' } : s);
                                                    setSignatures(newSigs);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        !canFillFields ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{sig.signatureInductee || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                                <SignatureCapture
                                                    value={
                                                        sig.signatureInductee &&
                                                        (sig.signatureInductee.startsWith('data:image/') || sig.signatureInductee.startsWith('http'))
                                                            ? sig.signatureInductee
                                                            : null
                                                    }
                                                    onChange={(url) => {
                                                        const newSigs = signatures.map((s, i) =>
                                                            i === index ? { ...s, signatureInductee: url || '' } : s
                                                        );
                                                        setSignatures(newSigs);
                                                    }}
                                                    readOnly={!canFillFields}
                                                    compact
                                                />
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, display: 'flex', alignItems: 'center' }}>
                                    {sig.signatureInductor && (sig.signatureInductor.startsWith('data:image/') || sig.signatureInductor.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={sig.signatureInductor} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {canFillFields && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newSigs = signatures.map((s, i) => i === index ? { ...s, signatureInductor: '' } : s);
                                                    setSignatures(newSigs);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        !canFillFields ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{sig.signatureInductor || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                                <SignatureCapture
                                                    value={
                                                        sig.signatureInductor &&
                                                        (sig.signatureInductor.startsWith('data:image/') || sig.signatureInductor.startsWith('http'))
                                                            ? sig.signatureInductor
                                                            : null
                                                    }
                                                    onChange={(url) => {
                                                        const newSigs = signatures.map((s, i) =>
                                                            i === index ? { ...s, signatureInductor: url || '' } : s
                                                        );
                                                        setSignatures(newSigs);
                                                    }}
                                                    readOnly={!canFillFields}
                                                    compact
                                                />
                                            </Box>
                                        )
                                    )}
                                </Box>
                            </Box>
                            <GeneralFormTableRowControls
                                downloading={downloading}
                                action={action}
                                rowIndex={index}
                                rowCount={signatures.length}
                                minRows={1}
                                maxRows={40}
                                borderColor={borderColor}
                                onInsertAfter={insertSignatureAfter}
                                onRemoveAt={removeSignatureAt}
                                accessLocked={!canEdit}
                            />
                            </Box>
                        ))}
                    </Box>

                    {/* Declaration Statement */}
                    <Box data-pdf-block sx={{ mt: 4 }}>
                        {canEditTemplateText ? (
                            <TextField
                                fullWidth
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: { fontWeight: "bold", fontSize: "1rem", mb: 0.5, color: isDarkMode ? "#F9FAFB" : "#111827" },
                                }}
                                value={briefingLabels.declarationTitle}
                                onChange={(e) => setBriefingLabels({ ...briefingLabels, declarationTitle: e.target.value })}
                                sx={{ mb: 1 }}
                            />
                        ) : (
                            <Typography sx={{ fontWeight: "bold", fontSize: "1rem", mb: 0.5 }}>
                                {briefingLabels.declarationTitle}
                            </Typography>
                        )}
                        <FormEditableParagraph
                            value={briefingLabels.declarationBody}
                            onChange={(e) => setBriefingLabels({ ...briefingLabels, declarationBody: e.target.value })}
                            readOnly={!canEditTemplateText}
                            isDarkMode={isDarkMode}
                            minRows={4}
                            sx={{ fontStyle: canEditTemplateText ? "normal" : "italic", mb: 3 }}
                        />
                        <FormEditableParagraph
                            value={briefingLabels.clarificationNote}
                            onChange={(e) => setBriefingLabels({ ...briefingLabels, clarificationNote: e.target.value })}
                            readOnly={!canEditTemplateText}
                            isDarkMode={isDarkMode}
                            minRows={2}
                            sx={{ fontWeight: canEditTemplateText ? "normal" : "bold", fontSize: "0.95rem" }}
                        />
                    </Box>

                    {/* Signature Section */}
                    <Box data-pdf-block sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6, mb: 2, px: 2 }}>
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

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `RAMS Briefing - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                defaultVisibility={formMetadata.visibility}
                showVisibilityChoice={isTemplatesPageEditContext(searchParams)}
                saving={saving}
                templateFlow={isTemplatesPageEditContext(searchParams)}
                isSitePackContext={isSitePackContext}
                nameFieldLabel={isTemplatesPageEditContext(searchParams) ? "Template name" : "Form name"}
            />
            {UnsavedDialog}
        </Layout>
    );
}
