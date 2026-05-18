import React, { useState, useEffect, useRef } from "react";
import { 
    Box, Typography, Button, Paper, TextField, Table, TableBody, 
    TableCell, TableHead, TableRow, TableContainer, CircularProgress, 
    IconButton, Checkbox, Grid, Divider
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import SignatureCapture from "../components/SignatureCapture";
import GeneralFormTableRowControls from "../components/GeneralFormTableRowControls";
import { Download, ArrowLeft, Save, Printer } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useSearchParams } from "react-router-dom";
import { useGeneralFormRouteSubmissionIds } from "../hooks/useGeneralFormRouteSubmissionIds";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";

const DEFAULT_ADSTONE_BRIEFING_ITEMS = [
    { title: "Structural Steel Method Statement", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "Lifting Plan Structural Steel", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "Project Risk Assessments", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "Inspection and Test Plan", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "Safe Loading and Unloading of Steel", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "SHEQ Management Plan", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "Other (Please list below)", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "", checked: false, date: "", signInductee: "", signInductor: "" },
    { title: "", checked: false, date: "", signInductee: "", signInductor: "" },
];

const MIN_ADSTONE_BRIEFING_ITEM_ROWS = 7;

export default function AdstoneSiteInductionForm() {
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } = useGeneralFormRouteSubmissionIds();
    const [searchParams] = useSearchParams();
    const category = searchParams.get("category") || "Induction";
    const action = searchParams.get("action");
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    
    // Save Dialog State
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({
        name: "",
        tags: "",
        visibility: GENERAL_FORM_VISIBILITY.PRIVATE,
    });

    // Form State
    const [formData, setFormData] = useState({
        inductee: "",
        inductor: "",
        jobNo: "",
        projectName: "",
        briefingItems: DEFAULT_ADSTONE_BRIEFING_ITEMS.map((row) => ({ ...row })),
        erectorSignature: "",
        supervisorSignature: "",
        metadata: {
            writtenBy: "",
            approvedBy: "",
            docNo: "",
            revNo: "",
            date: "",
            page: ""
        }
    });

    const [headerLabels, setHeaderLabels] = useState({
        formTitle: "Site Documentation and Induction Briefing Form",
        writtenByLabel: "Written by",
        docNoLabel: "Doc. No.",
        revNoLabel: "Rev. No.",
        approvedByLabel: "Approved by",
        dateLabel: "Date:",
        inductee: "Inductee",
        inductor: "Inductor",
        jobNo: "Job No.",
        projectName: "Project Name",
        docTitle: "Document Title",
        tickBriefed: "Please tick once briefed",
        date: "Date",
        sigInductee: "Signature Inductee",
        sigInductor: "Signature Inductor",
        disclaimer: "I hereby confirm that I have received, read and fully understood the approved site documents and sign to say that I fully agree to work to the documented site requirements for this PROJECT listed below",
        tighteningHeader: "Tightening of bolts",
        erectorResp: "Site erector responsibility – I understand that I have a responsibility on this contract to colour mark and initial the bolts that I tighten following procedure outlined in the Method Statement.",
        supervisorResp: "Site Supervisor responsibility I understand that I have responsibility to ensure that all of the bolts tightened are colour marked and initialled to the erector undertaking and that I will carry out the 10% bolt check completing the marking plan and form SF 016",
        erectorSignLabel: "Site Erector (sign)",
        supervisorSignLabel: "Site Supervisor (sign)",
        agreement: "By signing above, I confirm that I will work safely in accordance with the above documentation, attend weekly toolbox talks and training given by Adstone, follow site rules as per site induction and shall be responsible for my own health and safety as well as that of others and shall report any concerns immediately to the Site Person in charge."
    });

    const [persistedSiteId, setPersistedSiteId] = useState(null);

    const { canEdit, siteId, pdfLayout, contentReadOnly } = useGeneralFormTemplateAccess(
        action,
        downloading,
        persistedSiteId
    );

    const performSave = async (
        asNew = false,
        name = "",
        tags = "",
        visibility = formMetadata.visibility
    ) => {
        setSaving(true);
        try {
            let payload = {
                ...formData,
                headerLabels,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags,
            };
            if (siteId) payload.siteId = siteId;
            payload = withGeneralFormVisibility(payload, visibility, {
                hasSiteContext: Boolean(siteId),
            });

            if (persistedResponseId && !asNew) {
                await api.put(`/forms/responses/${persistedResponseId}`, {
                    answers: payload,
                });
            } else {
                const formId = await getOrCreateTemplateForm("Adstone Site Induction Form");
                await api.post(`/forms/${formId}/responses`, {
                    answers: payload,
                    category,
                    siteId,
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
            alert("Failed to save form");
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
        watchDeps: [formData, headerLabels],
        siteId,
        category,
        saving,
        canQuickSave: Boolean(persistedResponseId && formMetadata.name?.trim()),
        onQuickSave: () =>
            performSave(false, formMetadata.name, formMetadata.tags, formMetadata.visibility),
        onOpenSaveDialog: () => setSaveDialogOpen(true),
    });

    useEffect(() => {
        if (!persistedResponseId && !fromTemplateId) setPersistedSiteId(null);
    }, [persistedResponseId, fromTemplateId]);

    useEffect(() => {
        if (seedSubmissionId) {
            loadSubmission(seedSubmissionId);
        } else if (siteId) {
             // Try to pre-fill project name from site name if available
             loadSiteName();
        }
    }, [seedSubmissionId, siteId]);

    const loadSiteName = async () => {
        try {
            const sites = await api.get('/sites');
            const site = sites.data.find(s => s._id === siteId || s.id === siteId);
            if (site) {
                setFormData(prev => ({ ...prev, projectName: site.name }));
            }
        } catch (e) {
            console.error("Failed to load site name", e);
        }
    };

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                const submission = res.data.data.find(r => r.id === submissionId || r._id === submissionId);
                if (submission && submission.answers) {
                    setPersistedSiteId(submission.answers.siteId ?? null);
                    setFormData(submission.answers);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    setFormMetadata({
                        name: submission.answers.name || `Induction Briefing - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const handleSave = () => {
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

    const handleDownload = async () => {
        setDownloading(true);
        // Small delay to ensure React renders the static text version for the PDF capture
        setTimeout(async () => {
            try {
                // High-fidelity single-page fit with balanced margins
                await downloadPdfFromRef(containerRef, `Adstone_Induction_${formData.inductee || "Form"}`, null, { 
                    onePageOnly: true,
                    marginX: 8,
                    marginY: 12
                });
            } catch (e) {
                console.error("Download failed", e);
            } finally {
                setDownloading(false);
            }
        }, 300);
    };

    const handleBriefingItemChange = (index, field, value) => {
        const newItems = [...formData.briefingItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, briefingItems: newItems });
    };

    const insertBriefingItemAfter = (index) => {
        setFormData((prev) => {
            if (prev.briefingItems.length >= 25) return prev;
            const next = [...prev.briefingItems];
            next.splice(index + 1, 0, {
                title: "",
                checked: false,
                date: "",
                signInductee: "",
                signInductor: "",
            });
            return { ...prev, briefingItems: next };
        });
    };
    const removeBriefingItemAt = (index) => {
        setFormData((prev) => {
            if (prev.briefingItems.length <= MIN_ADSTONE_BRIEFING_ITEM_ROWS) return prev;
            return { ...prev, briefingItems: prev.briefingItems.filter((_, i) => i !== index) };
        });
    };

    const setSignatureAt = (dataUrl, field, index = null) => {
        if (index !== null) {
            const newItems = [...formData.briefingItems];
            newItems[index] = { ...newItems[index], [field]: dataUrl || "" };
            setFormData({ ...formData, briefingItems: newItems });
        } else {
            setFormData({ ...formData, [field]: dataUrl || "" });
        }
    };

    const SignatureField = ({ value, field, index = null, compact = false }) => {
        if (pdfLayout && !value) return <Box sx={{ minHeight: 30 }} />;
        const displayVal =
            value && (String(value).startsWith("data:image") || String(value).startsWith("http"))
                ? value
                : null;
        return (
            <Box sx={{ width: "100%", minHeight: pdfLayout ? 30 : undefined, p: 0.5 }}>
                <SignatureCapture
                    value={displayVal}
                    onChange={(url) => setSignatureAt(url, field, index)}
                    readOnly={contentReadOnly}
                    compact={compact}
                />
            </Box>
        );
    };

    const borderColor = "#000000";
    const headerBg = "#FFFFFF";

    if (loading) return <Layout><Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box></Layout>;

    return (
        <Layout pageTitle="Site Induction Form">
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={navigateBack} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                </Box>
                {canEdit && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        variant="contained" 
                        onClick={handleSave}
                        disabled={saving || !canEdit || downloading}
                        startIcon={<Save size={18} />}
                        sx={{ 
                            bgcolor: "#E89F17", 
                            "&:hover": { bgcolor: "#cc8b14" },
                            borderRadius: 2, 
                            textTransform: 'none', 
                            fontWeight: 600,
                            px: 4
                        }}
                    >
                        {saving ? "Saving..." : "Save Form"}
                    </Button>
                </Box>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 8 }}>
                <Paper 
                    ref={containerRef}
                    elevation={pdfLayout ? 0 : 3}
                    sx={{ 
                        width: "100%", 
                        maxWidth: pdfLayout ? "1100px" : "1000px", 
                        p: 0, 
                        bgcolor: "#FFFFFF", 
                        color: "#333",
                        borderRadius: 1,
                        overflow: 'hidden',
                        fontFamily: "'Arial', sans-serif"
                    }}
                >
                    {/* TOP HEADER GRID WRAPPER */}
                    <Box sx={{ border: `2.5px solid ${borderColor}`, m: pdfLayout ? 1 : 2 }}>
                        {/* Row 1: Company Info | Title | Logo */}
                        <Box sx={{ display: 'flex', borderBottom: `2px solid ${borderColor}`, minHeight: pdfLayout ? '100px' : '120px' }}>
                            {/* Company Info */}
                            <Box sx={{ width: '33.33%', p: 1.5, borderRight: `2px solid ${borderColor}`, fontSize: '0.75rem' }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>Adstone Construction Ltd</Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: '#333' }}>Wassage Way, Hampton Lovett Industrial Estate</Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: '#333' }}>Droitwich, Worcestershire</Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: '#333' }}>WR9 0NX</Typography>
                            </Box>

                            {/* Form Title (Middle) */}
                            <Box sx={{ width: '33.33%', borderRight: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 0, bgcolor: '#FFFFFF' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#333', p: 2 }}>{headerLabels.formTitle}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: '#333', p: 2, fontWeight: 700, fontSize: '1.1rem', textAlign: 'center' } }}
                                        value={headerLabels.formTitle}
                                        onChange={(e) => setHeaderLabels({...headerLabels, formTitle: e.target.value})}
                                    />)
                                }
                            </Box>

                            {/* Logo Box (Right) */}
                            <Box sx={{ width: '33.33%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 1.5 }}>
                                {formData.logoRight ? (
                                    <>
                                        <Box component="img" src={formData.logoRight} alt="Right Logo" 
                                             sx={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
                                        {!contentReadOnly && (
                                            <Button variant="text" size="small" component="label" sx={{ fontSize: '0.65rem', mt: 0.5 }}>
                                                Change Logo
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setFormData({...formData, logoRight: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    !contentReadOnly ? (
                                        <Button variant="outlined" component="label" size="small">
                                            Upload Logo
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setFormData({...formData, logoRight: ev.target.result});
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </Button>
                                    ) : (
                                        <Box component="img" src="/logo11.png" alt="Adstone" 
                                             sx={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
                                    )
                                )}
                            </Box>
                        </Box>

                        {/* Row 2: Written by | Value | Doc No | Rev No */}
                        <Box sx={{ display: 'flex', borderBottom: `2px solid ${borderColor}`, fontSize: '0.75rem' }}>
                            <Box sx={{ width: '15%', p: 0.75, fontWeight: 700, borderRight: `1.5px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                {contentReadOnly ? (
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.writtenByLabel}</Typography>
                                ) : (
                                    <TextField
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.75rem' } }}
                                        value={headerLabels.writtenByLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, writtenByLabel: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: '25%', borderRight: `2px solid ${borderColor}`, p: 0 }}>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 1, py: 0.5, fontSize: '0.75rem' }}>{formData.metadata.writtenBy}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.writtenBy} 
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, writtenBy: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 1, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                            <Box sx={{ width: '30%', borderRight: `2px solid ${borderColor}`, p: 0, display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ pl: 1, pr: 0.5 }}>
                                    {contentReadOnly ? (
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.docNoLabel}</Typography>
                                    ) : (
                                        <TextField
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.75rem', width: '60px' } }}
                                            value={headerLabels.docNoLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, docNoLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 0.5, py: 0.5, fontSize: '0.75rem' }}>{formData.metadata.docNo}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.docNo}
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, docNo: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 0.5, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                            <Box sx={{ width: '30%', p: 0, display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ pl: 1, pr: 0.5 }}>
                                    {contentReadOnly ? (
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.revNoLabel}</Typography>
                                    ) : (
                                        <TextField
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.75rem', width: '60px' } }}
                                            value={headerLabels.revNoLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, revNoLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 0.5, py: 0.5, fontSize: '0.75rem' }}>{formData.metadata.revNo}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.revNo}
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, revNo: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 0.5, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                        </Box>

                        {/* Row 3: Approved by | Value | Date | Page */}
                        <Box sx={{ display: 'flex', fontSize: '0.75rem' }}>
                            <Box sx={{ width: '15%', p: 0.75, fontWeight: 700, borderRight: `1.5px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                {contentReadOnly ? (
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.approvedByLabel}</Typography>
                                ) : (
                                    <TextField
                                        variant="standard"
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.75rem' } }}
                                        value={headerLabels.approvedByLabel}
                                        onChange={(e) => setHeaderLabels({...headerLabels, approvedByLabel: e.target.value})}
                                    />
                                )}
                            </Box>
                            <Box sx={{ width: '25%', borderRight: `2px solid ${borderColor}`, p: 0 }}>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 1, py: 0.5, fontSize: '0.85rem' }}>{formData.metadata.approvedBy}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.approvedBy}
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, approvedBy: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 1, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                            <Box sx={{ width: '30%', borderRight: `2px solid ${borderColor}`, p: 0, display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ pl: 1, pr: 0.5 }}>
                                    {contentReadOnly ? (
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{headerLabels.dateLabel}</Typography>
                                    ) : (
                                        <TextField
                                            variant="standard"
                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.85rem', width: '60px' } }}
                                            value={headerLabels.dateLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, dateLabel: e.target.value})}
                                        />
                                    )}
                                </Box>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 0.5, py: 0.5, fontSize: '0.85rem' }}>{formData.metadata.date}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.date}
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, date: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 0.5, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                            <Box sx={{ width: '30%', p: 0, display: 'flex', alignItems: 'center' }}>
                                <Typography sx={{ pl: 1, pr: 0.5, fontWeight: 700, fontSize: '0.75rem' }}>Page</Typography>
                                {contentReadOnly ? (
                                    <Typography sx={{ px: 0.5, py: 0.5, fontSize: '0.75rem' }}>{formData.metadata.page}</Typography>
                                ) : (
                                    <TextField fullWidth variant="standard" value={formData.metadata.page}
                                        onChange={(e) => setFormData({...formData, metadata: {...formData.metadata, page: e.target.value}})}
                                        InputProps={{ disableUnderline: true, sx: { px: 0.5, py: 0.5, fontSize: '0.85rem' } }} />
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {/* FORM CONTENT */}
                    <Box sx={{ p: pdfLayout ? 1.5 : 4 }}>


                        {/* BASIC DETAILS TABLE */}
                        <Box sx={{ border: `1.5px solid ${borderColor}`, mb: 4 }}>
                            {[
                                { label: headerLabels.inductee, field: "inductee", labelKey: "inductee" },
                                { label: headerLabels.inductor, field: "inductor", labelKey: "inductor" },
                                { label: headerLabels.jobNo, field: "jobNo", labelKey: "jobNo" },
                                { label: headerLabels.projectName, field: "projectName", labelKey: "projectName" }
                            ].map((row, idx) => (
                                <Box key={row.field} sx={{ display: 'flex', borderBottom: idx < 3 ? `1px solid ${borderColor}` : 'none' }}>
                                    <Box sx={{ width: '25%', p: 0, fontWeight: 700, bgcolor: '#F9FAFB', borderRight: `1.5px solid ${borderColor}` }}>
                                        {contentReadOnly ? 
                                            (<Typography sx={{ p: pdfLayout ? 0.5 : 1, fontWeight: 700, fontSize: pdfLayout ? '0.7rem' : '1rem' }}>{row.label}</Typography>) : 
                                            (<TextField 
                                                fullWidth 
                                                variant="standard" 
                                                InputProps={{ disableUnderline: true, sx: { px: 1, py: 1, fontWeight: 700, fontSize: '1rem' } }}
                                                value={row.label}
                                                onChange={(e) => setHeaderLabels({...headerLabels, [row.labelKey]: e.target.value})}
                                            />)
                                        }
                                    </Box>
                                    <Box sx={{ width: '75%', p: 0 }}>
                                        {contentReadOnly ? (
                                            <Typography sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>{formData[row.field]}</Typography>
                                        ) : (
                                            <TextField 
                                                fullWidth 
                                                variant="standard" 
                                                value={formData[row.field]} 
                                                onChange={(e) => setFormData({ ...formData, [row.field]: e.target.value })}
                                                InputProps={{ disableUnderline: true, sx: { px: 1.5, py: 1, fontSize: '0.95rem' } }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            {contentReadOnly ? 
                                (<Typography sx={{ fontStyle: 'italic', fontSize: '0.95rem' }}>{headerLabels.disclaimer}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    multiline
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { fontStyle: 'italic', fontSize: '0.95rem' } }}
                                    value={headerLabels.disclaimer}
                                    onChange={(e) => setHeaderLabels({...headerLabels, disclaimer: e.target.value})}
                                />)
                            }
                        </Box>

                        {/* BRIEFING TABLE */}
                        <TableContainer sx={{ border: `1.5px solid ${borderColor}`, mb: 4 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#F3F4F6' }}>
                                        <TableCell sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, width: '40%', p: 0 }}>
                                            {contentReadOnly ? 
                                                (<Typography sx={{ px: 1, fontWeight: 700 }}>{headerLabels.docTitle}</Typography>) : 
                                                (<TextField 
                                                    fullWidth 
                                                    variant="standard" 
                                                    InputProps={{ disableUnderline: true, sx: { px: 1, py: 1, fontWeight: 700 } }}
                                                    value={headerLabels.docTitle}
                                                    onChange={(e) => setHeaderLabels({...headerLabels, docTitle: e.target.value})}
                                                />)
                                            }
                                        </TableCell>
                                        <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, width: '15%', p: 0 }}>
                                            {contentReadOnly ? 
                                                (<Typography align="center" sx={{ px: 1, fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.tickBriefed}</Typography>) : 
                                                (<TextField 
                                                    fullWidth 
                                                    multiline
                                                    variant="standard" 
                                                    InputProps={{ disableUnderline: true, sx: { px: 1, py: 0.5, fontWeight: 700, fontSize: '0.75rem', textAlign: 'center' } }}
                                                    value={headerLabels.tickBriefed}
                                                    onChange={(e) => setHeaderLabels({...headerLabels, tickBriefed: e.target.value})}
                                                />)
                                            }
                                        </TableCell>
                                        <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, width: '15%', p: 0 }}>
                                            {contentReadOnly ? 
                                                (<Typography align="center" sx={{ px: 1, fontWeight: 700 }}>{headerLabels.date}</Typography>) : 
                                                (<TextField 
                                                    fullWidth 
                                                    variant="standard" 
                                                    InputProps={{ disableUnderline: true, sx: { px: 1, py: 1, fontWeight: 700, textAlign: 'center' } }}
                                                    value={headerLabels.date}
                                                    onChange={(e) => setHeaderLabels({...headerLabels, date: e.target.value})}
                                                />)
                                            }
                                        </TableCell>
                                        <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, width: '15%', p: 0 }}>
                                            {contentReadOnly ? 
                                                (<Typography align="center" sx={{ px: 1, fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.sigInductee}</Typography>) : 
                                                (<TextField 
                                                    fullWidth 
                                                    multiline
                                                    variant="standard" 
                                                    InputProps={{ disableUnderline: true, sx: { px: 1, py: 0.5, fontWeight: 700, fontSize: '0.75rem', textAlign: 'center' } }}
                                                    value={headerLabels.sigInductee}
                                                    onChange={(e) => setHeaderLabels({...headerLabels, sigInductee: e.target.value})}
                                                />)
                                            }
                                        </TableCell>
                                        <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: 700, width: '15%', p: 0 }}>
                                            {contentReadOnly ? 
                                                (<Typography align="center" sx={{ px: 1, fontWeight: 700, fontSize: '0.75rem' }}>{headerLabels.sigInductor}</Typography>) : 
                                                (<TextField 
                                                    fullWidth 
                                                    multiline
                                                    variant="standard" 
                                                    InputProps={{ disableUnderline: true, sx: { px: 1, py: 0.5, fontWeight: 700, fontSize: '0.75rem', textAlign: 'center' } }}
                                                    value={headerLabels.sigInductor}
                                                    onChange={(e) => setHeaderLabels({...headerLabels, sigInductor: e.target.value})}
                                                />)
                                            }
                                        </TableCell>
                                        {!pdfLayout && (
                                            <TableCell
                                                sx={{ border: `1px solid ${borderColor}`, width: 52, maxWidth: 52, p: 0, verticalAlign: "middle", bgcolor: "#F3F4F6" }}
                                            />
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {formData.briefingItems.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell sx={{ border: `1px solid ${borderColor}`, p: '6px', minHeight: 35, verticalAlign: 'middle' }}>
                                                {contentReadOnly ? (
                                                    <Typography sx={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                                                        {item.title}
                                                    </Typography>
                                                ) : (
                                                    <TextField 
                                                        fullWidth 
                                                        variant="standard" 
                                                        multiline={idx >= 6}
                                                        rows={idx >= 6 ? 2 : 1}
                                                        placeholder={idx >= 7 ? "Add other..." : ""}
                                                        value={item.title} 
                                                        onChange={(e) => handleBriefingItemChange(idx, "title", e.target.value)}
                                                        InputProps={{ 
                                                            disableUnderline: true, 
                                                            sx: { 
                                                                px: 0.5, 
                                                                fontSize: '0.85rem',
                                                                lineHeight: 1.2
                                                            },
                                                            readOnly: idx < 6 
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, p: 0 }}>
                                                {contentReadOnly ? (
                                                    item.checked ? <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>✓</Typography> : ''
                                                ) : (
                                                    <Checkbox 
                                                        size="small"
                                                        checked={item.checked} 
                                                        disabled={contentReadOnly}
                                                        onChange={(e) => handleBriefingItemChange(idx, "checked", e.target.checked)} 
                                                        sx={{ 
                                                            p: 0.5, 
                                                            '& .MuiSvgIcon-root': { fontSize: 20 },
                                                            color: '#888'
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, p: 0 }}>
                                                {contentReadOnly ? (
                                                    <Typography sx={{ fontSize: '0.7rem' }}>{item.date}</Typography>
                                                ) : (
                                                    <TextField 
                                                        fullWidth 
                                                        variant="standard" 
                                                        value={item.date} 
                                                        onChange={(e) => handleBriefingItemChange(idx, "date", e.target.value)}
                                                        InputProps={{ disableUnderline: true, sx: { px: 1, textAlign: 'center', fontSize: '0.85rem' } }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, p: 0 }}>
                                                <SignatureField
                                                    value={item.signInductee}
                                                    field="signInductee"
                                                    index={idx}
                                                    compact
                                                />
                                            </TableCell>
                                            <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, p: 0 }}>
                                                <SignatureField
                                                    value={item.signInductor}
                                                    field="signInductor"
                                                    index={idx}
                                                    compact
                                                />
                                            </TableCell>
                                            {!pdfLayout && (
                                                <TableCell
                                                    align="center"
                                                    sx={{ border: `1px solid ${borderColor}`, width: 52, maxWidth: 52, p: 0, verticalAlign: "middle" }}
                                                >
                                                    <GeneralFormTableRowControls
                                                        downloading={downloading}
                                                        action={action}
                                                        rowIndex={idx}
                                                        rowCount={formData.briefingItems.length}
                                                        minRows={MIN_ADSTONE_BRIEFING_ITEM_ROWS}
                                                        maxRows={25}
                                                        borderColor={borderColor}
                                                        onInsertAfter={insertBriefingItemAfter}
                                                        onRemoveAt={removeBriefingItemAt}
                                                        accessLocked={!canEdit}
                                                    />
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mb: 4 }}>
                            {contentReadOnly ? 
                                (<Typography sx={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{headerLabels.agreement}</Typography>) : 
                                (<TextField 
                                    fullWidth 
                                    multiline
                                    variant="standard" 
                                    InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem', lineHeight: 1.4 } }}
                                    value={headerLabels.agreement}
                                    onChange={(e) => setHeaderLabels({...headerLabels, agreement: e.target.value})}
                                />)
                            }
                        </Box>

                        {/* TIGHTENING OF BOLTS SECTION */}
                        <Box sx={{ mb: 6 }}>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                                {contentReadOnly ? 
                                    (<Typography variant="h6" sx={{ fontWeight: 800 }}>{headerLabels.tighteningHeader}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 800, fontSize: '1.25rem', textAlign: 'center' } }}
                                        value={headerLabels.tighteningHeader}
                                        onChange={(e) => setHeaderLabels({...headerLabels, tighteningHeader: e.target.value})}
                                    />)
                                }
                            </Box>
                                                       <Box sx={{ mb: 3 }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{headerLabels.erectorResp}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.95rem' } }}
                                        value={headerLabels.erectorResp}
                                        onChange={(e) => setHeaderLabels({...headerLabels, erectorResp: e.target.value})}
                                    />)
                                }
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
                                    <Box sx={{ width: 'auto', mr: 2, whiteSpace: 'nowrap' }}>
                                        {contentReadOnly ? 
                                            (<Typography sx={{ color: '#D32F2F', fontWeight: 600 }}>{headerLabels.erectorSignLabel}</Typography>) : 
                                            (<TextField 
                                                variant="standard" 
                                                InputProps={{ disableUnderline: true, sx: { color: '#D32F2F', fontWeight: 600, width: '150px' } }}
                                                value={headerLabels.erectorSignLabel}
                                                onChange={(e) => setHeaderLabels({...headerLabels, erectorSignLabel: e.target.value})}
                                            />)
                                        }
                                    </Box>
                                    <Box sx={{ flex: 1, borderBottom: '1px dotted #D32F2F', minHeight: 40, display: 'flex', alignItems: 'center' }}>
                                        <SignatureField
                                            value={formData.erectorSignature}
                                            field="erectorSignature"
                                        />
                                    </Box>
                                </Box>
                            </Box>
 
                            <Box>
                                {contentReadOnly ? 
                                    (<Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{headerLabels.supervisorResp}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.95rem' } }}
                                        value={headerLabels.supervisorResp}
                                        onChange={(e) => setHeaderLabels({...headerLabels, supervisorResp: e.target.value})}
                                    />)
                                }
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
                                    <Box sx={{ width: 'auto', mr: 2, whiteSpace: 'nowrap' }}>
                                        {contentReadOnly ? 
                                            (<Typography sx={{ color: '#D32F2F', fontWeight: 600 }}>{headerLabels.supervisorSignLabel}</Typography>) : 
                                            (<TextField 
                                                variant="standard" 
                                                InputProps={{ disableUnderline: true, sx: { color: '#D32F2F', fontWeight: 600, width: '150px' } }}
                                                value={headerLabels.supervisorSignLabel}
                                                onChange={(e) => setHeaderLabels({...headerLabels, supervisorSignLabel: e.target.value})}
                                            />)
                                        }
                                    </Box>
                                    <Box sx={{ flex: 1, borderBottom: '1px dotted #D32F2F', minHeight: 40, display: 'flex', alignItems: 'center' }}>
                                        <SignatureField
                                            value={formData.supervisorSignature}
                                            field="supervisorSignature"
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {/* FOOTER TEXT */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', mt: 4 }}>
                            <Typography>Internal – Adstone Construction</Typography>
                            <Typography>Uncontrolled when printed or downloaded</Typography>
                        </Box>
                    </Box>
                </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `Induction Briefing - ${new Date().toLocaleDateString()}`}
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
