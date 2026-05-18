import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Box,
    Typography,
    Paper,
    TextField,
    InputAdornment,
    CircularProgress,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    Chip,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Divider,
    InputLabel,
    Menu,
    MenuItem,
    ListItemText
} from "@mui/material";

import { 
    Building2, ClipboardList, FileText, DraftingCompass, BookOpen, 
    Award, ShieldCheck, UploadCloud, Eye, Download, Trash2, X,
    AlertTriangle, AlertOctagon, UserCheck
} from "lucide-react";
import SearchIcon from "@mui/icons-material/Search";
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import AddIcon from '@mui/icons-material/Add';



import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'; // RAMS
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'; // Inductions
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined'; // Toolbox?
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'; // Site Inspections?
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'; // Accident
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'; // Permits
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined'; // Drawings
import BookOutlinedIcon from '@mui/icons-material/BookOutlined'; // Site Diary
import AppRegistrationOutlinedIcon from '@mui/icons-material/AppRegistrationOutlined'; // Register
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'; // Meeting Minutes
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'; // Audit

import Layout from '../components/Layout';
import api, {
  fetchSites,
  uploadDocument,
  fetchDocuments,
  fetchDocumentCounts,
  deleteDocument,
  fetchDocumentPreviewBlob,
  formatUploadError,
} from "../services/api";
import { isSavedGeneralFormTemplate } from "../utils/generalFormSubmissions";
import {
    DOCUMENT_UPLOAD_ACCEPT,
    MAX_DOCUMENT_MB,
    CLOUDINARY_MAX_MB,
    getDocumentFileSizeError,
    isAllowedDocumentFile,
    documentTypeFromFile,
    getDocumentViewUrl,
    isLocalStoredDocument,
    canUseGoogleDocsViewer,
    OFFICE_PREVIEW_TYPES,
    downloadSiteDocument,
} from "../utils/documentFiles";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const TEMPLATES = [
    {
        id: "tool-box-talk",
        title: "Tool Box Talk Register",
        description: "Official TBT attendance and sign-off",
        path: "/general-forms/tool-box-talk",
    },
    {
        id: "rams-briefing",
        title: "RAMS Briefing Form",
        description: "Risk Assessment & Method Statement",
        path: "/general-forms/rams-briefing",
    },
    {
        id: "site-induction",
        title: "Site Induction Register",
        description: "Sign-off register for site inductions",
        path: "/general-forms/site-induction",
    },
    {
        id: "management-site-inspection",
        title: "Management Site Inspection Report",
        description: "Comprehensive site H&S walkthrough",
        path: "/general-forms/management-site-inspection",
    },
    {
        id: "daily-safe-start-briefing",
        title: "Daily Safe Start Briefing Sheet",
        description: "Start Right Daily Safety Briefing",
        path: "/general-forms/daily-safe-start-briefing",
    },
    {
        id: "audit-action-form",
        title: "Audit Action Form",
        description: "Review and report observations & assigned actions",
        path: "/general-forms/audit-action-form",
    },
    {
        id: "site-induction-form",
        title: "Site Induction Form",
        description: "Personal and comprehensive 3-page site induction record",
        path: "/general-forms/site-induction-form",
    },
    {
        id: "loler-inspection-form",
        title: "LOLER Inspection Form",
        description: "Official Equipment inspection and certification",
        path: "/general-forms/loler-inspection-form",
    },
    {
        id: "puwer-inspection-form",
        title: "PUWER Inspection Form",
        description: "Plant equipment formal maintenance certification",
        path: "/general-forms/puwer-inspection-form",
    }
];

const FRIDAY_PACK_ACCENT = "#E89F17";

/** Template card for the Friday Pack “Create form” picker modal. */
function FormPickerCard({ title, description, meta, onSelect, onPreview, isDarkMode }) {
    return (
        <Card
            onClick={onSelect}
            elevation={0}
            sx={{
                cursor: "pointer",
                borderRadius: 2.5,
                height: "100%",
                minHeight: 108,
                display: "flex",
                flexDirection: "column",
                bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                "&:hover": {
                    borderColor: FRIDAY_PACK_ACCENT,
                    transform: "translateY(-2px)",
                    boxShadow: isDarkMode
                        ? "0 8px 24px rgba(0,0,0,0.35)"
                        : "0 8px 24px rgba(232, 159, 23, 0.12)",
                },
            }}
        >
            <CardContent
                sx={{
                    p: 2.5,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    "&:last-child": { pb: 2.5 },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 1,
                    }}
                >
                    <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{
                            flex: 1,
                            lineHeight: 1.35,
                            color: isDarkMode ? "#F9FAFB" : "#111827",
                        }}
                    >
                        {title}
                    </Typography>
                    <IconButton
                        size="small"
                        aria-label={`Preview ${title}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview();
                        }}
                        sx={{
                            flexShrink: 0,
                            mt: -0.25,
                            color: isDarkMode ? "#60A5FA" : "#0B4DA6",
                            bgcolor: isDarkMode ? "rgba(55, 65, 81, 0.6)" : "#F3F4F6",
                            "&:hover": {
                                bgcolor: isDarkMode ? "#374151" : "#E5E7EB",
                            },
                        }}
                    >
                        <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
                {description ? (
                    <Typography
                        variant="body2"
                        sx={{
                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                            lineHeight: 1.45,
                            flexGrow: 1,
                        }}
                    >
                        {description}
                    </Typography>
                ) : null}
                {meta ? (
                    <Typography
                        variant="caption"
                        sx={{
                            color: isDarkMode ? "#6B7280" : "#9CA3AF",
                            mt: description ? 0 : "auto",
                        }}
                    >
                        {meta}
                    </Typography>
                ) : null}
            </CardContent>
        </Card>
    );
}

const MODULES_CONFIG_DEFAULT = [
    { title: "Friday Pack Forms", icon: <ClipboardList size={32} /> },
    { title: "RAMS", icon: <FileText size={32} /> },
    { title: "Drawings", icon: <DraftingCompass size={32} /> },
    { title: "Installation Manuals", icon: <BookOpen size={32} /> },
    { title: "Training Certificates", icon: <Award size={32} /> },
    { title: "Equipment Certificates", icon: <ShieldCheck size={32} /> },
    { title: "General Uploads", icon: <UploadCloud size={32} /> },
];

const MODULES_CONFIG_ADSTONE = [
    { title: "Induction", icon: <ShieldCheck size={32} /> },
    { title: "RAMS", icon: <FileText size={32} /> },
    { title: "Quality - handover ITP", icon: <Award size={32} /> },
    { title: "Toolbox talks", icon: <GroupsOutlinedIcon sx={{ fontSize: 32 }} /> },
    { title: "Inspections", icon: <ClipboardList size={32} /> },
    { title: "NCRs and dayworks", icon: <AlertTriangle size={32} /> },
    { title: "Incident reporting", icon: <AlertOctagon size={32} /> },
];

/** Cards may show a custom saved name; routing must use the real template title from the API. */
function getSitepackFormTemplateTitle(menuDoc) {
    if (!menuDoc) return "";
    return (
        menuDoc.rawResponse?.form?.title ||
        (typeof menuDoc.templateTitle === "string" ? menuDoc.templateTitle : "") ||
        menuDoc.title ||
        ""
    );
}

function getSitepackStandardFormPath(menuDoc, responseId) {
    const t = getSitepackFormTemplateTitle(menuDoc);
    const routes = {
        "Tool Box Talk Register": `/general-forms/tool-box-talk/${responseId}`,
        "RAMS Briefing Form": `/general-forms/rams-briefing/${responseId}`,
        "Site Induction Register": `/general-forms/site-induction/${responseId}`,
        "Management Site Inspection Report": `/general-forms/management-site-inspection/${responseId}`,
        "Daily Safe Start Briefing Sheet": `/general-forms/daily-safe-start-briefing/${responseId}`,
        "Audit Action Form": `/general-forms/audit-action-form/${responseId}`,
        "Site Induction Form": `/general-forms/site-induction-form/${responseId}`,
        "Adstone Site Induction Form": `/general-forms/adstone-site-induction/${responseId}`,
        "LOLER Inspection Form": `/general-forms/loler-inspection-form/${responseId}`,
        "PUWER Inspection Form": `/general-forms/puwer-inspection-form/${responseId}`,
    };
    return routes[t] || null;
}

function getSitepackFormPathForResponse(menuDoc, responseId) {
    const std = getSitepackStandardFormPath(menuDoc, responseId);
    if (std) return std;
    const formId = menuDoc?.rawResponse?.formId;
    if (!formId) return null;
    return `/forms/${formId}/use?responseId=${encodeURIComponent(responseId)}`;
}

function pathWithSearchParams(path, params) {
    const qs = new URLSearchParams(params).toString();
    if (!qs) return path;
    return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

export default function SitepackManagement() {
    const { isDarkMode } = useTheme();
    const { role } = useAuth();
    // Get user and determine modules config
    const userString = localStorage.getItem("user");
    const user = userString ? JSON.parse(userString) : null;
    const isAdstone = user?.companyname?.trim()?.toLowerCase() === "adstone";
    const activeConfig = isAdstone ? MODULES_CONFIG_ADSTONE : MODULES_CONFIG_DEFAULT;

    // State
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const search = searchParams.get("search") || "";
    const [selectedSite, setSelectedSite] = useState(null);
    const [selectedModule, setSelectedModule] = useState(null);
    const [modules, setModules] = useState(activeConfig.map(m => ({ ...m, count: '0 documents', id: m.title })));
    const location = useLocation();

    // Persist View State
    useEffect(() => {
        if (sites.length > 0 && location.state?.siteId) {
            const site = sites.find(s => (s._id || s.id) === location.state.siteId);
            if (site) {
                setSelectedSite(site);
                if (location.state.moduleTitle) {
                    const mod = modules.find(m => m.title === location.state.moduleTitle);
                    if (mod) setSelectedModule(mod);
                }
                window.history.replaceState({}, document.title);
            }
        }
    }, [sites, location.state, modules]);

    // Document State
    const [docs, setDocs] = useState([]);

    // UI State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [createFormModalOpen, setCreateFormModalOpen] = useState(false);
    const [graphModalOpen, setGraphModalOpen] = useState(false);
    const [savedGeneralSubmissions, setSavedGeneralSubmissions] = useState([]);
    const [createFormModalLoading, setCreateFormModalLoading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewDocUrl, setViewDocUrl] = useState(null);
    const [viewDocSourceUrl, setViewDocSourceUrl] = useState(null);
    const [viewDocType, setViewDocType] = useState(null);
    const [viewDocTitle, setViewDocTitle] = useState("");
    const [viewDocRecord, setViewDocRecord] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState(null);
    const [downloadInProgress, setDownloadInProgress] = useState(false);
    const viewBlobUrlRef = useRef(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

    const [anchorEl, setAnchorEl] = useState(null);
    const [menuDoc, setMenuDoc] = useState(null);
    const [formData, setFormData] = useState({
        file: null, title: "", validFrom: "", validUntil: ""
    });
    const [formErrors, setFormErrors] = useState({});

    // Graph Data Parsers
    const chartData = modules.map(m => {
        const value = parseInt(m.count.split(' ')[0]) || 0;
        return { name: m.title, value };
    }).filter(m => m.value > 0);
    
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

    // Load Sites
    useEffect(() => {
        const loadSites = async () => {
            setLoading(true);
            try {
                const data = await fetchSites(search);
                setSites(data.filter(site => site.isActive));
            } catch (error) {
                console.error("Error loading sites:", error);
            } finally {
                setLoading(false);
            }
        };
        loadSites();
    }, [search]);

    // Load Counts when site selected
    useEffect(() => {
        if (selectedSite) {
            const loadCounts = async () => {
                try {
                    const { counts } = await fetchDocumentCounts(selectedSite._id || selectedSite.id);

                    // Fetch all form responses for this site to aggregate counts
                    let formCountsByCategory = {};
                    try {
                        const res = await api.get('/forms/responses');
                        if (res.data?.success) {
                            const siteResponses = res.data.data.filter(r => 
                                r.answers?.siteId === (selectedSite._id || selectedSite.id) || 
                                r.siteId === (selectedSite._id || selectedSite.id)
                            );
                            
                            siteResponses.forEach(r => {
                                const cat = r.category || "General";
                                formCountsByCategory[cat] = (formCountsByCategory[cat] || 0) + 1;
                            });
                        }
                    } catch (e) {
                        console.error("Failed to load form counts", e);
                    }

                    // Update modules with counts (docs + forms)
                    setModules(prev => prev.map(m => {
                        const docTotal = counts[m.title] || 0;
                        const formTotal = formCountsByCategory[m.title] || 0;

                        return {
                            ...m,
                            count: `${docTotal + formTotal} documents`
                        };
                    }));
                } catch (error) {
                    console.error("Error loading counts:", error);
                }
            };
            loadCounts();
        }
    }, [selectedSite]);

    // Load Documents when module selected
    useEffect(() => {
        if (selectedSite && selectedModule) {
            const loadDocs = async () => {
                try {
                    let allItems = [];
                    const { documents } = await fetchDocuments(selectedSite._id || selectedSite.id, selectedModule.title);
                    if (documents) allItems = [...allItems, ...documents];

                    // Also fetch Form Responses for the current category
                    try {
                        const res = await api.get(`/forms/responses?category=${encodeURIComponent(selectedModule.title)}`);
                        if (res.data?.success) {
                            const siteResponses = res.data.data.filter(r => 
                                r.answers?.siteId === (selectedSite._id || selectedSite.id) ||
                                r.siteId === (selectedSite._id || selectedSite.id)
                            );
                            const mappedForms = siteResponses.map(r => {
                                // Prefer custom name given in modal, then fall back to template title or category
                                const customName = r.name || r.answers?.name || r.answers?.formMetadata?.name;
                                const templateTitle = r.form?.title || r.title || r.category || 'Form Response';
                                const title = customName || templateTitle;

                                // Handle tags which could be an array or a comma-separated string
                                let rawTags = r.tags || r.answers?.tags || r.answers?.formMetadata?.tags || [];
                                let tags = [];
                                if (typeof rawTags === 'string' && rawTags.trim().length > 0) {
                                    tags = rawTags.split(',').map(t => t.trim());
                                } else if (Array.isArray(rawTags)) {
                                    tags = rawTags.filter(Boolean);
                                }

                                return {
                                    id: r.id || r._id,
                                    title,
                                    templateTitle: customName ? templateTitle : null,
                                    type: 'FORM',
                                    version: '1.0',
                                    size: customName ? templateTitle : 'Digital Form',
                                    tags,
                                    createdAt: r.createdAt,
                                    isFormBase: true,
                                    rawResponse: r
                                };
                            });
                            allItems = [...allItems, ...mappedForms];
                        }
                    } catch (e) {
                        console.error("Failed to fetch form responses for module", e);
                    }

                    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setDocs(allItems);
                } catch (error) {
                    console.error("Error loading docs:", error);
                }
            };
            loadDocs();
        }
    }, [selectedSite, selectedModule]);

    const generalFormTitleToPath = useMemo(() => {
        const m = Object.fromEntries(TEMPLATES.map((t) => [t.title, t.path]));
        if (isAdstone) {
            m["Adstone Site Induction Form"] = "/general-forms/adstone-site-induction";
        }
        return m;
    }, [isAdstone]);

    // Load custom form definitions + saved general-form responses for the Create Form dialog
    useEffect(() => {
        if (!createFormModalOpen) return;
        let cancelled = false;
        const load = async () => {
            setCreateFormModalLoading(true);
            setSavedGeneralSubmissions([]);
            try {
                const responsesRes = await api.get("/forms/responses");
                if (cancelled) return;
                if (responsesRes.data?.success) {
                    const list = responsesRes.data.data || [];
                    const saved = list
                        .filter(isSavedGeneralFormTemplate)
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setSavedGeneralSubmissions(saved);
                }
            } catch (e) {
                console.error("Failed to load Create Form dialog data", e);
            } finally {
                if (!cancelled) setCreateFormModalLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [createFormModalOpen, generalFormTitleToPath]);

    // Handlers
    const handleSiteClick = (site) => {
        setSelectedSite(site);
        setSelectedModule(null);
    };

    const handleBackToSites = () => {
        if (selectedModule) {
            setSelectedModule(null);
        } else {
            setSelectedSite(null);
        }
    };

    const handleModuleClick = (module) => {
        setSelectedModule(module);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isAllowedDocumentFile(file)) {
            setFormErrors({
                ...formErrors,
                file: "Unsupported file type. Use PDF, Word, Excel, PowerPoint, PNG, JPEG, or similar.",
            });
            return;
        }

        const sizeError = getDocumentFileSizeError(file);
        if (sizeError) {
            setFormData({ ...formData, file: null });
            setFormErrors({ ...formErrors, file: sizeError });
            e.target.value = "";
            return;
        }

        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setFormData({
            ...formData,
            file,
            title: formData.title ? formData.title : fileNameWithoutExt,
        });
        setFormErrors({ ...formErrors, file: null, title: null });
    };

    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
        setFormErrors({ ...formErrors, [field]: null });
    };

    const [isUploading, setIsUploading] = useState(false);

    const handleCloseUploadModal = () => {
        setUploadModalOpen(false);
        setFormData({ file: null, title: "", validUntil: "" });
        setFormErrors({});
    };

    const handleUpload = async () => {
        const errors = {};
        if (!formData.file) errors.file = "File is required";
        if (!formData.title) errors.title = "Title is required";
        if (!formData.validUntil) errors.validUntil = "Valid Until is required";

        if (formData.file) {
            const sizeError = getDocumentFileSizeError(formData.file);
            if (sizeError) errors.file = sizeError;
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setIsUploading(true);
        try {
            const uploadData = new FormData();
            uploadData.append('file', formData.file);
            uploadData.append('title', formData.title);
            uploadData.append('validUntil', formData.validUntil);
            uploadData.append('siteId', selectedSite._id || selectedSite.id);
            uploadData.append('category', selectedModule.title);

            await uploadDocument(uploadData);
            handleCloseUploadModal();
            // Refresh docs
            const { documents } = await fetchDocuments(selectedSite._id || selectedSite.id, selectedModule.title);
            setDocs(documents || []);
        } catch (error) {
            console.error("Upload failed", error);
            setFormErrors((prev) => ({ ...prev, file: formatUploadError(error) }));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSelectForm = (formPath, isCustom = false, customFormId = null) => {
        const siteId = selectedSite._id || selectedSite.id;
        const category = encodeURIComponent("Friday Pack Forms");

        if (isCustom) {
            navigate(`/forms/${customFormId}/use?siteId=${siteId}&category=${category}`);
        } else {
            navigate(`${formPath}?siteId=${siteId}&category=${category}`);
        }
    };

    const handlePreviewForm = (formPath, isCustom = false, customFormId = null) => {
        const siteId = selectedSite._id || selectedSite.id;
        const category = encodeURIComponent("Friday Pack Forms");

        let url = "";
        if (isCustom) {
            url = `/forms/${customFormId}/use?siteId=${siteId}&category=${category}&preview=true`;
        } else {
            url = `${formPath}?siteId=${siteId}&category=${category}&preview=true`;
        }
        setPreviewUrl(url);
        setPreviewModalOpen(true);
    };

    const handleSelectSavedGeneralSubmission = (submission) => {
        const siteId = selectedSite._id || selectedSite.id;
        const category = encodeURIComponent("Friday Pack Forms");
        const path = generalFormTitleToPath[submission.form?.title];
        if (!path) return;
        const rid = submission.id || submission._id;
        // fromTemplate: hydrate from saved general form but POST a new response for this site (do not overwrite the template).
        navigate(`${path}?siteId=${siteId}&category=${category}&fromTemplate=${encodeURIComponent(rid)}`);
    };

    const handlePreviewSavedGeneralSubmission = (submission) => {
        const siteId = selectedSite._id || selectedSite.id;
        const category = encodeURIComponent("Friday Pack Forms");
        const path = generalFormTitleToPath[submission.form?.title];
        if (!path) return;
        const rid = submission.id || submission._id;
        setPreviewUrl(`${path}?siteId=${siteId}&category=${category}&fromTemplate=${encodeURIComponent(rid)}&preview=true`);
        setPreviewModalOpen(true);
    };

    const handleMenuClick = (event, doc) => {
        setAnchorEl(event.currentTarget);
        setMenuDoc(doc);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setMenuDoc(null);
    };

    const openMenu = Boolean(anchorEl);

    const revokeViewBlobUrl = () => {
        if (viewBlobUrlRef.current) {
            URL.revokeObjectURL(viewBlobUrlRef.current);
            viewBlobUrlRef.current = null;
        }
    };

    const handleView = async () => {
        if (menuDoc?.isFormBase) {
            handleMenuClose();
            const siteId = selectedSite._id || selectedSite.id;
            const resId = menuDoc.id || menuDoc._id;
            const path = getSitepackFormPathForResponse(menuDoc, resId);
            if (!path) return;
            const category = selectedModule?.title || "Friday Pack Forms";
            navigate(pathWithSearchParams(path, { siteId, category }));
            return;
        }

        const docToView = menuDoc;
        handleMenuClose();

        if (!docToView?.url) return;

        const docType = (docToView.type || "FILE").toUpperCase();
        const docId = docToView.id || docToView._id;

        revokeViewBlobUrl();
        setViewDocTitle(docToView.title || "Document");
        setViewDocSourceUrl(docToView.url);
        setViewDocType(docType);
        setViewDocRecord({
            id: docToView.id || docToView._id,
            url: docToView.url,
            title: docToView.title || "Document",
            type: docType,
        });
        setViewError(null);
        setViewDocUrl(null);
        setViewModalOpen(true);
        setViewLoading(true);

        try {
            let previewUrl = getDocumentViewUrl(docToView.url, docType);

            if (docId && (isLocalStoredDocument(docToView.url) || !previewUrl)) {
                const blob = await fetchDocumentPreviewBlob(docId);
                const blobUrl = URL.createObjectURL(blob);
                viewBlobUrlRef.current = blobUrl;
                previewUrl = blobUrl;
            }

            if (!previewUrl && OFFICE_PREVIEW_TYPES.includes(docType)) {
                setViewError(
                    canUseGoogleDocsViewer(docToView.url)
                        ? "Preview could not be loaded. Try downloading the file."
                        : "Office documents stored on this server cannot be previewed in the browser. Download the file to open it."
                );
            } else if (!previewUrl) {
                setViewError("Preview could not be loaded. Try downloading the file.");
            } else {
                setViewDocUrl(previewUrl);
            }
        } catch (err) {
            console.error("Document preview error:", err);
            const fallback = getDocumentViewUrl(docToView.url, docType);
            if (fallback) {
                setViewDocUrl(fallback);
            } else {
                setViewError(
                    err?.response?.data?.message ||
                        err?.message ||
                        "Could not load this document. Try downloading it instead."
                );
            }
        } finally {
            setViewLoading(false);
        }
    };

    const handleCloseViewModal = () => {
        revokeViewBlobUrl();
        setViewModalOpen(false);
        setViewDocUrl(null);
        setViewDocSourceUrl(null);
        setViewDocType(null);
        setViewDocTitle("");
        setViewDocRecord(null);
        setViewLoading(false);
        setViewError(null);
    };

    const runDocumentDownload = async (doc) => {
        if (!doc?.url) return;
        setDownloadInProgress(true);
        try {
            await downloadSiteDocument(doc);
        } catch (err) {
            console.error("Document download error:", err);
            window.alert(
                err?.response?.data?.message ||
                    err?.message ||
                    "Download failed. Please try again."
            );
        } finally {
            setDownloadInProgress(false);
        }
    };

    const handleDownload = () => {
        if (menuDoc?.isFormBase) {
            handleMenuClose();
            const siteId = selectedSite._id || selectedSite.id;
            const resId = menuDoc.id || menuDoc._id;
            const path = getSitepackFormPathForResponse(menuDoc, resId);
            if (!path) return;
            const category = selectedModule?.title || "Friday Pack Forms";
            const url = pathWithSearchParams(path, { siteId, category, action: "download" });
            window.open(url, "_blank");
            return;
        }

        const docToDownload = menuDoc;
        handleMenuClose();
        if (docToDownload?.url) {
            runDocumentDownload(docToDownload);
        }
    };

    const handleDownloadWord = () => {
        if (menuDoc?.isFormBase) {
            handleMenuClose();
            const siteId = selectedSite._id || selectedSite.id;
            const resId = menuDoc.id || menuDoc._id;
            const templateTitle = getSitepackFormTemplateTitle(menuDoc);
            const standardForms = ['Tool Box Talk Register', 'RAMS Briefing Form', 'Site Induction Register', 'Management Site Inspection Report', 'Daily Safe Start Briefing Sheet', 'Audit Action Form', 'Site Induction Form', 'LOLER Inspection Form', 'PUWER Inspection Form', 'Adstone Site Induction Form'];
            
            // Only supported for custom form builder forms
            if (!standardForms.includes(templateTitle)) {
                 const path = `/forms/${menuDoc.rawResponse?.formId}/use?responseId=${resId}`;
                 const category = selectedModule?.title || "Friday Pack Forms";
                 window.open(pathWithSearchParams(path, { siteId, category, action: "download_word" }), "_blank");
            }
            return;
        }
        handleMenuClose();
    };

    const handleDeleteClick = () => {
        setDeleteModalOpen(true);
        setAnchorEl(null); // Close menu but keep menuDoc for delete dialog
    };

    const confirmDelete = async () => {
        if (menuDoc) {
            try {
                if (menuDoc.isFormBase) {
                    await api.delete(`/forms/responses/${menuDoc._id || menuDoc.id}`);
                } else {
                    await deleteDocument(menuDoc._id || menuDoc.id);
                }
                setDeleteModalOpen(false);
                setMenuDoc(null);
                // Refresh docs
                if (selectedSite && selectedModule) {
                    const { documents } = await fetchDocuments(selectedSite._id || selectedSite.id, selectedModule.title);
                    let allItems = documents || [];
                    
                    try {
                        const res = await api.get(`/forms/responses?category=${encodeURIComponent(selectedModule.title)}`);
                        if (res.data?.success) {
                            const siteResponses = res.data.data.filter(r => 
                                r.answers?.siteId === (selectedSite._id || selectedSite.id) ||
                                r.siteId === (selectedSite._id || selectedSite.id)
                            );
                            const mappedForms = siteResponses.map(r => {
                                const customName = r.name || r.answers?.name || r.answers?.formMetadata?.name;
                                const templateTitle = r.form?.title || r.title || r.category || 'Form Response';
                                const title = customName || templateTitle;

                                let rawTags = r.tags || r.answers?.tags || r.answers?.formMetadata?.tags || [];
                                let tags = [];
                                if (typeof rawTags === 'string' && rawTags.trim().length > 0) {
                                    tags = rawTags.split(',').map(t => t.trim());
                                } else if (Array.isArray(rawTags)) {
                                    tags = rawTags.filter(Boolean);
                                }

                                return {
                                    id: r.id || r._id,
                                    title,
                                    templateTitle: customName ? templateTitle : null,
                                    type: 'FORM',
                                    version: '1.0',
                                    size: customName ? templateTitle : 'Digital Form',
                                    tags,
                                    createdAt: r.createdAt,
                                    isFormBase: true,
                                    rawResponse: r
                                };
                            });
                            allItems = [...allItems, ...mappedForms];
                        }
                    } catch (e) {
                        console.error("Failed to fetch form responses for module after delete", e);
                    }
                    
                    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setDocs(allItems);
                }
            } catch (error) {
                console.error("Delete failed", error);
            }
        }
    };

    const filteredDocs = docs;

    return (
        <Layout pageTitle={selectedSite ? selectedSite.name : "Site Pack Management"}>
            {/* Header Section */}
            <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {selectedSite && (
                        <Box
                            onClick={handleBackToSites}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: 'text.secondary',
                                '&:hover': { color: 'primary.main' }
                            }}
                        >
                            <ArrowBackIcon />
                        </Box>
                    )}
                    <Box>
                        <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 0 }}>
                            {selectedModule ? selectedModule.title : (selectedSite ? selectedSite.name : "All Sites")}
                        </Typography>
                        {!selectedSite && !selectedModule && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                Select a site to manage its document packs
                            </Typography>
                        )}
                        {selectedSite && !selectedModule && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                Select a module to manage documents
                            </Typography>
                        )}
                        {selectedModule && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                {selectedSite.name}
                            </Typography>
                        )}
                        {selectedModule && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {filteredDocs.length} documents
                            </Typography>
                        )}

                    </Box>
                </Box>

                {selectedModule && selectedModule.title === "Friday Pack Forms" ? (
                    <Button
                        variant="contained"
                        startIcon={<DriveFileRenameOutlineIcon />}
                        onClick={() => setCreateFormModalOpen(true)}
                        sx={{
                            textTransform: "none",
                            borderRadius: 3,
                            boxShadow: "none",
                            bgcolor: "hsl(38, 70%, 55%)",
                            "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" },
                        }}
                    >
                        Create Form
                    </Button>
                ) : selectedModule ? (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<FileUploadOutlinedIcon />}
                            onClick={() => setUploadModalOpen(true)}
                            sx={{
                                textTransform: "none",
                                borderRadius: 3,
                                boxShadow: "none",
                                bgcolor: "#E89F17",
                                "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
                            }}
                        >
                            Upload Document
                        </Button>
                        {isAdstone && (selectedModule.title === "Induction" || selectedModule.title === "Toolbox talks") && (
                            <Button 
                                variant="contained"
                                onClick={() => {
                                    const siteId = selectedSite._id || selectedSite.id;
                                    if (selectedModule.title === "Induction") {
                                        navigate(`/general-forms/adstone-site-induction?siteId=${siteId}&category=Induction`);
                                    } else {
                                        navigate(`/general-forms/tool-box-talk?siteId=${siteId}&category=${encodeURIComponent("Toolbox talks")}`);
                                    }
                                }}
                                sx={{ 
                                    bgcolor: "#111827", 
                                    color: "#FFFFFF", 
                                    "&:hover": { bgcolor: "#374151" }, 
                                    borderRadius: 3, 
                                    textTransform: 'none', 
                                    fontWeight: 600,
                                    boxShadow: "none"
                                }}
                            >
                                Select Form
                            </Button>
                        )}
                    </Box>
                ) : selectedSite ? (
                    <Button
                        variant="contained"
                        startIcon={<BarChartIcon />}
                        onClick={() => setGraphModalOpen(true)}
                        sx={{
                            textTransform: "none",
                            borderRadius: 3,
                            boxShadow: "none",
                            bgcolor: "hsl(38, 70%, 55%)",
                            "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" },
                        }}
                    >
                        View Graph
                    </Button>
                ) : null}
            </Box>

            {/* Main Content Grid (Site List or Documents) */}
            {
                selectedSite ? (
                    selectedModule ? (
                        // DOCUMENT VIEW
                        <>

                            <Grid container spacing={3}>
                                {filteredDocs.map((doc) => {
                                    let icon = <DescriptionOutlinedIcon sx={{ fontSize: 32 }} />;
                                    let color = '#6B7280';
                                    let bgcolor = '#F3F4F6';

                                    const type = doc.type ? doc.type.toUpperCase() : '';

                                    if (type === 'PDF') {
                                        icon = <PictureAsPdfIcon sx={{ fontSize: 32 }} />;
                                        color = '#EF4444'; // Red
                                        bgcolor = '#FEF2F2';
                                    } else if (['DOC', 'DOCX'].includes(type)) {
                                        icon = <DescriptionOutlinedIcon sx={{ fontSize: 32 }} />;
                                        color = '#3B82F6'; // Blue
                                        bgcolor = '#EFF6FF';
                                    } else if (['XLS', 'XLSX', 'CSV'].includes(type)) {
                                        icon = <DescriptionOutlinedIcon sx={{ fontSize: 32 }} />;
                                        color = '#10B981'; // Green
                                        bgcolor = '#ECFDF5';
                                    } else if (['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG'].includes(type)) {
                                        icon = <ImageOutlinedIcon sx={{ fontSize: 32 }} />;
                                        color = '#8B5CF6'; // Violet
                                        bgcolor = '#F5F3FF';
                                    } else if (type === 'MP4') {
                                        icon = <ImageOutlinedIcon sx={{ fontSize: 32 }} />;
                                        color = '#D946EF'; // Fuchsia
                                        bgcolor = '#FAE8FF';
                                    } else if (type === 'TXT') {
                                        icon = <DescriptionOutlinedIcon sx={{ fontSize: 32 }} />;
                                        color = '#6B7280'; // Gray
                                        bgcolor = '#F3F4F6';
                                    } else if (type === 'FORM') {
                                        icon = <AssignmentIcon sx={{ fontSize: 32 }} />;
                                        color = '#DB2777'; // Pink
                                        bgcolor = '#FCE7F3';
                                    }

                                    return (
                                        <Grid item key={doc.id || doc._id}>
                                            <Card
                                                variant="outlined"
                                                sx={{
                                                    borderRadius: 4,
                                                    height: '100%',
                                                    width: 350,
                                                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                                                    borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                                                    transition: 'all 0.2s',
                                                    '&:hover': { boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.4)" : 2, borderColor: color },
                                                    position: 'relative'
                                                }}
                                            >
                                                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleMenuClick(e, doc)}
                                                        sx={{ color: 'text.secondary' }}
                                                    >
                                                        <MoreVertIcon />
                                                    </IconButton>
                                                </Box>

                                                <CardContent sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                                    <Box
                                                        sx={{
                                                            minWidth: 56,
                                                            height: 56,
                                                            bgcolor: bgcolor,
                                                            color: color,
                                                            borderRadius: 3,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {icon}
                                                    </Box>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                            <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.2, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                                                {doc.title}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                            <Chip label={doc.type || 'FILE'} size="small" sx={{ bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : bgcolor, color: color, fontWeight: 700, borderRadius: 1, height: 20, fontSize: '0.7rem' }} />
                                                            <Typography variant="caption" sx={{ color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                                                                {doc.version}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="body2" sx={{ mb: 1, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                                                            {doc.size} &bull; {doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : 'N/A'}
                                                        </Typography>
                                                        {(() => {
                                                            // Normalize tags — API may return a string or an array
                                                            let tagList = [];
                                                            if (Array.isArray(doc.tags)) {
                                                                tagList = doc.tags.filter(Boolean);
                                                            } else if (typeof doc.tags === 'string' && doc.tags.trim()) {
                                                                tagList = doc.tags.split(',').map(t => t.trim()).filter(Boolean);
                                                            }
                                                            return tagList.length > 0 ? (
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                                                                    {tagList.map((tag, i) => (
                                                                        <Chip
                                                                            key={i}
                                                                            label={tag}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '0.65rem',
                                                                                height: 18,
                                                                                color: color,
                                                                                borderColor: `${color}44`,
                                                                                bgcolor: `${color}11`
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            ) : null;
                                                        })()}
                                                        {(doc.validFrom && doc.validUntil) && (
                                                            <Chip
                                                                label={`Valid: ${doc.validFrom} — ${doc.validUntil}`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: isDarkMode ? "rgba(251, 146, 60, 0.1)" : '#FFF7ED',
                                                                    color: isDarkMode ? '#FB923C' : '#F97316',
                                                                    borderRadius: 1,
                                                                    fontSize: '0.75rem'
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </>
                    ) : (
                        // MODULE SELECTION VIEW
                        <Grid container spacing={2}>
                            {modules.map((module) => (
                                <Grid item xs={6} sm={6} md={6} lg={6} xl={6} key={module.title} sx={{ minWidth: 0 }}>
                                    <Card
                                        variant="outlined"
                                        onClick={() => handleModuleClick(module)}
                                        sx={{
                                            borderRadius: 4,
                                            width: 300,
                                            height: 100,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                            border: isDarkMode ? "1px solid #374151" : '1px solid #E5E7EB',
                                            transition: 'all 0.2s ease-in-out',
                                            cursor: 'pointer',
                                            "&:hover": {
                                                borderColor: isDarkMode ? "#3B82F6" : "#3B82F6", // Blue hover
                                                boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)"
                                            }
                                        }}
                                    >
                                        <CardActionArea sx={{ flex: 1, p: 2, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                <Box
                                                    sx={{
                                                        bgcolor: isDarkMode ? "rgba(59, 130, 246, 0.1)" : '#EFF6FF', // Blue 50
                                                        p: 1.5,
                                                        borderRadius: 3,
                                                        color: '#3B82F6', // Blue 500
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        minWidth: 48,
                                                        height: 48
                                                    }}
                                                >
                                                    {React.cloneElement(module.icon, { size: 24 })}
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ fontSize: '0.95rem', mb: 0.5, color: isDarkMode ? "#F9FAFB" : "#111827", lineHeight: 1.2 }}>
                                                        {module.title}
                                                    </Typography>
                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 1
                                                    }}>
                                                        <Box sx={{
                                                            display: 'inline-flex',
                                                            px: 1,
                                                            py: 0.25,
                                                            borderRadius: 10,
                                                            bgcolor: '#DFA036',
                                                            color: '#FFFFFF'
                                                        }}>
                                                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem', lineHeight: 1 }}>
                                                                {module.count}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )
                ) : (
                    // SITE LIST VIEW
                    loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {sites.length === 0 ? (
                                <Grid item xs={12}>
                                    <Typography color="text.secondary" align="center">
                                        {role === "site_manager"
                                            ? "No sites assigned to you yet. Ask your company admin to create a site and select you as site manager."
                                            : "No sites found."}
                                    </Typography>
                                </Grid>
                            ) : (
                                sites.map((site) => (
                                    <Grid item xs={12} sm={6} md={4} key={site.id || site._id}>
                                        <Card
                                            variant="outlined"
                                            onClick={() => handleSiteClick(site)}
                                            sx={{
                                                borderRadius: 4,
                                                width: 350,
                                                height: 150,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                                border: isDarkMode ? "1px solid #374151" : '1px solid #E5E7EB',
                                                transition: 'all 0.2s ease-in-out',
                                                cursor: 'pointer',
                                                "&:hover": {
                                                    borderColor: "#3B82F6",
                                                    boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)"
                                                }
                                            }}
                                        >
                                            <CardActionArea sx={{ height: '100%', p: 3, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, width: '100%' }}>
                                                    {/* Icon Box */}
                                                    <Box
                                                        sx={{
                                                            bgcolor: isDarkMode ? "rgba(59, 130, 246, 0.1)" : '#EFF6FF', // Blue 50
                                                            p: 1.5,
                                                            borderRadius: 3,
                                                            color: '#3B82F6', // Blue 500
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            minWidth: 56,
                                                            height: 56
                                                        }}
                                                    >
                                                        <Building2 size={28} />
                                                    </Box>

                                                    {/* Content */}
                                                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', mb: 0.5, color: isDarkMode ? "#F9FAFB" : "#111827", lineHeight: 1.3 }}>
                                                            {site.name}
                                                        </Typography>

                                                        {site.address && (
                                                            <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                {site.address}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ))
                            )
                            }
                        </Grid >
                    )
                )
            }

            {/* Upload Modal */}
            <Dialog
                open={uploadModalOpen}
                onClose={handleCloseUploadModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'visible',
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF"
                    }
                }}
            >
                <DialogTitle sx={{
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    pt: 3,
                    px: 3,
                    pb: 1,
                    borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    bgcolor: isDarkMode ? "#1B212C" : "#F4F3F1", // Light Mode Header BG
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                            p: 1,
                            borderRadius: '50%',
                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : '#E0F2FE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <UploadCloud size={20} color={isDarkMode ? "#60A5FA" : "#0B4DA6"} />
                        </Box>
                        <Typography variant="h6" fontWeight={600} sx={{ fontSize: '1.125rem', color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                            Upload Document
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={handleCloseUploadModal}>
                        <Trash2 size={18} color="#9CA3AF" />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF" }}>
                    <Stack spacing={3}>
                        {/* Drop Zone */}
                        <Box
                            sx={{
                                position: 'relative',
                                border: '2px dashed',
                                borderColor: formErrors.file ? 'error.main' : (isDarkMode ? '#374151' : '#E5E7EB'),
                                borderRadius: 4,
                                p: 4,
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F9FAFB',
                                '&:hover': {
                                    borderColor: '#F97316', // Orange hover
                                    bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.05)' : '#FFF7ED'
                                }
                            }}
                        >
                            <input
                                type="file"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer',
                                    zIndex: 10
                                }}
                                onChange={handleFileChange}
                                accept={DOCUMENT_UPLOAD_ACCEPT}
                            />
                            {formData.file && formData.file.type === "application/pdf" ? (
                                <Box sx={{ mt: 1, mb: 2, height: 180, width: '100%', overflow: 'hidden', borderRadius: 2, border: '1px solid #e5e7eb', zIndex: 1, position: 'relative' }}>
                                    <iframe
                                        src={URL.createObjectURL(formData.file)}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 'none', pointerEvents: 'none' }}
                                        title="PDF Preview"
                                    />
                                </Box>
                            ) : formData.file && formData.file.type.startsWith("image/") ? (
                                <Box sx={{ mt: 1, mb: 2, height: 180, width: '100%', display: 'flex', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
                                    <img src={URL.createObjectURL(formData.file)} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                                </Box>
                            ) : (
                                <Box sx={{ color: 'text.secondary', mb: 1.5, display: 'flex', justifyContent: 'center' }}>
                                    <FileUploadOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.7 }} />
                                </Box>
                            )}

                            <Typography variant="subtitle2" fontWeight={500} gutterBottom sx={{ position: 'relative', zIndex: 1 }}>
                                {formData.file ? formData.file.name : "Drop files here or click to upload"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ position: 'relative', zIndex: 1 }}>
                                {formData.file
                                    ? `${(formData.file.size / 1024 / 1024).toFixed(2)} MB · ${documentTypeFromFile(formData.file)}`
                                    : `PDF, Word, Excel, PowerPoint, PNG, JPEG, and more (up to ${MAX_DOCUMENT_MB} MB; over ${CLOUDINARY_MAX_MB} MB stored on server)`}
                            </Typography>
                            {formErrors.file && (
                                <Typography variant="caption" color="error" display="block" sx={{ mt: 1, position: 'relative', zIndex: 1 }}>
                                    {formErrors.file}
                                </Typography>
                            )}
                        </Box>

                        {/* Form Fields */}
                        <Stack spacing={2.5}>
                            <Box>
                                <InputLabel sx={{ mb: 0.5, fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#D1D5DB' : '#374151', ml: 1 }}>Document Title</InputLabel>
                                <TextField
                                    placeholder="Enter document title"
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    error={!!formErrors.title}
                                    helperText={formErrors.title}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 50,
                                            bgcolor: isDarkMode ? "#1F2937" : "#F3F4F6",
                                            "& fieldset": { border: 'none' },
                                            "&.Mui-focused fieldset": { border: '1px solid #F97316' }, // Orange focus
                                            pl: 2
                                        }
                                    }}
                                />
                            </Box>


                            <Box sx={{ width: '100%' }}>
                                <InputLabel sx={{ mb: 0.5, fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#D1D5DB' : '#374151', ml: 1 }}>Valid Until</InputLabel>
                                <TextField
                                    type="date"
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    value={formData.validUntil}
                                    onChange={(e) => handleInputChange('validUntil', e.target.value)}
                                    error={!!formErrors.validUntil}
                                    helperText={
                                        formErrors.validUntil ||
                                        "The file is removed automatically after this date (including from Cloudinary)."
                                    }
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 50,
                                            bgcolor: isDarkMode ? "#1F2937" : "#F3F4F6",
                                            "& fieldset": { border: 'none' },
                                            "&.Mui-focused fieldset": { border: '1px solid #F97316' },
                                            pl: 2
                                        }
                                    }}
                                />
                            </Box>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4, pt: 1, justifyContent: 'flex-end', gap: 1 }}>
                    <Button
                        onClick={handleCloseUploadModal}
                        variant="text"
                        sx={{
                            color: isDarkMode ? '#9CA3AF' : '#6B7281',
                            textTransform: 'none',
                            fontWeight: 600,
                            mr: 1
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleUpload}
                        startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <UploadCloud size={18} />}
                        disabled={isUploading}
                        disableElevation
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            bgcolor: '#F97316', // Orange 500
                            borderRadius: 50,
                            px: 4,
                            py: 1,
                            '&:hover': { bgcolor: '#EA580C' }
                        }}
                    >
                        {isUploading ? "Uploading..." : "Upload Document"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={openMenu}
                onClose={handleMenuClose}
                PaperProps={{
                    elevation: 1,
                    sx: {
                        borderRadius: 2,
                        minWidth: 150,
                        border: '1px solid #E5E7EB',
                        marginTop: 1
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleView} sx={{ gap: 1.5, py: 1.5 }}>
                    <Eye size={18} color="#6B7280" />
                    <ListItemText primary="View" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                </MenuItem>
                {selectedModule?.title !== "Induction" && (
                    <MenuItem onClick={handleDownload} disabled={downloadInProgress} sx={{ gap: 1.5, py: 1.5 }}>
                        <Download size={18} color="#6B7280" />
                        <ListItemText primary="Download as PDF" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </MenuItem>
                )}
                {selectedModule?.title !== "Induction" && menuDoc?.isFormBase && !['Tool Box Talk Register', 'RAMS Briefing Form', 'Site Induction Register', 'Management Site Inspection Report', 'Daily Safe Start Briefing Sheet', 'Audit Action Form', 'Site Induction Form', 'LOLER Inspection Form', 'PUWER Inspection Form', 'Adstone Site Induction Form'].includes(getSitepackFormTemplateTitle(menuDoc)) && (
                    <MenuItem onClick={handleDownloadWord} sx={{ gap: 1.5, py: 1.5 }}>
                        <FileText size={18} color="#6B7280" />
                        <ListItemText primary="Download as Word" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </MenuItem>
                )}
                <MenuItem onClick={handleDeleteClick} sx={{ gap: 1.5, py: 1.5, color: '#EF4444' }}>
                    <Trash2 size={18} color="currentColor" />
                    <ListItemText primary="Delete" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        padding: 2,
                        minWidth: 320,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: '1.25rem' }}>
                    Delete Document?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        Are you sure you want to delete <b>{menuDoc?.title}</b>? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ borderTop: isDarkMode ? "1px solid #374151" : "none", pt: 2 }}>
                    <Button
                        onClick={() => setDeleteModalOpen(false)}
                        variant="outlined"
                        sx={{
                            textTransform: 'none',
                            color: isDarkMode ? "#9CA3AF" : 'text.primary',
                            borderColor: isDarkMode ? "#374151" : 'divider',
                            borderRadius: 50,
                            px: 3
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        variant="contained"
                        color="error"
                        disableElevation
                        sx={{
                            textTransform: 'none',
                            borderRadius: 50,
                            px: 3,
                            bgcolor: "#EF4444"
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Document Modal */}
            <Dialog
                open={viewModalOpen}
                onClose={handleCloseViewModal}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '85vh',
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        borderRadius: 3,
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
                    p: 2,
                    px: 3
                }}>
                    <Typography variant="h6" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {viewDocTitle || "Document Viewer"}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {viewDocSourceUrl && (
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={downloadInProgress}
                                startIcon={downloadInProgress ? <CircularProgress size={14} /> : <Download size={16} />}
                                onClick={() => viewDocRecord && runDocumentDownload(viewDocRecord)}
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                Download
                            </Button>
                        )}
                        <IconButton size="small" onClick={handleCloseViewModal}>
                            <X size={20} color={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: isDarkMode ? "#111827" : "#F3F4F6", display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {viewLoading && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <CircularProgress />
                            <Typography variant="body2" color="text.secondary">Loading preview…</Typography>
                        </Box>
                    )}

                    {!viewLoading && viewError && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3, textAlign: 'center' }}>
                            <AlertTriangle size={48} color={isDarkMode ? "#F59E0B" : "#D97706"} style={{ marginBottom: 16 }} />
                            <Typography variant="h6" gutterBottom color={isDarkMode ? "#F9FAFB" : "#111827"}>Could not preview</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420 }}>
                                {viewError}
                            </Typography>
                            {viewDocRecord && (
                                <Button
                                    variant="contained"
                                    disabled={downloadInProgress}
                                    onClick={() => runDocumentDownload(viewDocRecord)}
                                    startIcon={downloadInProgress ? <CircularProgress size={18} color="inherit" /> : <Download size={18} />}
                                    sx={{ textTransform: 'none', borderRadius: 2 }}
                                >
                                    Download File
                                </Button>
                            )}
                        </Box>
                    )}

                    {!viewLoading && !viewError && viewDocType === 'PDF' && viewDocUrl && (
                        <Box sx={{ width: '100%', height: '100%' }}>
                            <iframe
                                src={viewDocUrl}
                                title={viewDocTitle || "PDF"}
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                            />
                        </Box>
                    )}

                    {!viewLoading && !viewError && OFFICE_PREVIEW_TYPES.includes(viewDocType) && viewDocUrl && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <iframe
                                src={viewDocUrl}
                                title={viewDocTitle || "Document preview"}
                                width="100%"
                                height="100%"
                                style={{ border: 'none', flex: 1 }}
                            />
                        </Box>
                    )}

                    {!viewLoading && !viewError && ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF', 'BMP'].includes(viewDocType) && viewDocUrl && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                            <img
                                src={viewDocUrl}
                                alt="Document"
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                onError={() => setViewError("Image could not be loaded. Try downloading the file.")}
                            />
                        </Box>
                    )}

                    {!viewLoading && !viewError && ['MP4', 'MOV', 'WEBM'].includes(viewDocType) && viewDocUrl && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                            <video src={viewDocUrl} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        </Box>
                    )}

                    {!viewLoading && !viewError && viewDocType === 'TXT' && viewDocUrl && (
                        <Box sx={{ width: '100%', height: '100%', p: 3, overflow: 'auto' }}>
                            <iframe
                                src={viewDocUrl}
                                title={viewDocTitle || "Text file"}
                                width="100%"
                                height="100%"
                                style={{ border: 'none', background: isDarkMode ? '#1F2937' : '#FFFFFF' }}
                            />
                        </Box>
                    )}

                    {!viewLoading && !viewError && !['PDF', ...OFFICE_PREVIEW_TYPES, 'JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF', 'BMP', 'MP4', 'MOV', 'WEBM', 'TXT'].includes(viewDocType) && (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                            <FileText size={48} color={isDarkMode ? "#9CA3AF" : "#6B7280"} style={{ marginBottom: 16 }} />
                            <Typography variant="h6" gutterBottom color={isDarkMode ? "#F9FAFB" : "#111827"}>Preview not available</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                This file type ({viewDocType}) cannot be previewed in the browser. Download it to open locally.
                            </Typography>
                            {viewDocRecord && (
                                <Button
                                    variant="contained"
                                    disabled={downloadInProgress}
                                    onClick={() => runDocumentDownload(viewDocRecord)}
                                    startIcon={downloadInProgress ? <CircularProgress size={18} color="inherit" /> : <Download size={18} />}
                                    sx={{ textTransform: 'none', borderRadius: 2 }}
                                >
                                    Download File
                                </Button>
                            )}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
            {/* Create Form Modal */}
            <Dialog
                open={createFormModalOpen}
                onClose={() => setCreateFormModalOpen(false)}
                maxWidth="md"
                fullWidth
                scroll="paper"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        overflow: "hidden",
                        maxHeight: "min(90vh, 880px)",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        boxShadow: isDarkMode
                            ? "0 25px 50px -12px rgba(0,0,0,0.6)"
                            : "0 25px 50px -12px rgba(0,0,0,0.18)",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        m: 0,
                        p: 0,
                        bgcolor: FRIDAY_PACK_ACCENT,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 2,
                            px: 3,
                            py: 2.5,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
                            <Box
                                sx={{
                                    mt: 0.25,
                                    p: 1,
                                    borderRadius: 2,
                                    bgcolor: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    flexShrink: 0,
                                }}
                            >
                                <ClipboardList size={22} color="#FFFFFF" strokeWidth={2} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="h6"
                                    fontWeight={700}
                                    sx={{ color: "#FFFFFF", lineHeight: 1.3, fontSize: "1.125rem" }}
                                >
                                    Select a Form Template
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: "rgba(255,255,255,0.88)", mt: 0.5, lineHeight: 1.45 }}
                                >
                                    Start from a saved version or pick a blank template for this site&apos;s Friday pack.
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={() => setCreateFormModalOpen(false)}
                            sx={{
                                flexShrink: 0,
                                color: "#FFFFFF",
                                bgcolor: "rgba(255,255,255,0.15)",
                                "&:hover": { bgcolor: "rgba(255,255,255,0.28)" },
                            }}
                        >
                            <X size={18} />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent
                    sx={{
                        p: 0,
                        bgcolor: isDarkMode ? "#111827" : "#F9FAFB",
                        overflowY: "auto",
                    }}
                >
                    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
                        {/* Saved general forms */}
                        <Box sx={{ mb: 3 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant="overline"
                                    sx={{
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        color: FRIDAY_PACK_ACCENT,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Saved general forms
                                </Typography>
                                {!createFormModalLoading && (
                                    <Chip
                                        size="small"
                                        label={savedGeneralSubmissions.length}
                                        sx={{
                                            height: 22,
                                            fontWeight: 600,
                                            bgcolor: isDarkMode ? "rgba(232,159,23,0.15)" : "rgba(232,159,23,0.12)",
                                            color: FRIDAY_PACK_ACCENT,
                                        }}
                                    />
                                )}
                            </Box>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 2, maxWidth: 520, lineHeight: 1.5 }}
                            >
                                Forms saved from General Forms. Select one to pre-fill this Friday pack submission.
                            </Typography>

                            {createFormModalLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <CircularProgress size={32} sx={{ color: FRIDAY_PACK_ACCENT }} />
                                </Box>
                            ) : savedGeneralSubmissions.length === 0 ? (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        py: 2.5,
                                        px: 2.5,
                                        borderRadius: 2,
                                        textAlign: "center",
                                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                                        border: "1px dashed",
                                        borderColor: isDarkMode ? "#4B5563" : "#D1D5DB",
                                    }}
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        No saved forms yet. Edit a template in General Forms and save it to see it here.
                                    </Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={2}>
                                    {savedGeneralSubmissions.map((sub) => {
                                        const primary =
                                            sub.name ||
                                            sub.answers?.name ||
                                            sub.form?.title ||
                                            "Untitled";
                                        const secondary =
                                            sub.form?.title && primary !== sub.form.title
                                                ? sub.form.title
                                                : null;
                                        const rid = sub.id || sub._id;
                                        const savedLabel = `Saved ${new Date(sub.createdAt).toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}`;
                                        return (
                                            <Grid item xs={12} sm={6} key={rid}>
                                                <FormPickerCard
                                                    isDarkMode={isDarkMode}
                                                    title={primary}
                                                    description={secondary}
                                                    meta={savedLabel}
                                                    onSelect={() => handleSelectSavedGeneralSubmission(sub)}
                                                    onPreview={() => handlePreviewSavedGeneralSubmission(sub)}
                                                />
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            )}
                        </Box>

                        <Divider sx={{ mb: 3, borderColor: isDarkMode ? "#374151" : "#E5E7EB" }} />

                        {/* Blank templates */}
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant="overline"
                                    sx={{
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Blank templates
                                </Typography>
                                <Chip
                                    size="small"
                                    label={TEMPLATES.length}
                                    sx={{
                                        height: 22,
                                        fontWeight: 600,
                                        bgcolor: isDarkMode ? "#374151" : "#E5E7EB",
                                        color: isDarkMode ? "#D1D5DB" : "#4B5563",
                                    }}
                                />
                            </Box>
                            <Grid container spacing={2}>
                                {TEMPLATES.map((template) => (
                                    <Grid item xs={12} sm={6} key={template.id}>
                                        <FormPickerCard
                                            isDarkMode={isDarkMode}
                                            title={template.title}
                                            description={template.description}
                                            onSelect={() => handleSelectForm(template.path, false)}
                                            onPreview={() => handlePreviewForm(template.path, false)}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Graph Analytics Modal */}
            <Dialog 
                open={graphModalOpen} 
                onClose={() => setGraphModalOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3, bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <BarChartIcon sx={{ color: "hsl(38, 70%, 55%)" }} />
                        <Typography variant="h6" fontWeight={700} color={isDarkMode ? "#F9FAFB" : "#111827"}>
                            {selectedSite?.name} - Document Statistics
                        </Typography>
                    </Box>
                    <IconButton onClick={() => setGraphModalOpen(false)} size="small">
                        <X size={20} color={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 4, bgcolor: isDarkMode ? "#111827" : "#F9FAFB" }}>
                    {chartData.length === 0 ? (
                        <Box sx={{ p: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Typography variant="h6" color="text.secondary">No documents available to display.</Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={4}>
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ p: 4, borderRadius: 3, bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB', height: 400, display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="subtitle1" fontWeight={600} mb={2} color={isDarkMode ? "#F9FAFB" : "#111827"}>Category Distribution</Typography>
                                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={chartData} 
                                                    dataKey="value" 
                                                    nameKey="name" 
                                                    cx="50%" 
                                                    cy="50%" 
                                                    outerRadius="90%" 
                                                    innerRadius="65%"
                                                    paddingAngle={2}
                                                >
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ borderRadius: 8, backgroundColor: isDarkMode ? "#374151" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "#111827", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" }} />
                                                <Legend verticalAlign="bottom" height={40} wrapperStyle={{ paddingTop: "10px", fontSize: 13, color: isDarkMode ? "#F9FAFB" : "#111827" }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ p: 4, borderRadius: 3, bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB', height: 400, display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="subtitle1" fontWeight={600} mb={2} color={isDarkMode ? "#F9FAFB" : "#111827"}>Total Documents by Category</Typography>
                                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: isDarkMode ? "#9CA3AF" : "#6B7280" }} tickLine={false} axisLine={false} angle={-15} textAnchor="end" />
                                                <YAxis tick={{ fontSize: 12, fill: isDarkMode ? "#9CA3AF" : "#6B7280" }} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <RechartsTooltip cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} contentStyle={{ borderRadius: 8, backgroundColor: isDarkMode ? "#374151" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "#111827", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" }} />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
            </Dialog>

            {/* Form Preview Modal */}
            <Dialog
                open={previewModalOpen}
                onClose={() => setPreviewModalOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { height: '85vh', borderRadius: 3, bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB' }}>
                    <Typography variant="h6" fontWeight={600} color={isDarkMode ? "#F9FAFB" : "#111827"}>Form Preview</Typography>
                    <IconButton size="small" onClick={() => setPreviewModalOpen(false)}>
                        <X size={20} color={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
                    {previewUrl && (
                        <iframe
                            src={previewUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            title="Form Preview"
                        />
                    )}
                </DialogContent>
            </Dialog>

        </Layout>
    );
}
