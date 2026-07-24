import React, { useState, useEffect, useRef } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton, 
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import api from "../services/api";
import {
    appendSitepackToAnswers,
    resolveFormCategoryFromSearchParams,
} from "../utils/sitepackContext";
import { saveGeneralFormResponse } from "../services/formUtils";
import { useGeneralFormExportDownload } from "../hooks/useGeneralFormExportDownload";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import FormDocumentHeader from "../components/FormDocumentHeader";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import { useGeneralFormSaveNavigate } from "../hooks/useGeneralFormSaveNavigate";
import { appendTemplatesPageMetadata, templateSaveButtonLabel, isTemplatesPageEditContext} from "../utils/templatePageContext";
import brandLogoLeftUrl from "../assets/pdf-logo-left.png";
import brandLogoRightUrl from "../assets/pdf-logo-right.png";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";
import {
    pdfColWidth,
    pdfFlexRow,
} from "../utils/pdfFormLayout";

const FORM_TITLE = "Audit Action Form";
const FORM_BASE_PATH = "/general-forms/audit-action-form";

/**
 * PDF: keep whole sections/rows together (no mid-row cuts) and omit the
 * branded page-chrome logos — those belong in the form left/right logo slots.
 */
const AUDIT_ACTION_PDF_OPTIONS = {
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

export default function AuditActionForm() {
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

    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId, pdfLayout, contentReadOnly } = useGeneralFormTemplateAccess(action, downloading, persistedSiteId, persistedSubfolderId);

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
                formData,
                headerLabels,
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
        watchDeps: [docInfo, formData, headerLabels],
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
        fileBaseName: "AuditAction",
        pdfOptions: AUDIT_ACTION_PDF_OPTIONS,
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
                    if (submission.answers.formData) setFormData(submission.answers.formData);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    setFormMetadata({
                        name: submission.answers.name || `Audit Action - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const updateField = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const borderColor = pdfLayout ? "#CCC" : isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = pdfLayout ? "#E5E7EB" : isDarkMode ? "rgba(255,255,255,0.05)" : "#E5E7EB";
    const textColor = pdfLayout ? "#111827" : isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "8px 12px";
    const pdfTextSx = {
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        px: 1,
        py: 1,
        minHeight: '1.5em',
    };

    const renderScreenHeader = (pageNum) => (
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
            {pageNum === 1 ? (
                <>
                    <Box sx={pdfFlexRow(pdfLayout, { alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` })}>
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
                    <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                        <Box sx={pdfColWidth(pdfLayout, "40%", { p: 1, borderRight: `1px solid ${borderColor}` })}>
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
                        <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0 })}>
                            {contentReadOnly ? (<Typography sx={pdfTextSx}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                        </Box>
                    </Box>
                    <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                        <Box sx={pdfColWidth(pdfLayout, "40%", { p: 1, borderRight: `1px solid ${borderColor}` })}>
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
                        <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0 })}>
                            {contentReadOnly ? (<Typography sx={pdfTextSx}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                        </Box>
                    </Box>
                </>
            ) : (
                <>
                    <Box sx={pdfFlexRow(pdfLayout, { alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` })}>
                        AUDIT ACTION FORM
                    </Box>
                    <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                        <Box sx={pdfColWidth(pdfLayout, "40%", { p: 1, borderRight: `1px solid ${borderColor}` })}>Date</Box>
                        <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0 })}>
                            {contentReadOnly ? (<Typography sx={pdfTextSx}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                        </Box>
                    </Box>
                    <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                        <Box sx={pdfColWidth(pdfLayout, "40%", { p: 1, borderRight: `1px solid ${borderColor}` })}>Document No. & Rev</Box>
                        <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0 })}>
                            {contentReadOnly ? (<Typography sx={pdfTextSx}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                        </Box>
                    </Box>
                </>
            )}
            <FormHeaderApprovedRow
                borderColor={borderColor}
                contentReadOnly={contentReadOnly}
                pdfLayout={pdfLayout}
                label={headerLabels.headerApprovedByLabel}
                onLabelChange={(e) => setHeaderLabels({ ...headerLabels, headerApprovedByLabel: e.target.value })}
                value={docInfo.approvedBy}
                onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                valueTextColor={textColor}
                pageText={`Page ${pageNum} of 2`}
            />
        </FormDocumentHeader>
    );

    if (loading) return <Layout><Box sx={{display: 'flex', justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={navigateBack} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        Audit Action Form
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
                pdfLayout={pdfLayout}
            />

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 8,
                    overflowX: pdfLayout ? 'visible' : 'auto',
                    px: pdfLayout ? 0 : { xs: 2, md: 0 },
                }}
            >
                <Paper 
                    ref={containerRef}
                    elevation={pdfLayout ? 0 : 3}
                    className={pdfLayout ? "pdf-export-root" : undefined}
                    sx={{ 
                        width: pdfLayout ? "1000px" : "100%",
                        minWidth: pdfLayout ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: pdfLayout ? 2 : 4, 
                        bgcolor: pdfLayout ? "#FFFFFF" : isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none",
                        boxShadow: pdfLayout ? "none" : undefined,
                    }}
                >
                    {/* Form header box — captured once and drawn on every PDF page */}
                    <Box data-pdf-page-header sx={{ mb: pdfLayout ? 2 : 4 }}>
                        {renderScreenHeader(1)}
                    </Box>

                    {/* Table 1 — each row is a complete bordered PDF block */}
                    <Box sx={{ mb: pdfLayout ? 3 : 8 }}>
                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                bgcolor: headerBgColor,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { p: 0, borderRight: `1px solid ${borderColor}` })}>
                                {contentReadOnly ? 
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
                            <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0, textAlign: 'left' })}>
                                {contentReadOnly ? 
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
                        
                        <Box
                            data-pdf-block
                            sx={{
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                minHeight: pdfLayout ? undefined : 300,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
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
                            <Box sx={{ flex: 1, px: 1, pb: 1, width: '100%', boxSizing: 'border-box' }}>
                                {contentReadOnly ? (<Typography sx={{ ...pdfTextSx, width: '100%' }}>{formData.detailsOfObservation || ' '}</Typography>) : (<TextField fullWidth multiline minRows={8} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.detailsOfObservation} onChange={updateField("detailsOfObservation")} />)}
                            </Box>
                        </Box>

                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}`, minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.raisedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.raisedBy} onChange={updateField("raisedBy")} />)}
                            </Box>
                            <Box sx={pdfColWidth(pdfLayout, "60%", { display: 'flex', flexDirection: 'column', minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.agreedWithObs || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.agreedWithObs} onChange={updateField("agreedWithObs")} />)}
                            </Box>
                        </Box>

                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                bgcolor: headerBgColor,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { p: 0, borderRight: `1px solid ${borderColor}` })}>
                                {contentReadOnly ? 
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
                            <Box sx={pdfColWidth(pdfLayout, "60%", { p: cellPadding })}></Box>
                        </Box>

                        <Box
                            data-pdf-block
                            sx={{
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                minHeight: pdfLayout ? undefined : 300,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <Box sx={{ flex: 1, p: 1, width: '100%', boxSizing: 'border-box' }}>
                                {contentReadOnly ? (<Typography sx={{ ...pdfTextSx, width: '100%' }}>{formData.proposedAction || ' '}</Typography>) : (<TextField fullWidth multiline minRows={8} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.proposedAction} onChange={updateField("proposedAction")} />)}
                            </Box>
                        </Box>

                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}`, minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.agreedWithAct || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, pb: 1 } }} value={formData.agreedWithAct} onChange={updateField("agreedWithAct")} />)}
                            </Box>
                            <Box sx={pdfColWidth(pdfLayout, "60%", { display: 'flex', flexDirection: 'column', minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', width: '100%', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.dateForCompletion || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, pb: 1 } }} value={formData.dateForCompletion} onChange={updateField("dateForCompletion")} />)}
                            </Box>
                        </Box>
                    </Box>

                    {!pdfLayout && <Box sx={{ height: '40px' }}></Box>}

                    {!pdfLayout && (
                        <Box sx={{ mb: 4 }}>
                            {renderScreenHeader(2)}
                        </Box>
                    )}

                    {/* Follow Up Action Table */}
                    <Box sx={{ mb: 4 }}>
                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                bgcolor: headerBgColor,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { p: 0, borderRight: `1px solid ${borderColor}` })}>
                                {contentReadOnly ? 
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
                            <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0, textAlign: 'left' })}>
                                {contentReadOnly ? 
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
                        
                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                alignItems: 'stretch',
                                minHeight: pdfLayout ? undefined : 200,
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "40%", { display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}`, minWidth: 0 })}>
                                <Box sx={{ p: 0, borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.auditedBy}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.auditedBy}
                                            onChange={(e) => setHeaderLabels({...headerLabels, auditedBy: e.target.value})}
                                        />)
                                    }
                                    {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.auditedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditedBy} onChange={updateField("auditedBy")} />)}
                                </Box>
                                <Box sx={{ p: 0 }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.dateLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.dateLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, dateLabel: e.target.value})}
                                        />)
                                    }
                                    {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.auditDate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditDate} onChange={updateField("auditDate")} />)}
                                </Box>
                            </Box>
                            <Box sx={pdfColWidth(pdfLayout, "60%", { display: 'flex', flexDirection: 'column', minWidth: 0 })}>
                                <Box sx={{ p: 0, borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sigLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.sigLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, sigLabel: e.target.value})}
                                        />)
                                    }
                                    {contentReadOnly ? (<Typography sx={pdfTextSx}>{formData.auditSignature || ' '}</Typography>) : (<TextField fullWidth multiline minRows={4} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2 } }} value={formData.auditSignature} onChange={updateField("auditSignature")} />)}
                                </Box>
                                <Box sx={{ flex: 1, p: 1 }}>
                                    {contentReadOnly ? (<Typography sx={{ ...pdfTextSx, width: '100%' }}>{formData.followUpAction || ' '}</Typography>) : (<TextField fullWidth multiline minRows={4} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2, pb: 1, height: '100%' } }} value={formData.followUpAction} onChange={updateField("followUpAction")} placeholder="Follow up notes..." />)}
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    {/* Audit Report Continuation */}
                    <Box>
                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                borderBottom: 'none',
                                bgcolor: headerBgColor,
                                fontWeight: 'bold',
                                alignItems: 'stretch',
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "60%", { p: 0, borderRight: `1px solid ${borderColor}` })}>
                                {contentReadOnly ? 
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
                            <Box sx={pdfColWidth(pdfLayout, "40%", { p: cellPadding })}>
                                PAGE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; OF &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                            </Box>
                        </Box>
                        
                        <Box
                            data-pdf-block
                            sx={pdfFlexRow(pdfLayout, {
                                border: `1px solid ${borderColor}`,
                                alignItems: 'stretch',
                                minHeight: pdfLayout ? undefined : 500,
                            })}
                        >
                            <Box sx={pdfColWidth(pdfLayout, "50%", { display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}`, minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                <Box sx={{ flex: 1, p: 1, width: '100%', boxSizing: 'border-box' }}>
                                    {contentReadOnly ? (<Typography sx={{ ...pdfTextSx, width: '100%' }}>{formData.auditSummary || ' '}</Typography>) : (<TextField fullWidth multiline minRows={18} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.auditSummary} onChange={updateField("auditSummary")} />)}
                                </Box>
                            </Box>
                            <Box sx={pdfColWidth(pdfLayout, "50%", { display: 'flex', flexDirection: 'column', minWidth: 0 })}>
                                <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
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
                                <Box sx={{ flex: 1, p: 1, width: '100%', boxSizing: 'border-box' }}>
                                    {contentReadOnly ? (<Typography sx={{ ...pdfTextSx, width: '100%' }}>{formData.clause || ' '}</Typography>) : (<TextField fullWidth multiline minRows={18} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, height: '100%' } }} value={formData.clause} onChange={updateField("clause")} />)}
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <Box data-pdf-block sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6, mb: 2 }}>
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
                defaultName={formMetadata.name || `Audit Action - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                defaultVisibility={formMetadata.visibility}
                showVisibilityChoice={isTemplatesPageEditContext(searchParams)}
                saving={saving}
                templateFlow={isTemplatesPageEditContext(searchParams)}
                isSitePackContext={Boolean(siteId)}
                nameFieldLabel={isTemplatesPageEditContext(searchParams) ? "Template name" : "Form name"}
            />
            {UnsavedDialog}
        </Layout>
    );
}
