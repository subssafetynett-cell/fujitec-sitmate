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
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { useGeneralFormTemplateAccess } from "../hooks/useGeneralFormTemplateAccess";
import { useGeneralFormLeave } from "../hooks/useGeneralFormLeave";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import GeneralFormTableRowControls from "../components/GeneralFormTableRowControls";
import { useGeneralFormSaveNavigate } from "../hooks/useGeneralFormSaveNavigate";
import { appendTemplatesPageMetadata, templateSaveButtonLabel, isTemplatesPageEditContext} from "../utils/templatePageContext";
import brandLogoLeftUrl from "../assets/pdf-logo-left.png";
import brandLogoRightUrl from "../assets/pdf-logo-right.png";

const FORM_TITLE = "Site Induction Form";
const FORM_BASE_PATH = "/general-forms/site-induction-form";
import FormDocumentHeader from "../components/FormDocumentHeader";
import FormHeaderApprovedRow from "../components/FormHeaderApprovedRow";

/** Stable id for extra arrangement rows so React keys survive insert/delete. */
const createExtraArrangementId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `extra-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const createExtraArrangement = () => ({
    id: createExtraArrangementId(),
    label: "",
    answer: "",
});

const normalizeExtraArrangements = (extras) =>
    (Array.isArray(extras) ? extras : []).map((extra) => ({
        id: extra?.id || createExtraArrangementId(),
        label: extra?.label ?? "",
        answer: extra?.answer ?? "",
    }));

/** Block-based PDF: form header box on every page; logos in form slots only. */
const SITE_INDUCTION_PDF_OPTIONS = {
    paginateBlocks: true,
    skipBrandLogos: true,
    skipBuiltInFooter: true,
    marginX: 8,
    headerInsetMm: 4,
    footerInsetMm: 10,
    blockGapMm: 0,
    blockScale: 1.75,
    jpegQuality: 0.82,
    captureConcurrency: 3,
    targetMaxBytes: 1.45 * 1024 * 1024,
    maxOutputBytes: 5 * 1024 * 1024,
    fitBlockToPage: false,
};

export default function SiteInductionRecordForm() {
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
        // Section A
        nameOfSite: "",
        locationAddress: "",
        sectionADate: "",
        
        // Section B
        fullName: "",
        jobTitle: "",
        companyName: "",
        orgProcedures: "",

        // Section C
        cscs: false,
        asbestosAwareness: false,
        firstAid: false,
        healthSafety: false,
        smsts: false,
        otherSkills: "",
        cardNumber: "",
        expiryDate: "",
        isFirstAider: "",
        isBelowHookTrained: "",

        // Section D
        emergencyContactName: "",
        relationship: "",
        contactNumber: "",
        asthma: false,
        heartCondition: false,
        diabetic: false,
        epilepsy: false,
        hearingLoss: false,
        otherMedical: "",
        
        // Section E (Works)
        briefedOnRAMS: "",

        // Section F (Arrangements Map - index -> "Yes" | "No" | "N/A")
        arrangements: {},
        // Editable labels for blank arrangement rows (keyed by base index)
        arrangementLabels: {},
        // Extra custom arrangement rows appended after the page-3 defaults
        extraArrangements: [],

        // Open Discussion
        openDiscussion: "",

        // Section E (Confirmation)
        inducteePrintName: "",
        inducteeSignature: "",
        inductorPrintName: "",
        inductorSignature: ""
    });

    const [headerLabels, setHeaderLabels] = useState({
        topFormTitle: "SITE INDUCTION FORM",
        topDateLabel: "Date",
        topDocNoLabel: "Document No. & Rev",
        topApprovedByLabel: "Approved by",
        sectionA: "Section A: Details",
        nameOfSite: "Name of Site",
        locationAddress: "Location / Address",
        sectionADate: "Date",
        sectionB: "Section B: Who is being inducted",
        fullName: "Full Name:",
        jobTitle: "Job Title:",
        companyName: "Company Name:",
        companySub: "(If Subcontractor)",
        orgProcedures: "(or if you are self-employed working under another organisations procedures)",
        sectionC: "Section C: Skills and Knowledge – (tick relevant card type (s))",
        cscs: "CSCS",
        asbestos: "Asbestos Awareness",
        firstAid: "First Aid",
        healthSafety: "Health & Safety",
        smsts: "SMSTS or equivalent – Please state below",
        otherSkills: "Other",
        cardNumber: "Card Number:",
        expiryDate: "Expiry Date:",
        firstAider: "Are you first aider / Appointed Person?",
        liftingTrained: "Are you Below Hook – Lifting Operations trained?",
        sectionD: "Section D: Emergency Information",
        emergencyContact: "Emergency Contact Name:",
        relationship: "Relationship:",
        contactNumber: "Contact Number:",
        medicalCondition: "Do you have any medical condition that our First Aider or Site Supervisors should be made aware of?",
        medicalAsthma: "Asthma",
        medicalHeart: "Heart Condition",
        medicalDiabetic: "Diabetic",
        medicalEpilepsy: "Epilepsy",
        medicalHearing: "Hearing Loss",
        medicalOther: "Other – Please State",
        medicalPrivacy: "This information is not mandatory. However, providing it will ensure you receive prompt and appropriate treatment whilst working on our site.",
        sectionE: "Section E: Works Briefing",
        projMgmt: "Project Management",
        ramsBrief: "The Risk Assessments and Method Statements including COSHH briefing MUST be conducted as part of Induction.",
        ramsQuestion: "Have you been briefed on the RAMS and Lift Plans?",
        sectionF: "Section F: Arrangements – Tick the relevant Topics discussed that are applicable during the Induction Training.",
        openDiscussion: "Open discussion – highlight other areas raised by the inductee:",
        openSub: "All sufficient changes or updates along with continuous control will be managed in the form of ‘toolbox talks’ and ‘meetings’.",
        confirmation: "Section E: Confirmation of induction – I understand all the information and instruction given in this induction",
        inducteeLabel: "Print Name: (Inductee)",
        inductorLabel: "Print Name: (Inductor)",
        sigLabel: "Signature:"
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

    useEffect(() => {
        const docKey = persistedResponseId || seedSubmissionId;
        if (!loading && action === "download" && docKey) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `SiteInductionForm_${docKey}`, () => {
                    setDownloading(false);
                    window.close();
                }, SITE_INDUCTION_PDF_OPTIONS);
            }, 500);
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
                    if (submission.answers.formData) {
                        const loaded = submission.answers.formData;
                        setFormData({
                            ...loaded,
                            arrangements: loaded.arrangements || {},
                            arrangementLabels: loaded.arrangementLabels || {},
                            extraArrangements: normalizeExtraArrangements(loaded.extraArrangements),
                        });
                    }
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    setFormMetadata({
                        name: submission.answers.name || `Site Induction Record - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const toggleCheckbox = (field) => () => {
        setFormData({ ...formData, [field]: !formData[field] });
    };

    const updateArrangement = (index, val) => {
        setFormData(prev => ({
            ...prev,
            arrangements: {
                ...prev.arrangements,
                [index]: val
            }
        }));
    };

    const updateArrangementLabel = (index, label) => {
        setFormData((prev) => ({
            ...prev,
            arrangementLabels: {
                ...(prev.arrangementLabels || {}),
                [index]: label,
            },
        }));
    };

    const updateExtraArrangement = (extraIndex, patch) => {
        setFormData((prev) => {
            const extras = [...(prev.extraArrangements || [])];
            extras[extraIndex] = { ...(extras[extraIndex] || createExtraArrangement()), ...patch };
            return { ...prev, extraArrangements: extras };
        });
    };

    const insertExtraArrangementAfter = (extraIndex) => {
        setFormData((prev) => {
            const extras = [...(prev.extraArrangements || [])];
            if (extras.length >= 30) return prev;
            extras.splice(extraIndex + 1, 0, createExtraArrangement());
            return { ...prev, extraArrangements: extras };
        });
    };

    const removeExtraArrangementAt = (extraIndex) => {
        setFormData((prev) => {
            const extras = [...(prev.extraArrangements || [])];
            if (extras.length === 0) return prev;
            extras.splice(extraIndex, 1);
            return { ...prev, extraArrangements: extras };
        });
    };

    const addExtraArrangementRow = () => {
        setFormData((prev) => ({
            ...prev,
            extraArrangements: [...(prev.extraArrangements || []), createExtraArrangement()],
        }));
    };

    const ARRANGEMENTS_PAGE_2 = [
        "Detail the scope of the project",
        "Key members of the 'Site Management Team' (including Fire Marshals | First Aiders | Contact Telephone)",
        "Training and Competence (current registration card e.g. CSCS, CSCS Affiliated Schemes (or equivalent)",
        "Covid – 19 Precautions | Control Measures etc.",
        "Traffic management & Storage arrangements explained (boundaries, routes, security procedures etc)",
        "Location of the welfare facilities",
        "Methods of consultation and communication (method statements, toolbox talks etc)",
        "Actions to be taken in the event of accident, incident or near miss (including reporting & investigation)",
        "Name(s) of the site first aider(s) and facilities available, along with location",
        "Fire & Emergency procedures (escape route, assembly points, how to raise Alarm, Fire Prevention etc)",
        "Location of fire alarms and fire extinguishers.",
        "Smoking restrictions and if relevant the designated area",
        "Site rules explained (e.g. Drugs & alcohol, no radios, no horse play,",
        "Minimum PPE requirements (including task specific PPE)",
        "Permit procedures (Hot works | Permit to Work | other)",
        "Housekeeping and waste segregation",
        "Compliance with company IMS procedures where appropriate (including SHEQ Policies)",
        "Welfare Facilities (Changing rooms | Canteen | Toilets etc)",
        "Safe use of plant and equipment",
        "Working at Heights",
        "Safe use of scaffolding, mobile towers etc (scaff-tag system / inspections)",
        "Control of Substances Hazardous to Health",
        "Control of Vibration",
        "Control of Noise",
        "Electrical Safety (including PAT)",
        "Lifting Equipment and accessories (12monthly and 6monthly Thorough Examinations | Sling protection etc.)",
        "Manual Handling",
        "Slips, Trips and falls | Control of Site Visitors",
        { header: "Site specific information which was raised within the pre-construction information pack:" },
        "Asbestos",
        "Occupied Building (live site working restrictions)",
        "End use and client's requirements",
        "Restricted or prohibited areas | Buried services | Underground services",
        "", // Blank row
        { header: "Environment information known or raised within the pre-construction information pack:" },
        "Noise Restrictions",
        "Waste Management"
    ];

    const ARRANGEMENTS_PAGE_3 = [
        "Hydraulic Oil (storage)",
        "Spillage Management",
        "", // Blank row
    ];

    const borderColor = pdfLayout ? "#CCC" : isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = pdfLayout ? "#E5E7EB" : isDarkMode ? "rgba(255,255,255,0.05)" : "#E5E7EB";
    const textColor = pdfLayout ? "#111827" : isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "4px 8px";
    const rowNowrap = pdfLayout ? "nowrap" : { xs: "wrap", md: "nowrap" };
    const pageBlockSx = {
        mb: pdfLayout ? 0 : 6,
    };

    const checkboxMarkSx = {
        width: 14,
        height: 14,
        border: `1px solid ${borderColor}`,
        flexShrink: 0,
        boxSizing: "border-box",
    };

    const isSignatureImageUrl = (val) => {
        if (typeof val !== "string") return false;
        const s = val.trim();
        return (
            s.startsWith("data:image/") ||
            /^https?:\/\//i.test(s) ||
            s.startsWith("blob:")
        );
    };

    const renderSignatureCell = (signatureValue, onChange, onClear) => {
        if (isSignatureImageUrl(signatureValue)) {
            return (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", py: 0.5 }}>
                    <Box
                        component="img"
                        src={signatureValue}
                        alt="Signature"
                        className="pdf-signature-img"
                        sx={{ maxHeight: pdfLayout ? 48 : 40, maxWidth: "100%", objectFit: "contain" }}
                    />
                    {!contentReadOnly && onClear && (
                        <Button
                            size="small"
                            color="error"
                            sx={{ fontSize: "0.65rem", minWidth: "auto", p: 0, mt: 0.5 }}
                            onClick={onClear}
                        >
                            Remove
                        </Button>
                    )}
                </Box>
            );
        }
        if (contentReadOnly) {
            return (
                <Typography
                    sx={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        px: 1,
                        py: 1,
                        minHeight: "2.5em",
                        textAlign: "inherit",
                        flex: 1,
                    }}
                >
                    {" "}
                </Typography>
            );
        }
        return (
            <Box sx={{ width: "100%", px: 0.5, py: 0.5 }}>
                <SignatureCapture
                    value={isSignatureImageUrl(signatureValue) ? signatureValue : null}
                    onChange={onChange}
                    readOnly={contentReadOnly}
                    compact
                />
            </Box>
        );
    };

    const renderArrangementColumnHeader = (topicLabel = null) => (
        <Box className="sif-form-row" sx={{ display: "flex", flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
            <Box sx={{ width: { xs: "100%", md: "70%" }, p: cellPadding, borderRight: `1px solid ${borderColor}`, fontWeight: "bold" }}>
                {topicLabel}
            </Box>
            <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, textAlign: "center", borderRight: `1px solid ${borderColor}`, fontWeight: "bold" }}>
                Yes
            </Box>
            <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, textAlign: "center", borderRight: `1px solid ${borderColor}`, fontWeight: "bold" }}>
                No
            </Box>
            <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, textAlign: "center", fontWeight: "bold" }}>
                N/A
            </Box>
        </Box>
    );

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
            sx={{ mb: pdfLayout ? 0 : 2 }}
        >
                <Box sx={{ flex: 1, display: 'flex', flexWrap: rowNowrap, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                    {contentReadOnly ? (
                        <Typography sx={{ fontWeight: 'bold' }}>{headerLabels.topFormTitle}</Typography>
                    ) : (
                        <TextField
                            fullWidth
                            variant="standard"
                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', textAlign: 'center', input: { textAlign: 'center' } } }}
                            value={headerLabels.topFormTitle}
                            onChange={(e) => setHeaderLabels({...headerLabels, topFormTitle: e.target.value})}
                        />
                    )}
                </Box>
                <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                        {contentReadOnly ? (
                            <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.topDateLabel}</Typography>
                        ) : (
                            <TextField
                                fullWidth
                                variant="standard"
                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                value={headerLabels.topDateLabel}
                                onChange={(e) => setHeaderLabels({...headerLabels, topDateLabel: e.target.value})}
                            />
                        )}
                    </Box>
                    <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                        {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                        {contentReadOnly ? (
                            <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.topDocNoLabel}</Typography>
                        ) : (
                            <TextField
                                fullWidth
                                variant="standard"
                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit' } }}
                                value={headerLabels.topDocNoLabel}
                                onChange={(e) => setHeaderLabels({...headerLabels, topDocNoLabel: e.target.value})}
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
                    label={headerLabels.topApprovedByLabel}
                    onLabelChange={(e) => setHeaderLabels({ ...headerLabels, topApprovedByLabel: e.target.value })}
                    value={docInfo.approvedBy}
                    onValueChange={(e) => setDocInfo({ ...docInfo, approvedBy: e.target.value })}
                    valueTextColor={textColor}
                    pageText={`Page ${pageNum} of 3`}
                />
        </FormDocumentHeader>
    );

    const renderHeader = (pageNum) => renderScreenHeader(pageNum);

    const renderCheckboxBox = (label, onToggle, isChecked) => (
        <Box
            className="sif-checkbox-cell"
            sx={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 0.5,
                p: cellPadding,
                width: "100%",
                minHeight: pdfLayout ? 36 : undefined,
                boxSizing: "border-box",
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0, pr: 0.5, fontSize: pdfLayout ? "0.8rem" : undefined }}>{label}</Box>
            <Box
                onClick={contentReadOnly ? undefined : onToggle}
                sx={{
                    ...checkboxMarkSx,
                    bgcolor: isChecked ? "#666" : "transparent",
                    cursor: contentReadOnly ? "default" : "pointer",
                }}
            />
        </Box>
    );

    const renderYesNoOption = (option, valueField, withRightBorder = true) => (
        <Box
            className="sif-yesno-cell"
            sx={{
                width: { xs: "100%", md: "20%" },
                p: cellPadding,
                borderRight: withRightBorder ? `1px solid ${borderColor}` : undefined,
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
            }}
        >
            <Typography component="span" sx={{ fontSize: pdfLayout ? "0.875rem" : undefined, whiteSpace: "nowrap" }}>
                {option}
            </Typography>
            <Box
                onClick={contentReadOnly ? undefined : () => setFormData({ ...formData, [valueField]: option })}
                sx={{
                    ...checkboxMarkSx,
                    bgcolor: formData[valueField] === option ? "#666" : "transparent",
                    cursor: contentReadOnly ? "default" : "pointer",
                }}
            />
        </Box>
    );

    const renderRadioRow = (label, valueField) => (
        <Box sx={{ display: "flex", flexWrap: rowNowrap, bgcolor: headerBgColor }}>
            <Box sx={{ width: { xs: "100%", md: "60%" }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                {label}
            </Box>
            {renderYesNoOption("Yes", valueField, true)}
            {renderYesNoOption("No", valueField, false)}
        </Box>
    );

    const renderArrangementRow = (item, baseIndex, options = {}) => {
        const { editableLabel = false, extraIndex = null, showRowControls = false, extraCount = 0, rowKey } = options;

        if (typeof item === 'object' && item.header) {
            return (
                <Box key={rowKey || `arr-head-${baseIndex}`} sx={{ p: cellPadding, borderBottom: `1px solid ${borderColor}`, borderTop: `1px solid ${borderColor}` }}>
                    {item.header}
                </Box>
            );
        }

        const isBlankTemplate = item === "";
        const canEditLabel = editableLabel || isBlankTemplate;
        const labelValue = canEditLabel
            ? (extraIndex !== null
                ? (formData.extraArrangements?.[extraIndex]?.label ?? "")
                : (formData.arrangementLabels?.[baseIndex] ?? ""))
            : item;

        const selectedAnswer =
            extraIndex !== null
                ? formData.extraArrangements?.[extraIndex]?.answer
                : formData.arrangements[baseIndex];

        const setAnswer = (value) => {
            if (extraIndex !== null) {
                updateExtraArrangement(extraIndex, { answer: value });
            } else {
                updateArrangement(baseIndex, value);
            }
        };

        const renderArrangementCheckbox = (value) => (
            <Box
                onClick={contentReadOnly ? undefined : () => setAnswer(value)}
                sx={{
                    ...checkboxMarkSx,
                    bgcolor: selectedAnswer === value ? "#666" : "transparent",
                    cursor: contentReadOnly ? "default" : "pointer",
                }}
            />
        );

        const showControls = Boolean(showRowControls && !contentReadOnly);

        return (
            <Box key={rowKey || `arr-${baseIndex}`} className="sif-form-row" sx={{ display: "flex", flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                <Box sx={{ width: { xs: "100%", md: showControls ? "62%" : "70%" }, p: 0, borderRight: `1px solid ${borderColor}`, display: "flex", alignItems: "center" }}>
                    {canEditLabel ? (
                        contentReadOnly ? (
                            <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", px: 1, py: 1, minHeight: "1.5em" }}>
                                {labelValue || " "}
                            </Typography>
                        ) : (
                            <TextField
                                fullWidth
                                multiline
                                placeholder="Enter topic / arrangement"
                                variant="standard"
                                InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }}
                                value={labelValue}
                                onChange={(e) => {
                                    if (extraIndex !== null) {
                                        updateExtraArrangement(extraIndex, { label: e.target.value });
                                    } else {
                                        updateArrangementLabel(baseIndex, e.target.value);
                                    }
                                }}
                            />
                        )
                    ) : (
                        <Typography sx={{ p: cellPadding }}>{item}</Typography>
                    )}
                </Box>
                <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, display: "flex", flexWrap: "nowrap", justifyContent: "center", alignItems: "center", borderRight: `1px solid ${borderColor}` }}>
                    {renderArrangementCheckbox("Yes")}
                </Box>
                <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, display: "flex", flexWrap: "nowrap", justifyContent: "center", alignItems: "center", borderRight: `1px solid ${borderColor}` }}>
                    {renderArrangementCheckbox("No")}
                </Box>
                <Box sx={{ width: { xs: "100%", md: "10%" }, p: cellPadding, display: "flex", flexWrap: "nowrap", justifyContent: "center", alignItems: "center", borderRight: showControls ? `1px solid ${borderColor}` : "none" }}>
                    {renderArrangementCheckbox("N/A")}
                </Box>
                {showControls && (
                    <GeneralFormTableRowControls
                        downloading={downloading}
                        action={action}
                        rowIndex={extraIndex ?? 0}
                        rowCount={Math.max(extraCount, 1)}
                        minRows={0}
                        maxRows={30}
                        borderColor={borderColor}
                        onInsertAfter={insertExtraArrangementAfter}
                        onRemoveAt={removeExtraArrangementAt}
                        accessLocked={!canEdit}
                        variant="compact"
                    />
                )}
            </Box>
        );
    };

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: rowNowrap, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout pageTitle="Site Induction Register">
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: rowNowrap, alignItems: 'center', gap: 2 }}>
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

            <Box sx={{ display: 'flex', flexWrap: rowNowrap, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
                <Paper 
                    ref={containerRef}
                    className={pdfLayout ? "sif-pdf-export pdf-export-root" : undefined}
                    elevation={pdfLayout ? 0 : 3} 
                    sx={{ 
                        width: "100%", 
                        minWidth: pdfLayout ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: 4, 
                        bgcolor: pdfLayout ? "#FFFFFF" : isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: textColor,
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none"
                    }}
                >
                    {/* Form header box — captured once and drawn on every PDF page */}
                    {pdfLayout && (
                        <Box data-pdf-page-header sx={{ mb: 2 }}>
                            {renderScreenHeader(1)}
                        </Box>
                    )}

                    {/* PAGE 1 */}
                    <Box data-pdf-block className="sif-pdf-page" sx={pageBlockSx}>
                        {!pdfLayout && renderHeader(1)}
                        
                        {/* Section A */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold' }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionA}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.sectionA}
                                        onChange={(e) => setHeaderLabels({...headerLabels, sectionA: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.nameOfSite}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.nameOfSite}
                                            onChange={(e) => setHeaderLabels({...headerLabels, nameOfSite: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.nameOfSite || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.nameOfSite} onChange={updateField("nameOfSite")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.locationAddress}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.locationAddress}
                                            onChange={(e) => setHeaderLabels({...headerLabels, locationAddress: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.locationAddress || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.locationAddress} onChange={updateField("locationAddress")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.sectionADate}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.sectionADate}
                                            onChange={(e) => setHeaderLabels({...headerLabels, sectionADate: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.sectionADate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.sectionADate} onChange={updateField("sectionADate")} />)}
                                </Box>
                            </Box>
                        </Box>

                        {/* Section B */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionB}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.sectionB}
                                        onChange={(e) => setHeaderLabels({...headerLabels, sectionB: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.fullName}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.fullName}
                                            onChange={(e) => setHeaderLabels({...headerLabels, fullName: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.fullName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.fullName} onChange={updateField("fullName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.jobTitle}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.jobTitle}
                                            onChange={(e) => setHeaderLabels({...headerLabels, jobTitle: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.jobTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.jobTitle} onChange={updateField("jobTitle")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.companyName}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.companyName}
                                            onChange={(e) => setHeaderLabels({...headerLabels, companyName: e.target.value})}
                                        />)
                                    }
                                    {contentReadOnly ? 
                                        (<Typography variant="caption" sx={{ px: cellPadding }}>{headerLabels.companySub}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, px: cellPadding, fontSize: '0.75rem' } }}
                                            value={headerLabels.companySub}
                                            onChange={(e) => setHeaderLabels({...headerLabels, companySub: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.companyName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.companyName} onChange={updateField("companyName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                                {contentReadOnly ? 
                                    (<Typography variant="caption" sx={{ px: 1 }}>{headerLabels.orgProcedures}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, fontSize: '0.75rem' } }}
                                        value={headerLabels.orgProcedures}
                                        onChange={(e) => setHeaderLabels({...headerLabels, orgProcedures: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ p: 0 }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.orgProcedures || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.orgProcedures} onChange={updateField("orgProcedures")} />)}
                            </Box>
                        </Box>                        {/* Section C */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionC}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.sectionC}
                                        onChange={(e) => setHeaderLabels({...headerLabels, sectionC: e.target.value})}
                                    />)
                                }
                            </Box>
                            
                            <Box className="sif-skills-row" sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>
                                    {renderCheckboxBox(
                                        contentReadOnly ? headerLabels.cscs : 
                                        <TextField variant="standard" value={headerLabels.cscs} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, cscs: e.target.value})} />, 
                                        toggleCheckbox("cscs"), formData.cscs)}
                                </Box>
                                <Box sx={{ flex: 1.5, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>
                                    {renderCheckboxBox(
                                        contentReadOnly ? headerLabels.asbestos :
                                        <TextField variant="standard" fullWidth multiline value={headerLabels.asbestos} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, asbestos: e.target.value})} />,
                                        toggleCheckbox("asbestosAwareness"), formData.asbestosAwareness)}
                                </Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>
                                    {renderCheckboxBox(
                                        contentReadOnly ? headerLabels.firstAid : 
                                        <TextField variant="standard" value={headerLabels.firstAid} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, firstAid: e.target.value})} />, 
                                        toggleCheckbox("firstAid"), formData.firstAid)}
                                </Box>
                                <Box sx={{ flex: 1.5, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>
                                    {renderCheckboxBox(
                                        contentReadOnly ? headerLabels.healthSafety : 
                                        <TextField variant="standard" value={headerLabels.healthSafety} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, healthSafety: e.target.value})} />, 
                                        toggleCheckbox("healthSafety"), formData.healthSafety)}
                                </Box>
                                <Box sx={{ flex: 2, p: 0, minWidth: 0 }}>
                                    {renderCheckboxBox(
                                        contentReadOnly ? headerLabels.smsts :
                                        <TextField variant="standard" fullWidth multiline value={headerLabels.smsts} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, smsts: e.target.value})} />,
                                        toggleCheckbox("smsts"), formData.smsts)}
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0, width: { xs: '100%', md: '10%' } }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.otherSkills}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.otherSkills}
                                            onChange={(e) => setHeaderLabels({...headerLabels, otherSkills: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ p: 0, width: { xs: '100%', md: '90%' } }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.otherSkills || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.otherSkills} onChange={updateField("otherSkills")} />)}
                                </Box>
                            </Box>
 
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.cardNumber}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.cardNumber}
                                            onChange={(e) => setHeaderLabels({...headerLabels, cardNumber: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '35%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.cardNumber || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.cardNumber} onChange={updateField("cardNumber")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.expiryDate}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.expiryDate}
                                            onChange={(e) => setHeaderLabels({...headerLabels, expiryDate: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.expiryDate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.expiryDate} onChange={updateField("expiryDate")} />)}
                                </Box>
                            </Box>
 
                            {renderRadioRow(contentReadOnly ? headerLabels.firstAider : <TextField fullWidth multiline variant="standard" value={headerLabels.firstAider} onChange={e => setHeaderLabels({...headerLabels, firstAider: e.target.value})} InputProps={{ disableUnderline: true }} />, "isFirstAider")}
                            <Box sx={{ borderTop: `1px solid ${borderColor}` }}>
                                {renderRadioRow(contentReadOnly ? headerLabels.liftingTrained : <TextField fullWidth multiline variant="standard" value={headerLabels.liftingTrained} onChange={e => setHeaderLabels({...headerLabels, liftingTrained: e.target.value})} InputProps={{ disableUnderline: true }} />, "isBelowHookTrained")}
                            </Box>
                        </Box>
                         {/* Section D */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionD}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.sectionD}
                                        onChange={(e) => setHeaderLabels({...headerLabels, sectionD: e.target.value})}
                                    />)
                                }
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.emergencyContact}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            multiline
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.emergencyContact}
                                            onChange={(e) => setHeaderLabels({...headerLabels, emergencyContact: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.emergencyContactName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.emergencyContactName} onChange={updateField("emergencyContactName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.relationship}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.relationship}
                                            onChange={(e) => setHeaderLabels({...headerLabels, relationship: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.relationship || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.relationship} onChange={updateField("relationship")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.contactNumber}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.contactNumber}
                                            onChange={(e) => setHeaderLabels({...headerLabels, contactNumber: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.contactNumber || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.contactNumber} onChange={updateField("contactNumber")} />)}
                                </Box>
                            </Box>
 
                            <Box sx={{ p: cellPadding, borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography>{headerLabels.medicalCondition}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, fontWeight: 'normal' } }}
                                        value={headerLabels.medicalCondition}
                                        onChange={(e) => setHeaderLabels({...headerLabels, medicalCondition: e.target.value})}
                                    />)
                                }
                            </Box>
                            
                            <Box className="sif-skills-row" sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>{renderCheckboxBox(contentReadOnly ? headerLabels.medicalAsthma : <TextField variant="standard" value={headerLabels.medicalAsthma} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalAsthma: e.target.value})} />, toggleCheckbox("asthma"), formData.asthma)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>{renderCheckboxBox(contentReadOnly ? headerLabels.medicalHeart : <TextField variant="standard" multiline value={headerLabels.medicalHeart} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, medicalHeart: e.target.value})} />, toggleCheckbox("heartCondition"), formData.heartCondition)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>{renderCheckboxBox(contentReadOnly ? headerLabels.medicalDiabetic : <TextField variant="standard" value={headerLabels.medicalDiabetic} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalDiabetic: e.target.value})} />, toggleCheckbox("diabetic"), formData.diabetic)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}`, minWidth: 0 }}>{renderCheckboxBox(contentReadOnly ? headerLabels.medicalEpilepsy : <TextField variant="standard" value={headerLabels.medicalEpilepsy} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalEpilepsy: e.target.value})} />, toggleCheckbox("epilepsy"), formData.epilepsy)}</Box>
                                <Box sx={{ flex: 1, p: 0, minWidth: 0 }}>{renderCheckboxBox(contentReadOnly ? headerLabels.medicalHearing : <TextField variant="standard" multiline value={headerLabels.medicalHearing} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, medicalHearing: e.target.value})} />, toggleCheckbox("hearingLoss"), formData.hearingLoss)}</Box>
                            </Box>
 
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.medicalOther}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            multiline
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.medicalOther}
                                            onChange={(e) => setHeaderLabels({...headerLabels, medicalOther: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '75%' }, p: 0 }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.otherMedical || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.otherMedical} onChange={updateField("otherMedical")} />)}
                                </Box>
                            </Box>
                            
                            <Box sx={{ p: cellPadding, fontSize: '0.8rem' }}>
                                {contentReadOnly ? 
                                    (<Typography variant="caption">{headerLabels.medicalPrivacy}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        multiline
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, fontSize: '0.75rem' } }}
                                        value={headerLabels.medicalPrivacy}
                                        onChange={(e) => setHeaderLabels({...headerLabels, medicalPrivacy: e.target.value})}
                                    />)
                                }
                            </Box>
                        </Box>

                        {/* Section E (1) */}
                        <Box sx={{ border: `1px solid ${borderColor}` }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionE}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.sectionE}
                                        onChange={(e) => setHeaderLabels({...headerLabels, sectionE: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.projMgmt}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.projMgmt}
                                        onChange={(e) => setHeaderLabels({...headerLabels, projMgmt: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ p: 0, borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding }}>{headerLabels.ramsBrief}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                        value={headerLabels.ramsBrief}
                                        onChange={(e) => setHeaderLabels({...headerLabels, ramsBrief: e.target.value})}
                                    />)
                                }
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.ramsQuestion}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            multiline
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.ramsQuestion}
                                            onChange={(e) => setHeaderLabels({...headerLabels, ramsQuestion: e.target.value})}
                                        />)
                                    }
                                </Box>
                                {renderYesNoOption("Yes", "briefedOnRAMS", true)}
                                {renderYesNoOption("No", "briefedOnRAMS", false)}
                            </Box>
                        </Box>

                    </Box>

                    {/* PAGE 2 */}
                    <Box data-pdf-block className="sif-pdf-page" sx={{ ...pageBlockSx, minHeight: pdfLayout ? undefined : "1100px" }}>
                        {!pdfLayout && renderHeader(2)}

                        <Box sx={{ border: `1px solid ${borderColor}`, borderRadius: 1, overflow: 'hidden' }}>
                            <Box sx={{ borderBottom: `1px solid ${borderColor}`, p: 1 }}>
                                (Particular risks and control measures | Ongoing Briefings | )
                            </Box>

                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0, borderRight: `1px solid ${borderColor}`, fontWeight: 'bold' }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.sectionF}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            multiline
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                            value={headerLabels.sectionF}
                                            onChange={(e) => setHeaderLabels({...headerLabels, sectionF: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, textAlign: 'center', borderRight: `1px solid ${borderColor}`, fontWeight: 'bold' }}>Yes</Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, textAlign: 'center', borderRight: `1px solid ${borderColor}`, fontWeight: 'bold' }}>No</Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, textAlign: 'center', fontWeight: 'bold' }}>N/A</Box>
                            </Box>

                            {ARRANGEMENTS_PAGE_2.map((item, index) => renderArrangementRow(item, index))}
                        </Box>
                    </Box>

                    {/* PAGE 3 */}
                    <Box data-pdf-block className="sif-pdf-page" sx={{ minHeight: pdfLayout ? undefined : "1100px" }}>
                        {!pdfLayout && renderHeader(3)}

                        <Box className="sif-page3-body">
                        <Box sx={{ border: `1px solid ${borderColor}`, borderRadius: pdfLayout ? 0 : 1, overflow: "hidden", mb: 2 }}>
                            {renderArrangementColumnHeader(null)}
                            {ARRANGEMENTS_PAGE_3.map((item, index) =>
                                renderArrangementRow(item, index + ARRANGEMENTS_PAGE_2.length)
                            )}
                            {(formData.extraArrangements || []).map((extra, extraIndex) =>
                                renderArrangementRow(
                                    extra?.label ?? "",
                                    ARRANGEMENTS_PAGE_2.length + ARRANGEMENTS_PAGE_3.length + extraIndex,
                                    {
                                        editableLabel: true,
                                        extraIndex,
                                        showRowControls: true,
                                        extraCount: (formData.extraArrangements || []).length,
                                        rowKey: `arr-extra-${extra.id}`,
                                    }
                                )
                            )}
                            {!contentReadOnly && (
                                <Box sx={{ p: 1, display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${borderColor}` }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={addExtraArrangementRow}
                                        disabled={(formData.extraArrangements || []).length >= 30}
                                        sx={{ textTransform: "none", fontSize: "0.8rem" }}
                                    >
                                        Add topic row
                                    </Button>
                                </Box>
                            )}
                        </Box>

                        <Box sx={{ border: `1px solid ${borderColor}`, mb: pdfLayout ? 2 : 4 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.openDiscussion}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.openDiscussion}
                                        onChange={(e) => setHeaderLabels({...headerLabels, openDiscussion: e.target.value})}
                                    />)
                                }
                                {contentReadOnly ? 
                                    (<Typography variant="caption" display="block" sx={{ px: cellPadding, fontWeight: 'normal' }}>{headerLabels.openSub}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, px: cellPadding, fontSize: '0.75rem', fontWeight: 'normal' } }}
                                        value={headerLabels.openSub}
                                        onChange={(e) => setHeaderLabels({...headerLabels, openSub: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ p: 1, minHeight: pdfLayout ? 72 : "100px" }}>
                                {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.openDiscussion || ' '}</Typography>) : (<TextField fullWidth multiline minRows={3} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor } }} value={formData.openDiscussion} onChange={updateField("openDiscussion")} />)}
                            </Box>
                        </Box>

                        <Box sx={{ border: `1px solid ${borderColor}`, mb: pdfLayout ? 1 : 0 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {contentReadOnly ? 
                                    (<Typography sx={{ p: cellPadding, fontWeight: 'bold' }}>{headerLabels.confirmation}</Typography>) : 
                                    (<TextField 
                                        fullWidth 
                                        multiline
                                        variant="standard" 
                                        InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontWeight: 'bold' } }}
                                        value={headerLabels.confirmation}
                                        onChange={(e) => setHeaderLabels({...headerLabels, confirmation: e.target.value})}
                                    />)
                                }
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.inducteeLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            multiline
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontSize: '0.9rem' } }}
                                            value={headerLabels.inducteeLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, inducteeLabel: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.inducteePrintName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.inducteePrintName} onChange={updateField("inducteePrintName")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
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
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, display: 'flex', alignItems: 'center', minHeight: pdfLayout ? 52 : undefined }}>
                                    {renderSignatureCell(
                                        formData.inducteeSignature,
                                        (url) => setFormData({ ...formData, inducteeSignature: url || "" }),
                                        () => setFormData({ ...formData, inducteeSignature: "" })
                                    )}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: rowNowrap }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.inductorLabel}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            multiline
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding, fontSize: '0.9rem' } }}
                                            value={headerLabels.inductorLabel}
                                            onChange={(e) => setHeaderLabels({...headerLabels, inductorLabel: e.target.value})}
                                        />)
                                    }
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {contentReadOnly ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.inductorPrintName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.inductorPrintName} onChange={updateField("inductorPrintName")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
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
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, display: 'flex', alignItems: 'center', minHeight: pdfLayout ? 52 : undefined }}>
                                    {renderSignatureCell(
                                        formData.inductorSignature,
                                        (url) => setFormData({ ...formData, inductorSignature: url || "" }),
                                        () => setFormData({ ...formData, inductorSignature: "" })
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: pdfLayout ? 2 : 4, mb: 1 }}>
                            <Box sx={{ width: "250px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <Box sx={{ width: "100%", borderBottom: `1px solid ${borderColor}`, mb: 1, pb: 1, minHeight: pdfLayout ? 56 : undefined }}>
                                    {renderSignatureCell(
                                        docInfo.signature,
                                        (url) => setDocInfo({ ...docInfo, signature: url || "" }),
                                        () => setDocInfo({ ...docInfo, signature: "" })
                                    )}
                                </Box>
                                <Typography sx={{ fontWeight: "bold", fontSize: "0.9rem" }}>Signature</Typography>
                            </Box>
                        </Box>
                        
                        <Box sx={{ mt: pdfLayout ? 1 : 2, pl: 2, fontWeight: "bold", fontSize: pdfLayout ? "1rem" : "1.1rem" }}>
                            Retain with project papers
                        </Box>
                        </Box>
                    </Box>

                    </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={persistedResponseId}
                defaultName={formMetadata.name || `Site Induction Record - ${new Date().toLocaleDateString()}`}
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
