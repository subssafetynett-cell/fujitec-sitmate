import React, { useState, useEffect, useRef } from "react";
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

const FORM_TITLE = "LOLER Inspection Form";
const FORM_BASE_PATH = "/general-forms/loler-inspection-form";

/**
 * PDF: keep whole sections/rows together (no mid-row cuts) and omit the
 * branded page-chrome logos — those belong in the form left/right logo slots.
 */
const LOLER_PDF_OPTIONS = {
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

export default function LolerInspectionForm() {
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

    // Initial State Structure mapped from form image
    const [docInfo, setDocInfo] = useState({
        date: "",
        docNo: "",
        approvedBy: ""
    ,
        logo: ""
,
        logoRight: ""
    });

    const [topSection, setTopSection] = useState({
        projectName: "",
        projectManager: "",
        principalContractor: "",
        siteSupervisor: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "LOLER INSPECTION FORM",
        headerDateLabel: "Date",
        headerDocNoLabel: "Document No. & Rev",
        headerApprovedByLabel: "Approved by",
        projectName: "Project Name",
        projectManager: "Project Manager:",
        principalContractor: "Principal Contractor",
        siteSupervisor: "Site Supervisor",
        equipmentLabel: "Equipment Description",
        plantIdLabel: "Plant ID",
        swlLabel: "S.W.L LOLER",
        nextDateLabel: "Next Thorough Examination Date",
        mattersLabel: "Matters giving rise to health or safety risk",
        actionsLabel: "Details of action taken and any other action considered necessary"
    });

    const EMPTY_LOLER_ROW = {
        equipment: "",
        plantId: "",
        swl: "",
        nextDate: "",
        matters: "",
        actionTaken: "",
        safeToUse: "",
    };
    const [tableRows, setTableRows] = useState(() =>
        Array.from({ length: 10 }, () => ({ ...EMPTY_LOLER_ROW }))
    );
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
                topSection,
                headerLabels,
                tableRows,
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
        watchDeps: [docInfo, topSection, headerLabels, tableRows],
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
        fileBaseName: "LolerInspectionForm",
        pdfOptions: LOLER_PDF_OPTIONS,
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
                    if (submission.answers.topSection) setTopSection(submission.answers.topSection);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    if (submission.answers.tableRows) setTableRows(submission.answers.tableRows);
                    setFormMetadata({
                        name: submission.answers.name || `LOLER Inspection - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const updateTopSection = (field) => (e) => {
        setTopSection({ ...topSection, [field]: e.target.value });
    };

    const updateTableRow = (index, field, value) => {
        const newRows = [...tableRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setTableRows(newRows);
    };

    const insertLolerRowAfter = (index) => {
        setTableRows((rows) => {
            if (rows.length >= 40) return rows;
            const next = [...rows];
            next.splice(index + 1, 0, { ...EMPTY_LOLER_ROW });
            return next;
        });
    };
    const removeLolerRowAt = (index) => {
        setTableRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
    };

    const borderColor = isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.05)" : "#222222";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "6px 8px";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout pageTitle="LOLER Inspection Register">
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={navigateBack} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
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

            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
                <Paper 
                    ref={containerRef}
                    elevation={pdfLayout ? 0 : 3} 
                    sx={{ 
                        width: "100%", 
                        minWidth: pdfLayout ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: { xs: 2, md: 5 }, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none",
                        fontFamily: 'Arial, sans-serif'
                    }}
                >
                    {/* Form header box — repeated on every PDF page */}
                    <Box data-pdf-page-header sx={{ mb: pdfLayout ? 2 : 3 }}>
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
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{headerLabels.formTitle}</Typography>
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', input: { textAlign: 'center' } } }}
                                        value={headerLabels.formTitle}
                                        onChange={(e) => setHeaderLabels({...headerLabels, formTitle: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
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
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
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
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.headerApprovedByLabel}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={headerLabels.headerApprovedByLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, headerApprovedByLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding }}>Page 1 of 1</Box>
                            </Box>
                    </FormDocumentHeader>
                    </Box>

                    {/* Top Section */}
                    <Box data-pdf-block sx={{ border: `1px solid ${borderColor}`, mb: 3 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.projectName}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.projectName}
                                        onChange={(e) => setHeaderLabels({...headerLabels, projectName: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.projectName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.projectName} onChange={updateTopSection("projectName")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.projectManager}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.projectManager}
                                        onChange={(e) => setHeaderLabels({...headerLabels, projectManager: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0 }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.projectManager || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.projectManager} onChange={updateTopSection("projectManager")} />)}
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.principalContractor}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.principalContractor}
                                        onChange={(e) => setHeaderLabels({...headerLabels, principalContractor: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.principalContractor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.principalContractor} onChange={updateTopSection("principalContractor")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.siteSupervisor}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.siteSupervisor}
                                        onChange={(e) => setHeaderLabels({...headerLabels, siteSupervisor: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0 }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.siteSupervisor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.siteSupervisor} onChange={updateTopSection("siteSupervisor")} />)}
                            </Box>
                        </Box>
                        <Box sx={{ p: cellPadding, minHeight: '30px' }}></Box>
                    </Box>

                    {/* Table */}
                    <Box sx={{ border: `1px solid ${borderColor}` }}>
                        {/* Table Header */}
                        <Box data-pdf-block sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.equipmentLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.equipmentLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, equipmentLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.plantIdLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.plantIdLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, plantIdLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold', textAlign: 'center' }}>{headerLabels.swlLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        inputProps={{ style: { textAlign: 'center' } }}
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.swlLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, swlLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', textAlign: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold', textAlign: 'center' }}>{headerLabels.nextDateLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        inputProps={{ style: { textAlign: 'center' } }}
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.nextDateLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, nextDateLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', fontSize: '0.8rem' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem' }}>{headerLabels.mattersLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        inputProps={{ style: { textAlign: 'center' } }}
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', fontSize: '0.8rem' } }}
                                        value={headerLabels.mattersLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, mattersLabel: e.target.value})}
                                    />)
                                }
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>List damage / Defect or note none</Typography>
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', fontSize: '0.9rem' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold', fontSize: '0.9rem' }}>{headerLabels.actionsLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold', fontSize: '0.9rem' } }}
                                        value={headerLabels.actionsLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, actionsLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '10%' }, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ p: 1, borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontSize: '0.85rem' }}>Safe to use</Box>
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, flex: 1 }}>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, borderRight: `1px solid ${borderColor}`, p: 1, textAlign: 'center', fontSize: '0.85rem' }}>Yes</Box>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1, textAlign: 'center', fontSize: '0.85rem' }}>No</Box>
                                </Box>
                            </Box>
                            </Box>
                            <GeneralFormTableRowControlsHeaderSpacer
                                downloading={downloading}
                                action={action}
                                borderColor={borderColor}
                                headerBgColor={headerBgColor}
                                accessLocked={!canEdit}
                            />
                        </Box>

                        {/* Table Rows */}
                        {tableRows.map((row, index) => (
                            <Box
                                key={index}
                                data-pdf-block
                                sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < tableRows.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.equipment || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.equipment} onChange={e => updateTableRow(index, 'equipment', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.plantId || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.plantId} onChange={e => updateTableRow(index, 'plantId', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.swl || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.swl} onChange={e => updateTableRow(index, 'swl', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.nextDate || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.nextDate} onChange={e => updateTableRow(index, 'nextDate', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.matters || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.matters} onChange={e => updateTableRow(index, 'matters', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.actionTaken || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.actionTaken} onChange={e => updateTableRow(index, 'actionTaken', e.target.value)} />)}
                                </Box>

                                {/* Checkboxes for Safe to use */}
                                <Box sx={{ width: { xs: '100%', md: '10%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    <Box 
                                        onClick={() => updateTableRow(index, 'safeToUse', "Yes")}
                                        sx={{ 
                                            width: { xs: '100%', md: '50%' }, 
                                            borderRight: `1px solid ${borderColor}`, 
                                            display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            bgcolor: row.safeToUse === "Yes" ? '#666' : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <Box 
                                        onClick={() => updateTableRow(index, 'safeToUse', "No")}
                                        sx={{ 
                                            width: { xs: '100%', md: '50%' }, 
                                            display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            bgcolor: row.safeToUse === "No" ? '#666' : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </Box>
                            </Box>
                            <GeneralFormTableRowControls
                                downloading={downloading}
                                action={action}
                                rowIndex={index}
                                rowCount={tableRows.length}
                                minRows={1}
                                maxRows={40}
                                borderColor={borderColor}
                                onInsertAfter={insertLolerRowAfter}
                                onRemoveAt={removeLolerRowAt}
                                accessLocked={!canEdit}
                            />
                            </Box>
                        ))}
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
                defaultName={formMetadata.name || `LOLER Inspection - ${new Date().toLocaleDateString()}`}
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
