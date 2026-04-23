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

export default function LolerInspectionForm() {
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

    // Initial State Structure mapped from form image
    const [docInfo, setDocInfo] = useState({
        date: "May 2023",
        docNo: "CL-F-40 – Rev 0",
        approvedBy: "R. Lewis"
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

    const [tableRows, setTableRows] = useState(Array(10).fill({
        equipment: "",
        plantId: "",
        swl: "",
        nextDate: "",
        matters: "",
        actionTaken: "",
        safeToUse: ""
    }));

    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    useEffect(() => {
        if (!loading && action === "download" && id) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `LolerInspectionForm_${id}`, () => {
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
                    if (submission.answers.topSection) setTopSection(submission.answers.topSection);
                    if (submission.answers.headerLabels) setHeaderLabels(submission.answers.headerLabels);
                    if (submission.answers.tableRows) setTableRows(submission.answers.tableRows);
                    setFormMetadata({
                        name: submission.answers.name || `LOLER Inspection - ${new Date(submission.createdAt).toLocaleDateString()}`,
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
                topSection, 
                headerLabels, 
                tableRows,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) payload.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: payload });
            } else {
                const formId = await getOrCreateTemplateForm("LOLER Inspection Form");
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

    const updateTopSection = (field) => (e) => {
        setTopSection({ ...topSection, [field]: e.target.value });
    };

    const updateTableRow = (index, field, value) => {
        const newRows = [...tableRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setTableRows(newRows);
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
                        p: { xs: 2, md: 5 }, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: 2,
                        border: (downloading || action === 'download') ? "1px solid #ccc" : "none",
                        fontFamily: 'Arial, sans-serif'
                    }}
                >
                    {/* Header */}
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, border: `1px solid ${borderColor}`, mb: 3 }}>
                                                {/* Left Logo / Upload */}
                        <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${borderColor}` }}>
                            {docInfo.logo ? (
                                <>
                                    <Box component="img" src={docInfo.logo} alt="Uploaded Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                                    {(action !== 'download') && (
                                        <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                            Change
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
                            <Box sx={{ flex: 1, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? (
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
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.date || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.date} onChange={e => setDocInfo({...docInfo, date: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
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
                                <Box sx={{ width: { xs: '100%', md: '60%' }, p: 0 }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.docNo || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.docNo} onChange={e => setDocInfo({...docInfo, docNo: e.target.value})} />)}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Box sx={{ width: { xs: '100%', md: '40%' }, p: cellPadding, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (
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
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{docInfo.approvedBy || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, height: '100%' } }} value={docInfo.approvedBy} onChange={e => setDocInfo({...docInfo, approvedBy: e.target.value})} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: cellPadding }}>Page 1 of 1</Box>
                            </Box>
                        </Box>
                        
                        <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {docInfo.logoRight ? (
                                <>
                                    <Box component="img" src={docInfo.logoRight} alt="Right Logo" sx={{ width: { xs: '100%', md: '80%' }, maxHeight: '100px', objectFit: 'contain', mb: (action !== 'download') ? 1 : 0 }} />
                                    {(action !== 'download') && (
                                        <Button variant="text" size="small" component="label" sx={{ fontSize: '0.7rem' }}>
                                            Change
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

                    {/* Top Section */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 3 }}>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.projectName || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.projectName} onChange={updateTopSection("projectName")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.projectManager || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.projectManager} onChange={updateTopSection("projectManager")} />)}
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '25%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.principalContractor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.principalContractor} onChange={updateTopSection("principalContractor")} />)}
                            </Box>
                            <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, fontWeight: 'bold', borderRight: `1px solid ${borderColor}` }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{topSection.siteSupervisor || ' '}</Typography>) : (<TextField fullWidth multiline variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={topSection.siteSupervisor} onChange={updateTopSection("siteSupervisor")} />)}
                            </Box>
                        </Box>
                        <Box sx={{ p: cellPadding, minHeight: '30px' }}></Box>
                    </Box>

                    {/* Table */}
                    <Box sx={{ border: `1px solid ${borderColor}` }}>
                        {/* Table Header */}
                        <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, fontWeight: 'bold', borderBottom: `1px solid ${borderColor}` }}>
                            <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}`, display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, alignItems: 'center' }}>
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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
                                {(downloading || action === 'download') ? 
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

                        {/* Table Rows */}
                        {tableRows.map((row, index) => (
                            <Box key={index} sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, borderBottom: index < tableRows.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.equipment || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.equipment} onChange={e => updateTableRow(index, 'equipment', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.plantId || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.plantId} onChange={e => updateTableRow(index, 'plantId', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '10%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.swl || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.swl} onChange={e => updateTableRow(index, 'swl', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '12%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.nextDate || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.nextDate} onChange={e => updateTableRow(index, 'nextDate', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '18%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.matters || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.matters} onChange={e => updateTableRow(index, 'matters', e.target.value)} />)}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: '20%' }, p: 0, borderRight: `1px solid ${borderColor}` }}>
                                    {(downloading || action === 'download') ? (<Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', px: 1, py: 1, minHeight: '1.5em', textAlign: 'inherit' }}>{row.actionTaken || ' '}</Typography>) : (<TextField fullWidth multiline minRows={2} variant="standard" InputProps={{ disableUnderline: true, sx: { color: textColor, px: 1, py: 0.5 } }} value={row.actionTaken} onChange={e => updateTableRow(index, 'actionTaken', e.target.value)} />)}
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
                        ))}
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
                defaultName={formMetadata.name || `LOLER Inspection - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Layout>
    );
}
