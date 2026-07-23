import React, { useState, useEffect } from "react";
import { 
    Box, Typography, Button, Paper, TextField, Table, TableBody, 
    TableCell, TableHead, TableRow, TableContainer, CircularProgress, 
    IconButton, 
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import GeneralFormTableRowControls from "../components/GeneralFormTableRowControls";
import { Download, ArrowLeft } from "lucide-react";
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
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import FormDocumentHeader from "../components/FormDocumentHeader";
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
import { pdfColWidth, pdfFlexRow } from "../utils/pdfFormLayout";

const FORM_TITLE = "Tool Box Talk Register";
const FORM_BASE_PATH = "/general-forms/tool-box-talk";

const ATTENDEE_COL = {
    index: "5%",
    name: "35%",
    signature: "35%",
    date: "25%",
};

const LEGACY_ATTENDEE_DISCLAIMER =
    "The undersigned have been fully briefed on the contents of the attached Tool Box Talk and will ensure they work to the agreed safe system of work in place at all times and shall raise any concerns directly with the Site Supervisor or Construct Lifts Installation Director.";

/**
 * PDF: keep whole sections/rows together (no mid-row cuts) and omit the
 * branded page-chrome logos — those belong in the form left/right logo slots.
 */
const TOOLBOX_TALK_PDF_OPTIONS = {
    paginateBlocks: true,
    skipBrandLogos: true,
    skipBuiltInFooter: true,
    marginX: 10,
    headerInsetMm: 4,
    footerInsetMm: 12,
    blockGapMm: 0,
    blockScale: 1.75,
    jpegQuality: 0.82,
};

const DEFAULT_HEADER_LABELS = {
    formTitle: "TOOL BOX TALK REGISTER",
    dateLabel: "Date",
    docNoLabel: "Document No. & Rev",
    approvedByLabel: "Approved by",
    presenter: "Name of Presenter",
    date: "Date",
    site: "Site",
    topic: "Tool Box Talk Topic:",
    attendeeDisclaimer:
        "The undersigned have been fully briefed on the contents of the attached Tool Box Talk and will ensure they work to the agreed safe system of work in place at all times and shall raise any concerns directly with the Site Supervisor or Director.",
    attendeePrintNameLabel: "Print Name",
    attendeeSignatureLabel: "Signature",
    attendeeDateLabel: "Date",
    consultationTitle:
        "Consultation (record all consultation comments raised during the tool box talk)",
};

function normalizeAttendeeDisclaimer(value) {
    if (!value || value.trim() === LEGACY_ATTENDEE_DISCLAIMER) {
        return DEFAULT_HEADER_LABELS.attendeeDisclaimer;
    }
    return value;
}

export default function ToolBoxTalkForm() {
    const { isDarkMode } = useTheme();
    const logoUrl = useCompanyLogo();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const action = searchParams.get("action");
    const category = resolveFormCategoryFromSearchParams(searchParams);
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

    const [headerData, setHeaderData] = useState({
        presenter: "",
        date: "",
        site: "",
        topic: ""
    });

    const [headerLabels, setHeaderLabels] = useState(() => ({ ...DEFAULT_HEADER_LABELS }));

    // Common Document Header
    const [docInfo, setDocInfo] = useState({
        date: "",
        docNo: "",
        approvedBy: "",
        logo: "",
        logoRight: "",
        signature: "",
    });
    
    const EMPTY_ATTENDEE = { printName: "", signature: "", date: "" };
    const [attendees, setAttendees] = useState(() =>
        Array.from({ length: 10 }, () => ({ ...EMPTY_ATTENDEE }))
    );

    const [consultation, setConsultation] = useState("");
    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId, pdfLayout, contentReadOnly, isSitePackContext } = useGeneralFormTemplateAccess(action, downloading, persistedSiteId, persistedSubfolderId);
    const canFillFields =
        !pdfLayout &&
        (canEdit ||
            isSitePackContext ||
            Boolean(fromTemplateId) ||
            isContextualFormFill(searchParams));
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
                headerData,
                headerLabels,
                attendees,
                consultation,
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
        watchDeps: [docInfo, headerData, headerLabels, attendees, consultation],
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
        fileBaseName: "ToolBoxTalk",
        pdfOptions: TOOLBOX_TALK_PDF_OPTIONS,
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
                    if (submission.answers.headerData) setHeaderData(submission.answers.headerData);
                    if (submission.answers.headerLabels) {
                        const saved = submission.answers.headerLabels;
                        setHeaderLabels({
                            ...DEFAULT_HEADER_LABELS,
                            ...saved,
                            attendeeDisclaimer: normalizeAttendeeDisclaimer(saved.attendeeDisclaimer),
                        });
                    }
                    if (submission.answers.attendees) setAttendees(submission.answers.attendees);
                    if (submission.answers.consultation !== undefined) setConsultation(submission.answers.consultation);
                    setFormMetadata({
                        name: submission.answers.name || `Tool Box Talk - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    // Styling configurations for the exact look
    const borderColor = "#CCC";
    const headerBgColor = "#F9FAFB";
    const headerTextColor = "#111827";
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
                        Tool Box Talk Register
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

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    mb: 8,
                    overflowX: pdfLayout ? "visible" : "auto",
                    px: pdfLayout ? 0 : { xs: 2, md: 0 },
                    width: "100%",
                }}
            >
                {/* Form Container */}
                <Paper 
                    ref={containerRef}
                    elevation={3} 
                    className={pdfLayout ? "pdf-export-root" : undefined}
                    sx={{ 
                        width: "100%", 
                        minWidth: pdfLayout ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: pdfLayout ? 2 : 4,
                        boxSizing: "border-box",
                        overflow: "visible",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none",
                        boxShadow: pdfLayout ? "none" : undefined
                    }}
                >
                    {/* Form header box — repeated on every PDF page */}
                    <Box
                        data-pdf-page-header
                        sx={{ mb: pdfLayout ? 2 : 4 }}
                    >
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
                            <Box
                                sx={pdfFlexRow(pdfLayout, {
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "bold",
                                    p: 1,
                                    borderBottom: `1px solid ${borderColor}`,
                                    textAlign: "center",
                                })}
                            >
                                {(contentReadOnly) ? (
                                    <Typography sx={{ fontWeight: "bold", textAlign: "center", width: "100%" }}>
                                        {headerLabels.formTitle}
                                    </Typography>
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        InputProps={{
                                            disableUnderline: true,
                                            sx: {
                                                fontWeight: "bold",
                                                textAlign: "center",
                                                input: { textAlign: "center" },
                                            },
                                        }}
                                        value={headerLabels.formTitle}
                                        onChange={(e) => setHeaderLabels({...headerLabels, formTitle: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                                <Box sx={pdfColWidth(pdfLayout, '60%', { p: 1, borderRight: `1px solid ${borderColor}` })}>
                                    {(contentReadOnly) ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.dateLabel}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={headerLabels.dateLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, dateLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={pdfColWidth(pdfLayout, '40%', { p: 0 })}>
                                    {(contentReadOnly) ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: headerTextColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={pdfFlexRow(pdfLayout, { borderBottom: `1px solid ${borderColor}` })}>
                                <Box sx={pdfColWidth(pdfLayout, '60%', { p: 1, borderRight: `1px solid ${borderColor}` })}>
                                    {(contentReadOnly) ? (
                                        <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.docNoLabel}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                            value={headerLabels.docNoLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, docNoLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                <Box sx={pdfColWidth(pdfLayout, '40%', { p: 0 })}>
                                    {(contentReadOnly) ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: headerTextColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <FormHeaderApprovedRow
                                borderColor={borderColor}
                                contentReadOnly={contentReadOnly}
                                pdfLayout={pdfLayout}
                                label={headerLabels.approvedByLabel}
                                onLabelChange={(e) => setHeaderLabels({ ...headerLabels, approvedByLabel: e.target.value })}
                                value={docInfo.approvedBy}
                                onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                                valueTextColor={headerTextColor}
                                pageText="Page 1 of 1"
                            />
                    </FormDocumentHeader>
                    </Box>

                    {/* Presenter Info Details */}
                    <Box data-pdf-block sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}` }}>
                        {[
                            { key: "presenter" },
                            { key: "date" },
                            { key: "site" },
                            { key: "topic" }
                        ].map((row, index) => (
                            <Box key={row.key} sx={pdfFlexRow(pdfLayout, { borderBottom: index < 3 ? `1px solid ${borderColor}` : 'none' })}>
                                <Box sx={pdfColWidth(pdfLayout, '40%', { p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' })}>
                                    {!canEditTemplateText ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels[row.key]}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels[row.key]}
                                            onChange={(e) => setHeaderLabels({...headerLabels, [row.key]: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={pdfColWidth(pdfLayout, '60%', { display: 'flex', alignItems: 'stretch', minHeight: 48 })}>
                                    <FormTableCellTextField
                                        value={headerData[row.key]}
                                        onChange={handleHeaderChange(row.key)}
                                        readOnly={!canFillFields}
                                        placeholder={headerLabels[row.key]?.replace(/:$/, "") || ""}
                                        isDarkMode={isDarkMode}
                                        minRows={1}
                                        minCellHeight={44}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Disclaimer Text — editable when editing template in General Forms */}
                    <Box data-pdf-block sx={{ border: `1px solid ${borderColor}`, borderTop: 'none', p: 2 }}>
                        {canEditTemplateText ? (
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                variant="outlined"
                                size="small"
                                label="Attendee disclaimer"
                                value={headerLabels.attendeeDisclaimer}
                                onChange={(e) =>
                                    setHeaderLabels({ ...headerLabels, attendeeDisclaimer: e.target.value })
                                }
                                InputProps={{
                                    sx: { fontSize: "0.9rem", lineHeight: 1.5, color: isDarkMode ? "#F9FAFB" : "#111827" },
                                }}
                                InputLabelProps={{ shrink: true }}
                            />
                        ) : (
                            <Typography sx={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                                {headerLabels.attendeeDisclaimer}
                            </Typography>
                        )}
                    </Box>

                    {/* Attendees Table — flex rows with nowrap so columns stay side-by-side across 100% width */}
                    <Box
                        data-pdf-block
                        sx={{ border: `1px solid ${borderColor}`, borderTop: "none" }}
                    >
                        <Box
                            sx={pdfFlexRow(pdfLayout, {
                                borderBottom: `1px solid ${borderColor}`,
                                bgcolor: isDarkMode ? "#1F2937" : "#F3F4F6",
                            })}
                        >
                            <Box
                                sx={pdfColWidth(pdfLayout, ATTENDEE_COL.index, {
                                    minWidth: pdfLayout || contentReadOnly ? undefined : "44px",
                                    p: cellPadding,
                                    borderRight: `1px solid ${borderColor}`,
                                    textAlign: "center",
                                    fontWeight: "bold",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                })}
                            >
                                #
                            </Box>
                            {[
                                { key: "attendeePrintNameLabel", width: ATTENDEE_COL.name, borderRight: true },
                                { key: "attendeeSignatureLabel", width: ATTENDEE_COL.signature, borderRight: true },
                                { key: "attendeeDateLabel", width: ATTENDEE_COL.date, borderRight: false },
                            ].map(({ key, width, borderRight: hasBorder }) => (
                                <Box
                                    key={key}
                                    sx={pdfColWidth(pdfLayout, width, {
                                        p: cellPadding,
                                        textAlign: "center",
                                        fontWeight: "bold",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        ...(hasBorder ? { borderRight: `1px solid ${borderColor}` } : {}),
                                    })}
                                >
                                    {!canEditTemplateText ? (
                                        <Typography sx={{ fontWeight: "bold" }}>{headerLabels[key]}</Typography>
                                    ) : (
                                        <TextField
                                            fullWidth
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
                                            value={headerLabels[key]}
                                            onChange={(e) =>
                                                setHeaderLabels({ ...headerLabels, [key]: e.target.value })
                                            }
                                        />
                                    )}
                                </Box>
                            ))}
                        </Box>

                        {attendees.map((attendee, index) => (
                            <Box
                                key={index}
                                sx={pdfFlexRow(pdfLayout, {
                                    borderBottom: index < attendees.length - 1 ? `1px solid ${borderColor}` : "none",
                                    alignItems: "stretch",
                                    minHeight: "48px",
                                })}
                            >
                                <Box
                                    sx={pdfColWidth(pdfLayout, ATTENDEE_COL.index, {
                                        minWidth: pdfLayout || contentReadOnly ? undefined : "44px",
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        textAlign: "center",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 0.25,
                                    })}
                                >
                                    <Typography sx={{ fontWeight: "bold", lineHeight: 1 }}>{index + 1}</Typography>
                                    {!pdfLayout && (
                                        <GeneralFormTableRowControls
                                            downloading={downloading}
                                            action={action}
                                            accessLocked={!canFillFields}
                                            rowIndex={index}
                                            rowCount={attendees.length}
                                            minRows={1}
                                            maxRows={35}
                                            borderColor={borderColor}
                                            onInsertAfter={insertAttendeeAfter}
                                            onRemoveAt={removeAttendeeAt}
                                            variant="compact"
                                        />
                                    )}
                                </Box>
                                <Box
                                    sx={pdfColWidth(pdfLayout, ATTENDEE_COL.name, {
                                        borderRight: `1px solid ${borderColor}`,
                                        p: pdfLayout ? 1 : 0,
                                        minHeight: 48,
                                        display: "flex",
                                        alignItems: "center",
                                    })}
                                >
                                    {pdfLayout ? (
                                        <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", width: "100%" }}>
                                            {attendee.printName || " "}
                                        </Typography>
                                    ) : (
                                        <FormTableCellTextField
                                            value={attendee.printName}
                                            onChange={handleAttendeeChange(index, "printName")}
                                            readOnly={!canFillFields}
                                            placeholder="Print name"
                                            isDarkMode={isDarkMode}
                                            minRows={2}
                                            minCellHeight={96}
                                        />
                                    )}
                                </Box>
                                <Box
                                    sx={pdfColWidth(pdfLayout, ATTENDEE_COL.signature, {
                                        borderRight: `1px solid ${borderColor}`,
                                        p: pdfLayout ? 1 : 0,
                                        minHeight: 48,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                    })}
                                >
                                    {attendee.signature &&
                                    (attendee.signature.startsWith("data:image/") ||
                                        attendee.signature.startsWith("http")) ? (
                                        pdfLayout ? (
                                            <Box
                                                component="img"
                                                src={attendee.signature}
                                                alt="Signature"
                                                sx={{ maxHeight: 40, maxWidth: "100%", objectFit: "contain" }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    width: "100%",
                                                    py: 0.5,
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={attendee.signature}
                                                    alt="Signature"
                                                    sx={{ maxHeight: "40px", maxWidth: "100%", objectFit: "contain" }}
                                                />
                                                {canFillFields && (
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        sx={{ fontSize: "0.65rem", minWidth: "auto", p: 0, mt: 0.5 }}
                                                        onClick={() => {
                                                            const newAttendees = attendees.map((att, i) =>
                                                                i === index ? { ...att, signature: "" } : att
                                                            );
                                                            setAttendees(newAttendees);
                                                        }}
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </Box>
                                        )
                                    ) : pdfLayout ? (
                                        <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", width: "100%" }}>
                                            {attendee.signature || " "}
                                        </Typography>
                                    ) : !canFillFields ? (
                                        <Typography
                                            sx={{
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                                px: 1,
                                                py: 1,
                                                minHeight: "1.5em",
                                                textAlign: "inherit",
                                                flex: 1,
                                            }}
                                        >
                                            {attendee.signature || " "}
                                        </Typography>
                                    ) : (
                                        <Box sx={{ width: "100%", px: 0.5, py: 0.5 }}>
                                            <SignatureCapture
                                                value={
                                                    attendee.signature &&
                                                    (attendee.signature.startsWith("data:image/") ||
                                                        attendee.signature.startsWith("http"))
                                                        ? attendee.signature
                                                        : null
                                                }
                                                onChange={(url) => {
                                                    const newAttendees = attendees.map((att, i) =>
                                                        i === index ? { ...att, signature: url || "" } : att
                                                    );
                                                    setAttendees(newAttendees);
                                                }}
                                                readOnly={!canFillFields}
                                                compact
                                            />
                                        </Box>
                                    )}
                                </Box>
                                <Box
                                    sx={pdfColWidth(pdfLayout, ATTENDEE_COL.date, {
                                        p: pdfLayout ? 1 : 0,
                                        minHeight: 48,
                                        display: "flex",
                                        alignItems: "center",
                                    })}
                                >
                                    {pdfLayout ? (
                                        <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", width: "100%" }}>
                                            {attendee.date || " "}
                                        </Typography>
                                    ) : (
                                        <FormTableCellTextField
                                            value={attendee.date}
                                            onChange={handleAttendeeChange(index, "date")}
                                            readOnly={!canFillFields}
                                            placeholder="Date"
                                            isDarkMode={isDarkMode}
                                            minRows={2}
                                            minCellHeight={96}
                                        />
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Consultation Section */}
                    <Box data-pdf-block sx={{ border: `1px solid ${borderColor}`, borderTop: 'none', minHeight: '150px', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: cellPadding }}>
                            {!canEditTemplateText ? (
                                <Typography sx={{ fontWeight: "bold", textDecoration: "underline", fontStyle: "italic", fontSize: "0.9rem" }}>
                                    {headerLabels.consultationTitle}
                                </Typography>
                            ) : (
                                <TextField
                                    fullWidth
                                    variant="standard"
                                    InputProps={{
                                        disableUnderline: true,
                                        sx: {
                                            fontWeight: "bold",
                                            textDecoration: "underline",
                                            fontStyle: "italic",
                                            fontSize: "0.9rem",
                                            color: isDarkMode ? "#F9FAFB" : "#111827",
                                        },
                                    }}
                                    value={headerLabels.consultationTitle}
                                    onChange={(e) =>
                                        setHeaderLabels({ ...headerLabels, consultationTitle: e.target.value })
                                    }
                                />
                            )}
                        </Box>
                        <Box sx={{ px: 1, pb: 1, flex: 1, display: 'flex' }}>
                            <FormTableCellTextField
                                value={consultation}
                                onChange={(e) => setConsultation(e.target.value)}
                                readOnly={!canFillFields}
                                placeholder="Consultation comments"
                                isDarkMode={isDarkMode}
                                minRows={4}
                                minCellHeight={120}
                            />
                        </Box>
                    </Box>

                    {/* Signature Section */}
                    <Box
                        data-pdf-block
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mt: 4,
                            mb: 2,
                            px: 2,
                            pt: 1,
                            pb: 2,
                            overflow: "visible",
                            pageBreakInside: "avoid",
                        }}
                    >
                        <Box
                            sx={{
                                width: 250,
                                maxWidth: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                overflow: "visible",
                            }}
                        >
                            <Box
                                sx={{
                                    width: "100%",
                                    borderBottom: `1px solid ${borderColor}`,
                                    mb: 1,
                                    pb: 1,
                                    minHeight: 48,
                                }}
                            >
                                <SignatureCapture
                                    value={docInfo.signature || null}
                                    onChange={(url) => setDocInfo({ ...docInfo, signature: url || "" })}
                                    readOnly={!canFillFields}
                                />
                            </Box>
                            <Typography sx={{ fontWeight: "bold", fontSize: "0.9rem", lineHeight: 1.4 }}>
                                Signature
                            </Typography>
                        </Box>
                    </Box>

                    </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `Tool Box Talk - ${new Date().toLocaleDateString()}`}
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
