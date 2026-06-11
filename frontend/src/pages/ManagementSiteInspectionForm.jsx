import React, { useState, useEffect } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton, Checkbox, Radio, RadioGroup, FormControlLabel
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import GeneralFormTableRowControls, {
    GeneralFormTableRowControlsHeaderSpacer,
} from "../components/GeneralFormTableRowControls";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { appendSitepackToAnswers } from "../utils/sitepackContext";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useRef } from "react";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";

const SCORING_STANDARDS = [
    { title: "ST 1 – Work at Heights: Scaffolding & Edge protection", subtitle: "(scaffold structure, fall protection, car top, voids, protection from falling objects)" },
    { title: "ST 2 – Lifting Operations & Manual Handling", subtitle: "(Guide rails, RAMS, Sling/Platform/Doors, Control Panel, Hydraulic Unit, Lift Car – lifting technique, lifting equipment)" },
    { title: "ST 3 – Temporary Access", subtitle: "(Hoardings, Scaffold towers, ladders, step & podium ladders, protecting others)" },
    { title: "ST 4 – Electricity", subtitle: "(Temp electrical power & lighting, permanent electrical supply, safe working with electricity, PAT)" },
    { title: "ST 5 – Accessing / Egressing & Working in the Pit", subtitle: "(entrance protection, ladder, pit hazards)" },
    { title: "ST 6 – Working in Lift Shaft / LMR", subtitle: "(access/egress, fall protection, housekeeping, lift equipment)" },
    { title: "ST 7 – Housekeeping & Welfare", subtitle: "(site housekeeping standards, storage area and lift equipment protection, site welfare)" },
    { title: "ST 8 – Personal Protective Equipment", subtitle: "(quality & compliance, risk based provision, task PPE)" },
    { title: "ST 9 – Project Planning Documentation", subtitle: "(Risk review process, method statements / risk assessment, key permits & completion of records)" },
    { title: "ST 10 – Supervision & Project Management", subtitle: "(Supervision, training & competence, team m/s briefing, toolbox talks, improvement plan review)" },
    { title: "ST 11 – Site Welfare", subtitle: "(Canteen, Toilets, Drying Room, First Aid, Fire etc.)" },
    { title: "ST 12 – Occupational Health", subtitle: "(COSHH, HAVs, Noise, Dust, Dermatitis, Weils, Drugs & Alcohol, Stress / Mental Health, Asbestos)" },
    { title: "ST 13 – Tools & Equipment", subtitle: "(Hand tools, Portable power tools, lighting, HAVs, Noise, Dust)" },
    { title: "ST 14 – Fire, Accident & Near Miss Reporting", subtitle: "(fire arrangements & procedures, escape procedures, first aid, accident reporting procedure, accident book, near miss cards)" },
    { title: "ST 15 – Environmental Management", subtitle: "(sustainability, pollution incident response, waste management, hazardous waste, nuisance)" },
    { title: "ST 16 – Quality Management", subtitle: "(Shaft survey, plumbing guiderails, plumbing doors, testing & commissioning)" },
    { title: "ST 17 – Hoardings", subtitle: "Hoardings installed securely, doors with locks & structurally robust" },
    { title: "ST 18 – Lift Motor Room", subtitle: "Safety signs, LOTO arrangements, oil resistant floors, safe working space etc." },
    { title: "ST 19 – Lift Shaft & Pit", subtitle: "All fall risks protected, pits clean and free of water, oil, rubbish etc" },
    { title: "ST 20 – Site Requirements", subtitle: "Operatives following site requirements, policies and procedures including Hot Works Permits etc." }
];

export default function ManagementSiteInspectionForm() {
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

    // Initial State Arrays
    const [docInfo, setDocInfo] = useState({ date: "", docNo: "", approvedBy: "" ,
        logo: ""
,
        logoRight: ""
    });
    const [headerData, setHeaderData] = useState({
        inspectorName: "",
        jobTitle: "",
        projectName: "",
        principalContractor: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "MANAGEMENT SITE INSPECTION REPORT",
        dateLabel: "Date",
        docNoLabel: "Document No. & Rev",
        approvedByLabel: "Approved by",
        inspectorName: "Name of Person conducting Inspection",
        jobTitle: "Job Title",
        projectName: "Project Name / Title",
        principalContractor: "Name of Principal Contractor"
    });

    const [statusData, setStatusData] = useState({
        projectStatus: "",
        installationDirector: false,
        sheqAdvisor: false,
        principalContractorTick: false
    });

    const [measures, setMeasures] = useState(
        Array(20).fill({ compliant: "", comments: "" })
    );

    const EMPTY_ACTION = { actionRequired: "", byWho: "", byWhen: "", dateClosed: "" };
    const [actions, setActions] = useState(() =>
        Array.from({ length: 6 }, () => ({ ...EMPTY_ACTION }))
    );
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
                statusData,
                measures,
                actions,
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
                const formId = await getOrCreateTemplateForm("Management Site Inspection Report");
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
        watchDeps: [docInfo, headerData, headerLabels, statusData, measures, actions],
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
                downloadPdfFromRef(containerRef, `ManagementInspection_${docKey}`, () => {
                    setDownloading(false);
                    // Close the newly opened tab
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
                    if (submission.answers.statusData) setStatusData(submission.answers.statusData);
                    if (submission.answers.measures) {
                        const newMeasures = [...measures];
                        submission.answers.measures.forEach((m, i) => {
                            if (newMeasures[i]) newMeasures[i] = m;
                        });
                        setMeasures(newMeasures);
                    }
                    if (submission.answers.actions) setActions(submission.answers.actions);
                    setFormMetadata({
                        name: submission.answers.name || `Management Inspection - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    // Updaters
    const updateHeader = (field) => (e) => setHeaderData({ ...headerData, [field]: e.target.value });
    const updateStatusCheckbox = (field) => (e) => setStatusData({ ...statusData, [field]: e.target.checked });
    const updateMeasure = (index, field) => (e) => {
        const newMeasures = [...measures];
        newMeasures[index] = { ...newMeasures[index], [field]: e.target.value };
        setMeasures(newMeasures);
    };
    const updateAction = (index, field) => (e) => {
        const newActions = [...actions];
        newActions[index] = { ...newActions[index], [field]: e.target.value };
        setActions(newActions);
    };

    const insertActionAfter = (index) => {
        setActions((a) => {
            if (a.length >= 25) return a;
            const next = [...a];
            next.splice(index + 1, 0, { ...EMPTY_ACTION });
            return next;
        });
    };
    const removeActionAt = (index) => {
        setActions((a) => (a.length <= 1 ? a : a.filter((_, i) => i !== index)));
    };

    // Colors & Styling
    const borderColor = isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB";
    const sectionTitleBgColor = "#025B9B"; // from the image "Scope of Inspection"
    const sectionTitleTextColor = "#FFF";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "8px 12px";

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout pageTitle="Management Site Inspection Report">
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

            <Box sx={{ width: '100%', overflowX: 'auto', mb: 8 }}>
                <Box sx={{ minWidth: pdfLayout ? "1000px" : "100%", display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', px: { xs: 2, md: 0 } }}>
                    <Paper 
                        ref={containerRef}
                        elevation={pdfLayout ? 0 : 3} 
                        sx={{ 
                            width: "100%", 
                            maxWidth: "1000px", 
                            p: 4, 
                            bgcolor: isDarkMode ? "#222" : "#FFFFFF", 
                            color: textColor,
                            borderRadius: 2,
                            border: pdfLayout ? "1px solid #ccc" : "2px solid #000000",
                            boxShadow: pdfLayout ? "none" : undefined
                        }}
                    >
                        {/* HEADER LOGOS & INFO */}
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
                                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (
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
                                    <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (
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
                                    <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                    </Box>
                                </Box>
                                <FormHeaderApprovedRow
                                    borderColor={borderColor}
                                    contentReadOnly={contentReadOnly}
                                    label={headerLabels.approvedByLabel}
                                    onLabelChange={(e) => setHeaderLabels({ ...headerLabels, approvedByLabel: e.target.value })}
                                    value={docInfo.approvedBy}
                                    onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                                    valueTextColor={textColor}
                                    pageText="Page 1 of 2"
                                />
                        </FormDocumentHeader>

                        {/* INITIAL FORM FIELDS */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, mb: 4 }}>
                            {[
                                { key: "inspectorName" },
                                { key: "jobTitle" },
                                { key: "projectName" },
                                { key: "principalContractor" }
                            ].map((row, index) => (
                                <Box key={row.key} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 3 ? `1px solid ${borderColor}` : 'none' }}>
                                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                        {contentReadOnly ? 
                                            (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels[row.key]}</Typography>) : 
                                            (<TextField 
                                                fullWidth 
                                                variant="standard" 
                                                InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                                value={headerLabels[row.key]}
                                                onChange={(e) => setHeaderLabels({...headerLabels, [row.key]: e.target.value})}
                                            />)
                                        }
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData[row.key] || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 2, py: 1 } }} value={headerData[row.key]} onChange={updateHeader(row.key)} />)}
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        {/* SCOPE OF INSPECTION */}
                        <Box sx={{ border: `2px solid ${borderColor}`, mb: 4 }}>
                            <Box sx={{ bgcolor: sectionTitleBgColor, color: sectionTitleTextColor, p: 1.5, borderBottom: `1px solid ${borderColor}` }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Scope of Inspection – Lift Installations</Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                {/* Left Side: Project Status */}
                                <Box sx={{ width: { xs: '100%', md: '60%' }, display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ p: 1, bgcolor: sectionTitleBgColor, color: '#FFF', textAlign: 'center', fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                        Project Summary - Based on this inspection the assessment of the project H&S status is
                                    </Box>
                                    
                                    {/* Green */}
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                        <Box sx={{ flex: 1, bgcolor: '#228B22', color: '#FFF', p: 1.5, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' }}>
                                            GREEN – PROJECT IN GOOD WELL MANAGED ORDER, WITH NO SIGNIFICANT STANDARDS ISSUES
                                        </Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${borderColor}` }}>
                                            <Radio 
                                                checked={statusData.projectStatus === "green"} 
                                                onChange={() => setStatusData({...statusData, projectStatus: "green"})} 
                                                value="green" 
                                                disabled={contentReadOnly}
                                                sx={{ color: isDarkMode ? '#FFF' : 'inherit' }}
                                            />
                                        </Box>
                                    </Box>

                                    {/* Amber */}
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                        <Box sx={{ flex: 1, bgcolor: '#D2691E', color: '#FFF', p: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '0.8rem' }}>
                                            <Typography sx={{ fontWeight: 'bold', mb: 0.5, fontSize: '0.85rem' }}>AMBER * – SUPPORT REVIEW GIVES CAUSE FOR CONCERN, WITH SITE STANDARDS ISSUES REQUIRING ATTENTION.</Typography>
                                            <Typography sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>ACTION: Action plan produced after local review at site within 3 working days (LEAD Project Manager with Project Supervisor)</Typography>
                                            <Typography sx={{ fontSize: '0.7rem', mt: 0.5 }}>* NB: CATEGORY TO BE APPLIED ONLY AFTER REVIEW WITH H&S ADVISOR</Typography>
                                        </Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${borderColor}` }}>
                                            <Radio 
                                                checked={statusData.projectStatus === "amber"} 
                                                onChange={() => setStatusData({...statusData, projectStatus: "amber"})} 
                                                value="amber" 
                                                disabled={contentReadOnly}
                                                sx={{ color: isDarkMode ? '#FFF' : 'inherit' }}
                                            />
                                        </Box>
                                    </Box>

                                    {/* Red */}
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                        <Box sx={{ flex: 1, bgcolor: '#DC143C', color: '#FFF', p: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '0.8rem' }}>
                                            <Typography sx={{ fontWeight: 'bold', mb: 0.5, fontSize: '0.85rem' }}>RED * – SUPPORT REVIEW GIVES SIGNIFICANT CAUSE FOR CONCERN DUE TO RISK ITEMS AND/OR ONGOING CONCERNS.</Typography>
                                            <Typography sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>ACTION: Action plan produced after local review at site within 3 working days (LEAD Project Manager, signed off by Installation Director)</Typography>
                                            <Typography sx={{ fontSize: '0.7rem', mt: 0.5 }}>* NB: CATEGORY TO BE APPLIED ONLY AFTER REVIEW WITH H&S ADVISOR & PRINCIPAL CONTRACTOR</Typography>
                                        </Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${borderColor}` }}>
                                            <Radio 
                                                checked={statusData.projectStatus === "red"} 
                                                onChange={() => setStatusData({...statusData, projectStatus: "red"})} 
                                                value="red" 
                                                disabled={contentReadOnly}
                                                sx={{ color: isDarkMode ? '#FFF' : 'inherit' }}
                                            />
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Right Side: Report Distribution */}
                                <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${borderColor}` }}>
                                    <Box sx={{ p: 1, bgcolor: sectionTitleBgColor, color: '#FFF', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', borderBottom: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', minHeight: '44px' }}>
                                        Report Distribution
                                    </Box>

                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                        <Box sx={{ flex: 1, bgcolor: sectionTitleBgColor, color: '#FFF', p: 0.5, textAlign: 'center', fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.85rem' }}>Installation Director</Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                            <Checkbox checked={statusData.installationDirector} onChange={updateStatusCheckbox("installationDirector")} disabled={contentReadOnly} sx={{ color: isDarkMode ? '#FFF' : 'inherit' }} />
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                        <Box sx={{ flex: 1, bgcolor: sectionTitleBgColor, color: '#FFF', p: 0.5, textAlign: 'center', fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.85rem' }}>SHEQ Advisor</Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                            <Checkbox checked={statusData.sheqAdvisor} onChange={updateStatusCheckbox("sheqAdvisor")} disabled={contentReadOnly} sx={{ color: isDarkMode ? '#FFF' : 'inherit' }} />
                                        </Box>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                        <Box sx={{ flex: 1, bgcolor: sectionTitleBgColor, color: '#FFF', p: 0.5, textAlign: 'center', fontWeight: 'bold', borderRight: `1px solid ${borderColor}`, fontSize: '0.85rem' }}>Principal Contractor</Box>
                                        <Box sx={{ width: '50px', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                            <Checkbox checked={statusData.principalContractorTick} onChange={updateStatusCheckbox("principalContractorTick")} disabled={contentReadOnly} sx={{ color: isDarkMode ? '#FFF' : 'inherit' }} />
                                        </Box>
                                    </Box>

                                    <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', p: 2, textAlign: 'center', fontSize: '0.9rem', color: isDarkMode ? '#CCC' : '#555' }}>
                                        See items above and picture section
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {/* SCORING TABLE */}
                        <Box sx={{ border: `2px solid ${borderColor}`, mb: 4 }}>
                            {/* Scoring Header */}
                            <Box sx={{ p: 2, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                                <Typography sx={{ fontWeight: 'bold', textAlign: 'center', mb: 1.5 }}>Site Health and Safety Performance Measures: Scoring</Typography>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', mb: 0.5 }}>A - GOOD STANDARD - Correct standard and/or approach in place</Typography>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', mb: 0.5 }}>B – BASIC-STANDARD - (moderate improvement sought (NB. issue WITHOUT high potential for injury) or an improvement on site action required)</Typography>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>C - SUBSTANDARD - (site condition WITH high potential for injury, or inappropriate site action or non- action, and so below requirements)</Typography>
                            </Box>

                            {/* Table Headers */}
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, bgcolor: isDarkMode ? '#111' : '#333', color: '#FFF', borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '45%' }, p: 1, fontWeight: 'bold', textAlign: 'center', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                    STANDARD
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 1, fontWeight: 'bold', textAlign: 'center', borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                    COMPLIANT<br/>Y / N / NA
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, fontWeight: 'bold', textAlign: 'center', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                    Comments / Correction Actions
                                </Box>
                            </Box>

                            {/* Table Rows */}
                            {SCORING_STANDARDS.map((std, index) => (
                                <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < 19 ? `1px solid ${borderColor}` : 'none' }}>
                                    <Box sx={{ width: { xs: '100%', md: '45%' }, p: 1, borderRight: `1px solid ${borderColor}`, bgcolor: sectionTitleBgColor, color: '#FFF', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography sx={{ fontWeight: 'bold', fontSize: '0.85rem', lineHeight: 1.2 }}>{std.title}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', mt: 0.5, lineHeight: 1.1 }}>{std.subtitle}</Typography>
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'center' }}>{measures[index].compliant || ' '}</Typography>) : (<TextField multiline 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, textAlign: 'center', height: '100%' } }} 
                                            inputProps={{ style: { textAlign: 'center' } }}
                                            value={measures[index].compliant} 
                                            onChange={updateMeasure(index, "compliant")} 
                                        />)}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '40%' } }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{measures[index].comments || ' '}</Typography>) : (<TextField 
                                            fullWidth 
                                            multiline
                                            minRows={2}
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} 
                                            value={measures[index].comments} 
                                            onChange={updateMeasure(index, "comments")} 
                                        />)}
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        {/* COMMENTS & ACTIONS TABLE */}
                        <Box sx={{ border: `2px solid ${borderColor}` }}>
                            <Box sx={{ p: 1, bgcolor: isDarkMode ? '#111' : '#333', color: '#FFF', fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                Comments/Actions <span style={{fontSize: '0.8rem', fontWeight: 'normal'}}>(Please state any comments or correctives actions required in this box)</span>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}`, bgcolor: isDarkMode ? '#222' : '#555', color: '#FFF', fontWeight: 'bold' }}>
                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1, textAlign: 'center', borderRight: `1px solid ${borderColor}` }}>Actions Required</Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 1, textAlign: 'center', borderRight: `1px solid ${borderColor}` }}>By Who</Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 1, textAlign: 'center', borderRight: `1px solid ${borderColor}` }}>By When</Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 1, textAlign: 'center' }}>Date Closed</Box>
                                </Box>
                                <GeneralFormTableRowControlsHeaderSpacer
                                    downloading={downloading}
                                    action={action}
                                    borderColor={borderColor}
                                    headerBgColor={isDarkMode ? '#222' : '#555'}
                                    accessLocked={!canEdit}
                                />
                            </Box>

                            {actions.map((act, index) => (
                                <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < actions.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    <Box sx={{ width: { xs: '100%', md: '50%' }, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{act.actionRequired || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1 } }} value={act.actionRequired} onChange={updateAction(index, "actionRequired")} />)}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '20%' }, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{act.byWho || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1 } }} value={act.byWho} onChange={updateAction(index, "byWho")} />)}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '15%' }, borderRight: `1px solid ${borderColor}` }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{act.byWhen || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1 } }} value={act.byWhen} onChange={updateAction(index, "byWhen")} />)}
                                    </Box>
                                    <Box sx={{ width: { xs: '100%', md: '15%' } }}>
                                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{act.dateClosed || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1 } }} value={act.dateClosed} onChange={updateAction(index, "dateClosed")} />)}
                                    </Box>
                                    </Box>
                                    <GeneralFormTableRowControls
                                        downloading={downloading}
                                        action={action}
                                        rowIndex={index}
                                        rowCount={actions.length}
                                        minRows={1}
                                        maxRows={25}
                                        borderColor={borderColor}
                                        onInsertAfter={insertActionAfter}
                                        onRemoveAt={removeActionAt}
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
                defaultName={formMetadata.name || `Management Inspection - ${new Date().toLocaleDateString()}`}
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
