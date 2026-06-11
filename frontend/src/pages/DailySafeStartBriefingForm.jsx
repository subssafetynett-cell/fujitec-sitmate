import React, { useState, useEffect, useRef } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton, 
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import GeneralFormTableRowControls from "../components/GeneralFormTableRowControls";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import api from "../services/api";
import { appendSitepackToAnswers } from "../utils/sitepackContext";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";

const HAZARD_CATEGORIES = [
    { key: "workAtHeight", label: "Work at Height", img: "/hazards/work-at-height.png" },
    { key: "manualLifting", label: "Manual Lifting", img: "/hazards/manual-lifting.png" },
    { key: "liftingOperation", label: "Lifting Operation", img: "/hazards/lifting-operation.png" },
    { key: "powerTools", label: "Power Tools & Equipment", img: "/hazards/power-tools.png" },
    { key: "openLiftShaft", label: "Open Lift Shaft", img: "/hazards/open-lift-shaft.png" },
    { key: "electricity", label: "Electricity", img: "/hazards/electricity.png" },
    { key: "ppeHealth", label: "PPE / Health e.g. Dust / COSHH", img: "/hazards/ppe.png" },
];

function focusEditableCellField(event) {
    const input = event.currentTarget.querySelector("textarea, input");
    input?.focus();
}

const editableCellFieldSx = {
    flex: 1,
    "& .MuiInputBase-root": {
        height: "100%",
        alignItems: "flex-start",
    },
};

export default function DailySafeStartBriefingForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const [searchParams] = useSearchParams();
    const category = searchParams.get("category") || "General forms";
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

    const [docInfo, setDocInfo] = useState({ date: "", docNo: "", approvedBy: "" ,
        logo: ""
,
        logoRight: ""
    });

    const [headerData, setHeaderData] = useState({
        projectName: "",
        date: "",
        principalContractor: "",
        methodStatementNo: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "Daily Safe Start Briefing Sheet",
        headerDateLabel: "Date",
        headerDocNoLabel: "Document No. & Rev",
        headerApprovedByLabel: "Approved by",
        briefingTitle: "Start Right Daily Safety Briefing",
        projectName: "Project name:",
        date: "Date",
        principalContractor: "Principal Contractor:",
        methodStatementNo: "Method Statement No.",
        briefingNameLabel: "Name",
        briefingSignatureLabel: "Signature",
        briefingJobTitleLabel: "Job Title",
        briefingGivenByLabel: "Briefing given by:"
    });

    const [activities, setActivities] = useState("");
    
    const [hazards, setHazards] = useState({
        workAtHeight: false,
        manualLifting: false,
        liftingOperation: false,
        powerTools: false,
        openLiftShaft: false,
        electricity: false,
        ppeHealth: false,
        otherText: ""
    });

    const [checks, setChecks] = useState({
        plansInPlaceYes: false,
        plansInPlaceNo: false
    });

    const [controlMeasures, setControlMeasures] = useState("");

    const EMPTY_ATTENDEE = { name: "", signature: "", comments: "" };
    const [attendees, setAttendees] = useState(() =>
        Array.from({ length: 5 }, () => ({ ...EMPTY_ATTENDEE }))
    );

    const [consultation, setConsultation] = useState("");

    const [briefingGivenBy, setBriefingGivenBy] = useState({
        name: "",
        signature: "",
        jobTitle: ""
    });
    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId, pdfLayout, contentReadOnly } = useGeneralFormTemplateAccess(action, downloading, persistedSiteId, persistedSubfolderId);

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
                activities,
                hazards,
                checks,
                controlMeasures,
                attendees,
                consultation,
                briefingGivenBy,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags,
            };
            payload = appendSitepackToAnswers(payload, { siteId, subfolderId });
            payload = withGeneralFormVisibility(payload, visibility, {
                hasSiteContext: Boolean(siteId),
            });

            if (persistedResponseId && !asNew) {
                await api.put(`/forms/responses/${persistedResponseId}`, { answers: payload, category });
            } else {
                const formId = await getOrCreateTemplateForm("Daily Safe Start Briefing Sheet");
                await api.post(`/forms/${formId}/responses`, {
                    answers: payload,
                    category,
                });
            }

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
        watchDeps: [docInfo, headerData, headerLabels, activities, hazards, checks, controlMeasures, attendees, consultation, briefingGivenBy],
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
        const docKey = persistedResponseId || seedSubmissionId;
        if (!loading && action === "download" && docKey) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `DailySafeStart_${docKey}`, () => {
                    setDownloading(false);
                    window.close();
                });
            }, 300);
        }
    }, [loading, action, persistedResponseId, seedSubmissionId]);

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
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    if (submission.answers.activities !== undefined) setActivities(submission.answers.activities);
                    if (submission.answers.hazards) setHazards(submission.answers.hazards);
                    if (submission.answers.checks) setChecks(submission.answers.checks);
                    if (submission.answers.controlMeasures !== undefined) setControlMeasures(submission.answers.controlMeasures);
                    if (submission.answers.attendees) setAttendees(submission.answers.attendees);
                    if (submission.answers.consultation !== undefined) setConsultation(submission.answers.consultation);
                    if (submission.answers.briefingGivenBy) setBriefingGivenBy(submission.answers.briefingGivenBy);
                    setFormMetadata({
                        name: submission.answers.name || `Daily Safe Start - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const handleAttendeeChange = (index, field) => (e) => {
        const newArr = [...attendees];
        newArr[index] = { ...newArr[index], [field]: e.target.value };
        setAttendees(newArr);
    };

    const insertAttendeeAfter = (index) => {
        setAttendees((a) => {
            if (a.length >= 40) return a;
            const next = [...a];
            next.splice(index + 1, 0, { ...EMPTY_ATTENDEE });
            return next;
        });
    };
    const removeAttendeeAt = (index) => {
        setAttendees((a) => (a.length <= 1 ? a : a.filter((_, i) => i !== index)));
    };

    const toggleHazard = (field) => {
        setHazards({ ...hazards, [field]: !hazards[field] });
    };

    const toggleCheck = (field) => {
        if (field === "plansInPlaceYes") {
            setChecks({ plansInPlaceYes: true, plansInPlaceNo: false });
        } else if (field === "plansInPlaceNo") {
            setChecks({ plansInPlaceYes: false, plansInPlaceNo: true });
        }
    };

    const borderColor = "#CCC";
    const cellPadding = "8px 12px";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    const CustomCheckbox = ({ checked, onClick, label }) => (
        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', cursor: contentReadOnly ? 'default' : 'pointer', gap: 0.5 }} onClick={contentReadOnly ? undefined : onClick}>
            {label && <Typography sx={{ fontSize: '0.85rem' }}>{label}</Typography>}
            {checked ? <CheckBoxIcon fontSize="small" color="primary" /> : <CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />}
        </Box>
    );

    return (
        <Layout pageTitle="Daily Safe Start Briefing">
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
                        {downloading ? "Downloading PDF..." : (saving ? "Saving..." : "Save Form")}
                    </Button>
                </Box>
                )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
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
                        border: pdfLayout ? "1px solid #ccc" : "none"
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
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
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <FormHeaderApprovedRow
                                borderColor={borderColor}
                                contentReadOnly={contentReadOnly}
                                label={headerLabels.headerApprovedByLabel}
                                onLabelChange={(e) => setHeaderLabels({ ...headerLabels, headerApprovedByLabel: e.target.value })}
                                value={docInfo.approvedBy}
                                onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                                valueTextColor={isDarkMode ? "#F9FAFB" : "#111827"}
                            />
                    </FormDocumentHeader>

                    {/* Start Right Details Section */}
                    <Box sx={{ border: `1px solid ${borderColor}` }}>
                        <Box sx={{ bgcolor: isDarkMode ? "#374151" : "#111827", color: "#FFFFFF", textAlign: "center", py: 0, fontWeight: 'bold', fontSize: '1.2rem', borderBottom: `1px solid ${borderColor}` }}>
                            {contentReadOnly ? (
                                <Typography sx={{ fontWeight: 'bold', py: 1, fontSize: '1.2rem' }}>{headerLabels.briefingTitle}</Typography>
                            ) : (
                                <TextField
                                    fullWidth
                                    variant="standard"
                                    InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', color: '#FFF', fontSize: '1.2rem', textAlign: 'center', input: { textAlign: 'center' }, p: 1 } }}
                                    value={headerLabels.briefingTitle}
                                    onChange={(e) => setHeaderLabels({...headerLabels, briefingTitle: e.target.value})}
                                />
                            )}
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.projectName}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.projectName}
                                        onChange={(e) => setHeaderLabels({...headerLabels, projectName: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.projectName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.projectName} onChange={e => setHeaderData({...headerData, projectName: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.date}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.date}
                                        onChange={(e) => setHeaderLabels({...headerLabels, date: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' } }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} />)}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.principalContractor}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.principalContractor}
                                        onChange={(e) => setHeaderLabels({...headerLabels, principalContractor: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.principalContractor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.principalContractor} onChange={e => setHeaderData({...headerData, principalContractor: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.methodStatementNo}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.methodStatementNo}
                                        onChange={(e) => setHeaderLabels({...headerLabels, methodStatementNo: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' } }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.methodStatementNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.methodStatementNo} onChange={e => setHeaderData({...headerData, methodStatementNo: e.target.value})} />)}
                            </Box>
                        </Box>

                        {/* Briefing Text */}
                        <Box sx={{ p: cellPadding, textAlign: "center", fontSize: "0.85rem", borderBottom: `1px solid ${borderColor}` }}>
                            All personnel are to receive a daily safety briefing <b>(relating to RAMS scope of work for the day)</b> before they START work on site. This requirement applies to employees, sub-contractors and any other person prior to starting work for or on behalf of Focus Lifts each day.
                        </Box>

                        {/* Key Activities */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, minHeight: '80px' }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: cellPadding, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.9rem' }}>
                                Key activities:<br/>
                                <i>(details of the RAMS work activity)</i>
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '75%' } }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{activities || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }} value={activities} onChange={e => setActivities(e.target.value)} />)}
                            </Box>
                        </Box>

                        {/* Hazards Checkboxes Row */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: cellPadding, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.9rem' }}>
                                Key hazards associated with the task:<br/><br/>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
                                    (tick hazard(s) associated with the work activity where applicable and use space below to state/list any other hazards)
                                </Typography>
                            </Box>
                            
                            <Box sx={{ width: { xs: '100%', md: '75%' }, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, flex: 1 }}>
                                    {HAZARD_CATEGORIES.map((cat, idx, arr) => (
                                        <Box
                                            key={cat.key}
                                            sx={{
                                                width: { xs: '50%', md: `${100 / arr.length}%` },
                                                borderRight: idx < arr.length - 1 ? `1px solid ${borderColor}` : 'none',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                minWidth: 0,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    minHeight: 72,
                                                    p: 0.75,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderBottom: `1px solid ${borderColor}`,
                                                    bgcolor: '#FFFFFF',
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={cat.img}
                                                    alt={cat.label}
                                                    sx={{
                                                        maxHeight: 56,
                                                        maxWidth: '100%',
                                                        width: 'auto',
                                                        height: 'auto',
                                                        objectFit: 'contain',
                                                    }}
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    p: 0.75,
                                                    textAlign: 'center',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    lineHeight: 1.25,
                                                    borderBottom: `1px solid ${borderColor}`,
                                                    minHeight: 44,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {cat.label}
                                            </Box>
                                            <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CustomCheckbox checked={hazards[cat.key]} onClick={() => toggleHazard(cat.key)} />
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                                {/* Other List */}
                                <Box sx={{ borderTop: `1px solid ${borderColor}`, p: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    <Box sx={{ fontSize: '0.85rem', whiteSpace: 'nowrap', mr: 1 }}>Other (List):</Box>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{hazards.otherText || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", py: 0, height: '100%', fontSize: '0.85rem' } }} value={hazards.otherText} onChange={e => setHazards({...hazards, otherText: e.target.value})} />)}
                                </Box>
                            </Box>
                        </Box>

                        {/* Checks */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, alignItems: 'center' }}>
                            <Box sx={{ flex: 1, p: cellPadding, fontSize: '0.9rem' }}>
                                Are the current method statements, risk assessments and Lift Plan in place?
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2, pr: 2 }}>
                                <CustomCheckbox label="Yes:" checked={checks.plansInPlaceYes} onClick={() => toggleCheck("plansInPlaceYes")} />
                                <CustomCheckbox label="No:" checked={checks.plansInPlaceNo} onClick={() => toggleCheck("plansInPlaceNo")} />
                            </Box>
                        </Box>

                        {/* Control Measures */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, minHeight: '80px' }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: cellPadding, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.9rem' }}>
                                Key control measures to be followed:
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '75%' } }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{controlMeasures || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }} value={controlMeasures} onChange={e => setControlMeasures(e.target.value)} />)}
                            </Box>
                        </Box>

                        {/* Attendance Header */}
                        <Box sx={{ bgcolor: isDarkMode ? "#374151" : "#111827", color: "#FFFFFF", textAlign: "center", py: 1, fontWeight: 'bold', fontSize: '1.2rem', borderBottom: `1px solid ${borderColor}` }}>
                            Attendance record
                        </Box>
                        <Box sx={{ p: cellPadding, textAlign: "center", fontSize: "0.85rem", borderBottom: `1px solid ${borderColor}` }}>
                            I acknowledge receipt of the daily task briefing detailed above and confirm that I have been briefed on the risk assessments and method statement for the task
                        </Box>

                        {/* Table Header */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, fontWeight: 'bold', textAlign: 'center' }}>
                            <Box sx={{ width: { xs: '100%', md: pdfLayout ? '5%' : '88px' }, minWidth: { md: pdfLayout ? undefined : '88px' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>#</Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Name</Box>
                            <Box sx={{ width: { xs: '100%', md: '30%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Signature</Box>
                            <Box sx={{ width: { xs: '100%', md: '30%' }, p: cellPadding }}>Comments</Box>
                        </Box>

                        {attendees.map((attendee, idx) => (
                            <Box key={idx} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: idx < attendees.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: pdfLayout ? '5%' : '88px' }, minWidth: { md: pdfLayout ? undefined : '88px' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                                    <Typography sx={{ fontWeight: 'bold', lineHeight: 1 }}>{idx + 1}.</Typography>
                                    <GeneralFormTableRowControls
                                        downloading={downloading}
                                        action={action}
                                        rowIndex={idx}
                                        rowCount={attendees.length}
                                        minRows={1}
                                        maxRows={40}
                                        borderColor={borderColor}
                                        onInsertAfter={insertAttendeeAfter}
                                        onRemoveAt={removeAttendeeAt}
                                        variant="compact"
                                        accessLocked={!canEdit}
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        width: { xs: '100%', md: '35%' },
                                        borderRight: `1px solid ${borderColor}`,
                                        minHeight: 100,
                                        display: 'flex',
                                        cursor: contentReadOnly ? 'default' : 'text',
                                    }}
                                    onClick={contentReadOnly ? undefined : focusEditableCellField}
                                >
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{attendee.name || ' '}</Typography>) : (<TextField fullWidth multiline minRows={3} variant="standard" sx={editableCellFieldSx} InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={attendee.name} onChange={handleAttendeeChange(idx, 'name')} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {attendee.signature && (attendee.signature.startsWith('data:image/') || attendee.signature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={attendee.signature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!contentReadOnly && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newArr = attendees.map((a, i) => i === idx ? { ...a, signature: '' } : a);
                                                    setAttendees(newArr);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        contentReadOnly ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{attendee.signature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                                <SignatureCapture
                                                    value={
                                                        attendee.signature && (attendee.signature.startsWith('data:image/') || attendee.signature.startsWith('http'))
                                                            ? attendee.signature
                                                            : null
                                                    }
                                                    onChange={(url) => {
                                                        const newArr = attendees.map((a, i) => (i === idx ? { ...a, signature: url || '' } : a));
                                                        setAttendees(newArr);
                                                    }}
                                                    readOnly={contentReadOnly}
                                                    compact
                                                />
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box
                                    sx={{
                                        width: { xs: '100%', md: '30%' },
                                        minHeight: 100,
                                        display: 'flex',
                                        cursor: contentReadOnly ? 'default' : 'text',
                                    }}
                                    onClick={contentReadOnly ? undefined : focusEditableCellField}
                                >
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{attendee.comments || ' '}</Typography>) : (<TextField fullWidth multiline minRows={3} variant="standard" sx={editableCellFieldSx} InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={attendee.comments} onChange={handleAttendeeChange(idx, 'comments')} />)}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Consultation Section */}
                    <Box sx={{ mt: 3, border: `1px solid ${borderColor}` }}>
                        <Box sx={{ p: 1, textAlign: 'center', fontSize: '0.85rem', borderBottom: `1px solid ${borderColor}` }}>
                            Workforce Consultation (record any health & safety issues raised by the workforce after briefing)
                        </Box>
                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{consultation || ' '}</Typography>) : (<TextField 
                            fullWidth 
                            multiline 
                            minRows={3} 
                            variant="standard" 
                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }} 
                            value={consultation} 
                            onChange={e => setConsultation(e.target.value)} 
                        />)}
                        
                        {/* Briefing Given By Row */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderTop: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.briefingGivenByLabel}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.briefingGivenByLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, briefingGivenByLabel: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ width: '26.66%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', p: 0 }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' }}>{headerLabels.briefingNameLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            inputProps={{ style: { textAlign: 'center' } }}
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' } }}
                                            value={headerLabels.briefingNameLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, briefingNameLabel: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingGivenBy.name || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={briefingGivenBy.name} onChange={e => setBriefingGivenBy({...briefingGivenBy, name: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: '26.66%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', p: 0 }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' }}>{headerLabels.briefingSignatureLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            inputProps={{ style: { textAlign: 'center' } }}
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' } }}
                                            value={headerLabels.briefingSignatureLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, briefingSignatureLabel: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {briefingGivenBy.signature && (briefingGivenBy.signature.startsWith('data:image/') || briefingGivenBy.signature.startsWith('http')) ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                        <Box component="img" src={briefingGivenBy.signature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                        {!contentReadOnly && (
                                            <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => setBriefingGivenBy({...briefingGivenBy, signature: ''})}>Remove</Button>
                                        )}
                                    </Box>
                                ) : (
                                    contentReadOnly ? (
                                        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{briefingGivenBy.signature || ' '}</Typography>
                                    ) : (
                                        <Box sx={{ width: '100%', px: 0.5, py: 0.5 }}>
                                            <SignatureCapture
                                                value={
                                                    briefingGivenBy.signature &&
                                                    (briefingGivenBy.signature.startsWith('data:image/') || briefingGivenBy.signature.startsWith('http'))
                                                        ? briefingGivenBy.signature
                                                        : null
                                                }
                                                onChange={(url) => setBriefingGivenBy({ ...briefingGivenBy, signature: url || '' })}
                                                readOnly={contentReadOnly}
                                                compact
                                            />
                                        </Box>
                                    )
                                )}
                            </Box>
                            <Box sx={{ width: '26.66%', display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', p: 0 }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' }}>{headerLabels.briefingJobTitleLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            inputProps={{ style: { textAlign: 'center' } }}
                                            InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", py: 0.5, fontWeight: 'bold', fontSize: '0.85rem' } }}
                                            value={headerLabels.briefingJobTitleLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, briefingJobTitleLabel: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingGivenBy.jobTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={briefingGivenBy.jobTitle} onChange={e => setBriefingGivenBy({...briefingGivenBy, jobTitle: e.target.value})} />)}
                            </Box>
                        </Box>
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

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `Daily Safe Start - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                defaultVisibility={formMetadata.visibility}
                showVisibilityChoice={!siteId}
                saving={saving}
                templateFlow
                nameFieldLabel="Template name"
            />
            {UnsavedDialog}
        </Layout>
    );
}
