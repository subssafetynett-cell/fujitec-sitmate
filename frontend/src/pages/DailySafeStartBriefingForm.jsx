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
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

export default function DailySafeStartBriefingForm() {
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

    const [attendees, setAttendees] = useState(
        Array.from({ length: 5 }, () => ({ name: "", signature: "", comments: "" }))
    );

    const [consultation, setConsultation] = useState("");

    const [briefingGivenBy, setBriefingGivenBy] = useState({
        name: "",
        signature: "",
        jobTitle: ""
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
                downloadPdfFromRef(containerRef, `DailySafeStart_${id}`, () => {
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
            const formData = { 
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
                tags: tags || formMetadata.tags
            };
            if (siteId) formData.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: formData });
            } else {
                const formId = await getOrCreateTemplateForm("Daily Safe Start Briefing Sheet");
                await api.post(`/forms/${formId}/responses`, {
                    answers: formData,
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

    const handleAttendeeChange = (index, field) => (e) => {
        const newArr = [...attendees];
        newArr[index] = { ...newArr[index], [field]: e.target.value };
        setAttendees(newArr);
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
        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', cursor: 'pointer', gap: 0.5 }} onClick={onClick}>
            {label && <Typography sx={{ fontSize: '0.85rem' }}>{label}</Typography>}
            {checked ? <CheckBoxIcon fontSize="small" color="primary" /> : <CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />}
        </Box>
    );

    return (
        <Layout pageTitle="Daily Safe Start Briefing">
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
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        borderRadius: 2,
                        border: (downloading || action === 'download') ? "1px solid #ccc" : "none"
                    }}
                >
                    {/* Top Header Logos and Document Info */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 4 }}>
                                                {/* Left Logo / Upload */}
                        <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${borderColor}` }}>
                            {docInfo.logo ? (
                                <>
                                    <Box component="img" src={docInfo.logo} alt="Uploaded Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 0.5, py: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: 1 }}>Page 1 of 1</Box>
                            </Box>
                        </Box>

                        
                    </Box>

                    {/* Start Right Details Section */}
                    <Box sx={{ border: `1px solid ${borderColor}` }}>
                        <Box sx={{ bgcolor: isDarkMode ? "#374151" : "#111827", color: "#FFFFFF", textAlign: "center", py: 0, fontWeight: 'bold', fontSize: '1.2rem', borderBottom: `1px solid ${borderColor}` }}>
                            {(downloading || action === 'download') ? (
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.projectName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.projectName} onChange={e => setHeaderData({...headerData, projectName: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} />)}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold' }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.principalContractor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.principalContractor} onChange={e => setHeaderData({...headerData, principalContractor: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '15%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{headerData.methodStatementNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={headerData.methodStatementNo} onChange={e => setHeaderData({...headerData, methodStatementNo: e.target.value})} />)}
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{activities || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }} value={activities} onChange={e => setActivities(e.target.value)} />)}
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
                                {/* Top categories headers */}
                                <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, flex: 1 }}>
                                    {[
                                        { key: 'workAtHeight', label: 'Work at Height', img: '/hazards/work-at-height.png' },
                                        { key: 'manualLifting', label: 'Manual Lifting', img: '/hazards/manual-lifting.png' },
                                        { key: 'liftingOperation', label: 'Lifting Operation', img: '/hazards/lifting-operation.png' },
                                        { key: 'powerTools', label: 'Power Tools & Equipment', img: '/hazards/power-tools.png' },
                                        { key: 'openLiftShaft', label: 'Open Lift Shaft', img: '/hazards/open-lift-shaft.png' },
                                        { key: 'electricity', label: 'Electricity', img: '/hazards/electricity.png' },
                                        { key: 'ppeHealth', label: 'PPE / Health', img: '/hazards/ppe.png' },
                                    ].map((cat, idx, arr) => (
                                        <Box key={cat.key} sx={{ width: `${100/arr.length}%`, borderRight: idx < arr.length-1 ? `1px solid ${borderColor}` : 'none', display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                                                <Box component="img" src={cat.img} alt={cat.label} sx={{ height: 40, width: 40, mb: 1, objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                                {cat.label}
                                            </Box>
                                            <Box sx={{ p: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center' }}>
                                                <CustomCheckbox checked={hazards[cat.key]} onClick={() => toggleHazard(cat.key)} />
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                                {/* Other List */}
                                <Box sx={{ borderTop: `1px solid ${borderColor}`, p: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                    <Box sx={{ fontSize: '0.85rem', whiteSpace: 'nowrap', mr: 1 }}>Other (List):</Box>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{hazards.otherText || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", py: 0, height: '100%', fontSize: '0.85rem' } }} value={hazards.otherText} onChange={e => setHazards({...hazards, otherText: e.target.value})} />)}
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{controlMeasures || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", p: cellPadding } }} value={controlMeasures} onChange={e => setControlMeasures(e.target.value)} />)}
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
                            <Box sx={{ width: { xs: '100%', md: '5%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}></Box>
                            <Box sx={{ width: { xs: '100%', md: '35%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Name</Box>
                            <Box sx={{ width: { xs: '100%', md: '30%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>Signature</Box>
                            <Box sx={{ width: { xs: '100%', md: '30%' }, p: cellPadding }}>Comments</Box>
                        </Box>

                        {attendees.map((attendee, idx) => (
                            <Box key={idx} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: idx < attendees.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '5%' }, p: cellPadding, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{idx + 1}.</Box>
                                <Box sx={{ width: { xs: '100%', md: '35%' }, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{attendee.name || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={attendee.name} onChange={handleAttendeeChange(idx, 'name')} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '30%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                    {attendee.signature && (attendee.signature.startsWith('data:image/') || attendee.signature.startsWith('http')) ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 0.5 }}>
                                            <Box component="img" src={attendee.signature} alt="Signature" sx={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                                            {!(downloading || action === 'download') && (
                                                <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => {
                                                    const newArr = attendees.map((a, i) => i === idx ? { ...a, signature: '' } : a);
                                                    setAttendees(newArr);
                                                }}>Remove</Button>
                                            )}
                                        </Box>
                                    ) : (
                                        (downloading || action === 'download') ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{attendee.signature || ' '}</Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: 'column' }}>
                                                <TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={attendee.signature} onChange={handleAttendeeChange(idx, 'signature')} placeholder="Sign..." />
                                                <Button variant="outlined" component="label" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none', mt: 0.5 }}>
                                                    Upload
                                                    <input type="file" hidden accept="image/*" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                const newArr = attendees.map((a, i) => i === idx ? { ...a, signature: ev.target.result } : a);
                                                                setAttendees(newArr);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </Button>
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{attendee.comments || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={attendee.comments} onChange={handleAttendeeChange(idx, 'comments')} />)}
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {/* Consultation Section */}
                    <Box sx={{ mt: 3, border: `1px solid ${borderColor}` }}>
                        <Box sx={{ p: 1, textAlign: 'center', fontSize: '0.85rem', borderBottom: `1px solid ${borderColor}` }}>
                            Workforce Consultation (record any health & safety issues raised by the workforce after briefing)
                        </Box>
                        {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{consultation || ' '}</Typography>) : (<TextField 
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
                                {(downloading || action === 'download') ? 
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
                                    {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingGivenBy.name || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={briefingGivenBy.name} onChange={e => setBriefingGivenBy({...briefingGivenBy, name: e.target.value})} />)}
                            </Box>
                            <Box sx={{ width: '26.66%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                <Box sx={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', p: 0 }}>
                                    {(downloading || action === 'download') ? 
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
                                        {!(downloading || action === 'download') && (
                                            <Button size="small" color="error" sx={{ fontSize: '0.65rem', minWidth: 'auto', p: 0, mt: 0.5 }} onClick={() => setBriefingGivenBy({...briefingGivenBy, signature: ''})}>Remove</Button>
                                        )}
                                    </Box>
                                ) : (
                                    (downloading || action === 'download') ? (
                                        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit', flex: 1 }}>{briefingGivenBy.signature || ' '}</Typography>
                                    ) : (
                                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: 'column' }}>
                                            <TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={briefingGivenBy.signature} onChange={e => setBriefingGivenBy({...briefingGivenBy, signature: e.target.value})} placeholder="Sign..." />
                                            <Button variant="outlined" component="label" size="small" sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: '2px 8px', fontSize: '0.65rem', textTransform: 'none', mt: 0.5 }}>
                                                Upload
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setBriefingGivenBy({...briefingGivenBy, signature: ev.target.result});
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        </Box>
                                    )
                                )}
                            </Box>
                            <Box sx={{ width: '26.66%', display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', p: 0 }}>
                                    {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{briefingGivenBy.jobTitle || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: isDarkMode ? "#F9FAFB" : "#111827", px: 1, py: 0.5, height: '100%' } }} value={briefingGivenBy.jobTitle} onChange={e => setBriefingGivenBy({...briefingGivenBy, jobTitle: e.target.value})} />)}
                            </Box>
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
                defaultName={formMetadata.name || `Daily Safe Start - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
