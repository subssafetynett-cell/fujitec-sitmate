import React, { useState, useEffect, useRef } from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton
} from "@mui/material";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";

export default function SiteInductionRecordForm() {
  const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const siteId = searchParams.get("siteId");
    const category = searchParams.get("category") || "General forms";
    const action = searchParams.get("action");
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({ name: "", tags: "" });

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

    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    useEffect(() => {
        if (!loading && action === "download" && id) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `SiteInductionForm_${id}`, () => {
                    setDownloading(false);
                    window.close();
                });
            }, 800);
        }
    }, [loading, action, id]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get('/forms/responses');
            if (res.data?.success) {
                const submission = res.data.data.find(r => r.id === submissionId || r._id === submissionId);
                if (submission && submission.answers) {
                    if (submission.answers.docInfo) setDocInfo(submission.answers.docInfo);
                    if (submission.answers.formData) setFormData(submission.answers.formData);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    setFormMetadata({
                        name: submission.answers.name || `Site Induction Record - ${new Date(submission.createdAt).toLocaleDateString()}`,
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

    const handleSaveClick = () => {
        if (id) {
            setSaveDialogOpen(true);
        } else {
            executeSave(false);
        }
    };

    const executeSave = async (asNew = false, name = "", tags = "") => {
        setSaving(true);
        try {
            const payload = { 
                docInfo, 
                formData, 
                headerLabels,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) payload.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: payload });
            } else {
                const formId = await getOrCreateTemplateForm("Site Induction Form");
                await api.post(`/forms/${formId}/responses`, {
                    answers: payload,
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

    const borderColor = isDarkMode ? "#374151" : "#CCC";
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.05)" : "#E5E7EB";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "4px 8px";

    const renderHeader = (pageNum) => (
        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 2 }}>
            {/* Left Logo / Upload */}
            <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${borderColor}` }}>
                {docInfo.logo ? (
                    <>
                        <Box component="img" src={docInfo.logo} alt="Left Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                        {(action !== 'download') && (
                            <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                Change Logo
                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setDocInfo({...docInfo, logo: ev.target.result});
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </Button>
                        )}
                    </>
                ) : (
                    (action !== 'download') ? (
                        <Button variant="outlined" component="label" size="small">
                            Upload Logo
                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setDocInfo({...docInfo, logo: ev.target.result});
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </Button>
                    ) : (
                        <Typography variant="caption" color="text.secondary">No Logo</Typography>
                    )
                )}
            </Box>
            
            <Box sx={{ width: { xs: '100%', md: '40%' }, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                    {(downloading || action === 'download') ? (
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
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                        {(downloading || action === 'download') ? (
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
                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1, borderRight: `1px solid ${borderColor}` }}>
                        {(downloading || action === 'download') ? (
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
                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                    <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                        <Box sx={{ pl: 1, pr: 0.5, whiteSpace: 'nowrap' }}>
                            {(downloading || action === 'download') ? (
                                <Typography sx={{ fontWeight: 'inherit' }}>{headerLabels.topApprovedByLabel}</Typography>
                            ) : (
                                <TextField
                                    variant="standard"
                                    InputProps={{ disableUnderline: true, sx: { fontWeight: 'inherit', maxWidth: '100px' } }}
                                    value={headerLabels.topApprovedByLabel}
                                    onChange={(e) => setHeaderLabels({...headerLabels, topApprovedByLabel: e.target.value})}
                                />
                            )}
                        </Box>
                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 0.5, py: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                    </Box>
                    <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page {pageNum} of 3</Box>
                </Box>
            </Box>

            {/* Right Logo / Upload */}
            <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {docInfo.logoRight ? (
                    <>
                        <Box component="img" src={docInfo.logoRight} alt="Right Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                        {(action !== 'download') && (
                            <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                Change Logo
                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setDocInfo({...docInfo, logoRight: ev.target.result});
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </Button>
                        )}
                    </>
                ) : (
                    (action !== 'download') ? (
                        <Button variant="outlined" component="label" size="small">
                            Upload Logo
                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setDocInfo({...docInfo, logoRight: ev.target.result});
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </Button>
                    ) : (
                        <Typography variant="caption" color="text.secondary">No Logo</Typography>
                    )
                )}
            </Box>
        </Box>
    );

    const renderCheckboxBox = (label, onToggle, isChecked) => (
        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 1 }}>
            {label}
            <Box 
                onClick={onToggle}
                sx={{ 
                    width: 14, height: 14, 
                    border: `1px solid ${borderColor}`,
                    bgcolor: isChecked ? '#666' : 'transparent',
                    cursor: 'pointer'
                }} 
            />
        </Box>
    );

    const renderRadioRow = (label, valueField) => (
        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, bgcolor: headerBgColor }}>
            <Box sx={{ width: { xs: '100%', md: '60%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                {label}
            </Box>
            <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'space-between' }}>
                Yes
                <Box onClick={() => setFormData({...formData, [valueField]: "Yes"})} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData[valueField] === "Yes" ? '#666' : 'transparent', cursor: 'pointer' }} />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'space-between' }}>
                No
                <Box onClick={() => setFormData({...formData, [valueField]: "No"})} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData[valueField] === "No" ? '#666' : 'transparent', cursor: 'pointer' }} />
            </Box>
        </Box>
    );

    const renderArrangementRow = (item, baseIndex) => {
        if (typeof item === 'object' && item.header) {
            return (
                <Box key={`arr-head-${baseIndex}`} sx={{ p: cellPadding, borderBottom: `1px solid ${borderColor}`, borderTop: `1px solid ${borderColor}` }}>
                    {item.header}
                </Box>
            );
        }

        return (
            <Box key={`arr-${baseIndex}`} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                <Box sx={{ width: { xs: '100%', md: '70%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                    {item}
                </Box>
                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', alignItems: 'center', borderRight: `1px solid ${borderColor}` }}>
                    <Box onClick={() => updateArrangement(baseIndex, "Yes")} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.arrangements[baseIndex] === "Yes" ? '#666' : 'transparent', cursor: 'pointer' }} />
                </Box>
                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', alignItems: 'center', borderRight: `1px solid ${borderColor}` }}>
                    <Box onClick={() => updateArrangement(baseIndex, "No")} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.arrangements[baseIndex] === "No" ? '#666' : 'transparent', cursor: 'pointer' }} />
                </Box>
                <Box sx={{ width: { xs: '100%', md: '10%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', alignItems: 'center' }}>
                    <Box onClick={() => updateArrangement(baseIndex, "N/A")} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.arrangements[baseIndex] === "N/A" ? '#666' : 'transparent', cursor: 'pointer' }} />
                </Box>
            </Box>
        );
    };

    if (loading) return <Layout><Box sx={{display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent:'center', py:10}}><CircularProgress/></Box></Layout>;

    return (
        <Layout pageTitle="Site Induction Register">
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => siteId ? navigate('/sitepack-management', { state: { siteId, moduleTitle: category } }) : navigate('/general-forms')} sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                </Box>
                <Button 
                    variant="contained" 
                    onClick={handleSaveClick}
                    disabled={saving}
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

            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, justifyContent: 'center', mb: 8, overflowX: "auto", px: { xs: 2, md: 0 } }}>
                <Paper 
                    ref={containerRef}
                    elevation={ (downloading || action === 'download') ? 0 : 3 } 
                    sx={{ 
                        width: "100%", 
                        minWidth: (downloading || action === 'download') ? "1000px" : "100%",
                        maxWidth: "1000px", 
                        p: 4, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: 2,
                        border: (downloading || action === 'download') ? "1px solid #ccc" : "none"
                    }}
                >
                    {/* PAGE 1 */}
                    <Box sx={{ mb: 6 }}>
                        {renderHeader(1)}
                        
                        {/* Section A */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold' }}>
                                {(downloading || action === 'download') ? 
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
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.nameOfSite || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.nameOfSite} onChange={updateField("nameOfSite")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.locationAddress || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.locationAddress} onChange={updateField("locationAddress")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderTop: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.sectionADate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.sectionADate} onChange={updateField("sectionADate")} />)}
                                </Box>
                            </Box>
                        </Box>

                        {/* Section B */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.fullName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.fullName} onChange={updateField("fullName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.jobTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.jobTitle} onChange={updateField("jobTitle")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
                                        (<Typography sx={{ p: cellPadding }}>{headerLabels.companyName}</Typography>) : 
                                        (<TextField 
                                            fullWidth 
                                            variant="standard" 
                                            InputProps={{ disableUnderline: true, sx: { color: textColor, p: cellPadding } }}
                                            value={headerLabels.companyName}
                                            onChange={(e) => setHeaderLabels({...headerLabels, companyName: e.target.value})}
                                        />)
                                    }
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.companyName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.companyName} onChange={updateField("companyName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ borderBottom: `1px solid ${borderColor}`, bgcolor: headerBgColor }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.orgProcedures || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.orgProcedures} onChange={updateField("orgProcedures")} />)}
                            </Box>
                        </Box>                        {/* Section C */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {renderCheckboxBox(
                                        (downloading || action === 'download') ? headerLabels.cscs : 
                                        <TextField variant="standard" value={headerLabels.cscs} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, cscs: e.target.value})} />, 
                                        toggleCheckbox("cscs"), formData.cscs)}
                                </Box>
                                <Box sx={{ flex: 1.5, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 1, p: cellPadding }}>
                                        <Box sx={{ flex: 1 }}>
                                            {(downloading || action === 'download') ? headerLabels.asbestos : 
                                            <TextField variant="standard" fullWidth multiline value={headerLabels.asbestos} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, asbestos: e.target.value})} />}
                                        </Box>
                                        <Box onClick={toggleCheckbox("asbestosAwareness")} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.asbestosAwareness ? '#666' : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {renderCheckboxBox(
                                        (downloading || action === 'download') ? headerLabels.firstAid : 
                                        <TextField variant="standard" value={headerLabels.firstAid} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, firstAid: e.target.value})} />, 
                                        toggleCheckbox("firstAid"), formData.firstAid)}
                                </Box>
                                <Box sx={{ flex: 1.5, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {renderCheckboxBox(
                                        (downloading || action === 'download') ? headerLabels.healthSafety : 
                                        <TextField variant="standard" value={headerLabels.healthSafety} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, healthSafety: e.target.value})} />, 
                                        toggleCheckbox("healthSafety"), formData.healthSafety)}
                                </Box>
                                <Box sx={{ flex: 2, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ flex: 1 }}>
                                        {(downloading || action === 'download') ? headerLabels.smsts : 
                                        <TextField variant="standard" fullWidth multiline value={headerLabels.smsts} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, smsts: e.target.value})} />}
                                    </Box>
                                    <Box onClick={toggleCheckbox("smsts")} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.smsts ? '#666' : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ p: 0, width: { xs: '100%', md: '10%' } }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.otherSkills || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.otherSkills} onChange={updateField("otherSkills")} />)}
                                </Box>
                            </Box>
 
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.cardNumber || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.cardNumber} onChange={updateField("cardNumber")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.expiryDate || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.expiryDate} onChange={updateField("expiryDate")} />)}
                                </Box>
                            </Box>
 
                            {renderRadioRow((downloading || action === 'download') ? headerLabels.firstAider : <TextField fullWidth multiline variant="standard" value={headerLabels.firstAider} onChange={e => setHeaderLabels({...headerLabels, firstAider: e.target.value})} InputProps={{ disableUnderline: true }} />, "isFirstAider")}
                            <Box sx={{ borderTop: `1px solid ${borderColor}` }}>
                                {renderRadioRow((downloading || action === 'download') ? headerLabels.liftingTrained : <TextField fullWidth multiline variant="standard" value={headerLabels.liftingTrained} onChange={e => setHeaderLabels({...headerLabels, liftingTrained: e.target.value})} InputProps={{ disableUnderline: true }} />, "isBelowHookTrained")}
                            </Box>
                        </Box>
                         {/* Section D */}
                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.emergencyContactName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.emergencyContactName} onChange={updateField("emergencyContactName")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.relationship || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.relationship} onChange={updateField("relationship")} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.contactNumber || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.contactNumber} onChange={updateField("contactNumber")} />)}
                                </Box>
                            </Box>
 
                            <Box sx={{ p: cellPadding, borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>{renderCheckboxBox((downloading || action === 'download') ? headerLabels.medicalAsthma : <TextField variant="standard" value={headerLabels.medicalAsthma} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalAsthma: e.target.value})} />, toggleCheckbox("asthma"), formData.asthma)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>{renderCheckboxBox((downloading || action === 'download') ? headerLabels.medicalHeart : <TextField variant="standard" multiline value={headerLabels.medicalHeart} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, medicalHeart: e.target.value})} />, toggleCheckbox("heartCondition"), formData.heartCondition)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>{renderCheckboxBox((downloading || action === 'download') ? headerLabels.medicalDiabetic : <TextField variant="standard" value={headerLabels.medicalDiabetic} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalDiabetic: e.target.value})} />, toggleCheckbox("diabetic"), formData.diabetic)}</Box>
                                <Box sx={{ flex: 1, p: 0, borderRight: `1px solid ${borderColor}` }}>{renderCheckboxBox((downloading || action === 'download') ? headerLabels.medicalEpilepsy : <TextField variant="standard" value={headerLabels.medicalEpilepsy} InputProps={{ disableUnderline: true }} onChange={e => setHeaderLabels({...headerLabels, medicalEpilepsy: e.target.value})} />, toggleCheckbox("epilepsy"), formData.epilepsy)}</Box>
                                <Box sx={{ flex: 1, p: 0 }}>{renderCheckboxBox((downloading || action === 'download') ? headerLabels.medicalHearing : <TextField variant="standard" multiline value={headerLabels.medicalHearing} InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }} onChange={e => setHeaderLabels({...headerLabels, medicalHearing: e.target.value})} />, toggleCheckbox("hearingLoss"), formData.hearingLoss)}</Box>
                            </Box>
 
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.otherMedical || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={formData.otherMedical} onChange={updateField("otherMedical")} />)}
                                </Box>
                            </Box>
                            
                            <Box sx={{ p: cellPadding, fontSize: '0.8rem' }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                            
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    Yes
                                    <Box onClick={() => setFormData({...formData, briefedOnRAMS: "Yes"})} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.briefedOnRAMS === "Yes" ? '#666' : 'transparent', cursor: 'pointer' }} />
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    No
                                    <Box onClick={() => setFormData({...formData, briefedOnRAMS: "No"})} sx={{ width: 14, height: 14, border: `1px solid ${borderColor}`, bgcolor: formData.briefedOnRAMS === "No" ? '#666' : 'transparent', cursor: 'pointer' }} />
                                </Box>
                            </Box>
                        </Box>

                    </Box>

                    {/* PAGE 2 */}
                    <Box sx={{ minHeight: '1100px', mb: 6 }}>
                        {renderHeader(2)}

                        <Box sx={{ border: `1px solid ${borderColor}`, borderRadius: 1, overflow: 'hidden' }}>
                            <Box sx={{ borderBottom: `1px solid ${borderColor}`, p: 1 }}>
                                (Particular risks and control measures | Ongoing Briefings | )
                            </Box>

                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 0, borderRight: `1px solid ${borderColor}`, fontWeight: 'bold' }}>
                                    {(downloading || action === 'download') ? 
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
                    <Box sx={{ minHeight: '1100px' }}>
                        {renderHeader(3)}

                        <Box sx={{ border: `1px solid ${borderColor}`, borderBottom: 'none' }}>
                            {ARRANGEMENTS_PAGE_3.map((item, index) => renderArrangementRow(item, index + ARRANGEMENTS_PAGE_2.length))}
                        </Box>

                        <Box sx={{ border: `1px solid ${borderColor}`, mb: 4 }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                            <Box sx={{ p: 1, minHeight: '100px' }}>
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.openDiscussion || ' '}</Typography>) : (<TextField fullWidth multiline minRows={3} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor } }} value={formData.openDiscussion} onChange={updateField("openDiscussion")} />)}
                            </Box>
                        </Box>

                        <Box sx={{ border: `1px solid ${borderColor}` }}>
                            <Box sx={{ p: 0, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.inducteePrintName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.inducteePrintName} onChange={updateField("inducteePrintName")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {(downloading || action === 'download') ? 
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
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, display: 'flex', alignItems: 'center' }}>
                                    {formData.inducteeSignature && (formData.inducteeSignature.startsWith('data:image/') || formData.inducteeSignature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={formData.inducteeSignature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => setFormData({...formData, inducteeSignature: ''})}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{formData.inducteeSignature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: 'column' }}>
                                                <TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.inducteeSignature} onChange={updateField("inducteeSignature")} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none', mt: 0.5 }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => setFormData({...formData, inducteeSignature: ev.target.result});
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{formData.inductorPrintName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={formData.inductorPrintName} onChange={updateField("inductorPrintName")} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {(downloading || action === 'download') ? 
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
                                <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, display: 'flex', alignItems: 'center' }}>
                                    {formData.inductorSignature && (formData.inductorSignature.startsWith('data:image/') || formData.inductorSignature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={formData.inductorSignature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => setFormData({...formData, inductorSignature: ''})}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{formData.inductorSignature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: 'column' }}>
                                                <TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1 } }} value={formData.inductorSignature} onChange={updateField("inductorSignature")} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none', mt: 0.5 }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => setFormData({...formData, inductorSignature: ev.target.result});
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                            </Box>
                        </Box>
                        
                        <Box sx={{ mt: 4, pl: 2, fontWeight: 'bold', fontSize: '1.1rem' }}>
                            Retain with project papers
                        </Box>
                    </Box>

                                        {/* Signature Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 6, mb: 2 }}>
                            <Box sx={{ width: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {docInfo.signature ? (
                                    <>
                                        <Box component="img" src={docInfo.signature} alt="Signature" sx={{ width: '100%', maxHeight: '80px', objectFit: 'contain', borderBottom: `1px solid ${borderColor}`, mb: 1 }} />
                                        {(action !== 'download') && (
                                            <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                                Change Signature
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo({...docInfo, signature: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    (action !== 'download') ? (
                                        <Box sx={{ width: '100%', height: '60px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                            <Button variant="outlined" component="label" size="small">
                                                Upload Signature
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo({...docInfo, signature: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box sx={{ width: '100%', height: '60px', borderBottom: `1px solid ${borderColor}`, mb: 1 }} />
                                    )
                                )}
                                <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Signature</Typography>
                            </Box>
                        </Box>

                    </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={id}
                defaultName={formMetadata.name || `Site Induction Record - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
