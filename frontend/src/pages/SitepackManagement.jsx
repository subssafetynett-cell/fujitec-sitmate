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
    ListItemText,
    Collapse,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Tab,
} from "@mui/material";

import { 
    Building2, ClipboardList, FileText, DraftingCompass, BookOpen, 
    Award, ShieldCheck, UploadCloud, Eye, Download, Trash2, X,
    AlertTriangle, UserCheck, Folder, ChevronDown, ChevronUp, Pencil
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
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined'; // Audit

import Layout from '../components/Layout';
import TablePageSkeleton from '../components/TablePageSkeleton';
import api, {
  fetchSites,
  uploadDocument,
  fetchDocuments,
  fetchDocumentCounts,
  fetchAllFormResponsesList,
  fetchSiteSubfolders,
  createSiteSubfolder,
  updateSiteSubfolder,
  deleteSiteSubfolder,
  deleteDocument,
  fetchDocumentPreviewBlob,
  formatUploadError,
} from "../services/api";
import { matchesSitepackScope, sitepackSearchParams, normalizeSitepackId, createUnfiledSubfolder, isUnfiledSubfolder, isAllFormsSubfolder, ALL_SITEPACK_FORMS_ID } from "../utils/sitepackContext";
import {
    FRIDAY_PACK_FORMS_CATEGORY,
    belongsInSitepackCategory,
    fridayPackFormListFetchParams,
    includeFridayPackListRow,
    isFridayPackSiteSubmission,
} from "../utils/generalFormSubmissions";
import {
    SITEPACK_FORM_GROUPS,
    SITEPACK_REPORT_MODULES,
    getSitepackReportRoute,
    isSitepackReportModule,
    reportModulesForGroup,
} from "../constants/sitepackFormCatalog";
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
    shouldFetchPreviewViaApi,
    createTypedBlob,
    readBlobApiError,
    parseAxiosErrorMessage,
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
    },
    {
        id: "alimak-weekly-check",
        title: "Alimak Weekly Check",
        description: "Weekly hoist safety inspection checklist",
        path: "/general-forms/alimak-weekly-check",
    }
];

const FRIDAY_PACK_ACCENT = "#E89F17";

const CREATE_FORM_TAB_SAVED = "saved";
const CREATE_FORM_TAB_TEMPLATES = "templates";
const CREATE_FORM_TAB_BUILDER = "builder";

/** Template card for the Friday Pack “Create form” picker modal. */
function FormPickerCard({ title, description, meta, onUse, onPreview, isDarkMode }) {
    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 2.5,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
            }}
        >
            <CardContent
                sx={{
                    p: 2,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    "&:last-child": { pb: 2 },
                }}
            >
                <Box sx={{ display: "flex", gap: 1.5, flex: 1 }}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: 1.5,
                            bgcolor: "rgba(232, 159, 23, 0.12)",
                            color: FRIDAY_PACK_ACCENT,
                            display: "flex",
                            flexShrink: 0,
                            alignSelf: "flex-start",
                        }}
                    >
                        <FileText size={18} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ lineHeight: 1.35, color: isDarkMode ? "#F9FAFB" : "#111827" }}
                        >
                            {title}
                        </Typography>
                        {description ? (
                            <Typography
                                variant="body2"
                                sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", mt: 0.5, lineHeight: 1.45 }}
                            >
                                {description}
                            </Typography>
                        ) : null}
                        {meta ? (
                            <Typography variant="caption" sx={{ color: isDarkMode ? "#6B7280" : "#9CA3AF", display: "block", mt: 0.5 }}>
                                {meta}
                            </Typography>
                        ) : null}
                    </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1, mt: "auto", pt: 0.5 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Eye size={16} />}
                        onClick={onPreview}
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            borderColor: isDarkMode ? "#4B5563" : "#E5E7EB",
                            color: isDarkMode ? "#E5E7EB" : "#374151",
                        }}
                    >
                        Preview
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={onUse}
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            bgcolor: FRIDAY_PACK_ACCENT,
                            boxShadow: "none",
                            "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
                        }}
                    >
                        Use
                    </Button>
                </Box>
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
        "LOLER Inspection Form": `/general-forms/loler-inspection-form/${responseId}`,
        "PUWER Inspection Form": `/general-forms/puwer-inspection-form/${responseId}`,
        "Alimak Weekly Check": `/general-forms/alimak-weekly-check/${responseId}`,
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

function getSitepackReportFormPath(menuDoc, responseId, sitepackQuery) {
    const category = menuDoc?.rawResponse?.category;
    const route = getSitepackReportRoute(category);
    if (!route) return null;
    return pathWithSearchParams(route, {
        ...sitepackQuery,
        category,
        responseId,
    });
}

const SITEPACK_STANDARD_FORM_TITLES = [
    "Tool Box Talk Register",
    "RAMS Briefing Form",
    "Site Induction Register",
    "Management Site Inspection Report",
    "Daily Safe Start Briefing Sheet",
    "Audit Action Form",
    "Site Induction Form",
    "LOLER Inspection Form",
    "PUWER Inspection Form",
    "Alimak Weekly Check",
];

function canSitepackFormDownloadWord(doc) {
    if (!doc?.isFormBase) return false;
    return !SITEPACK_STANDARD_FORM_TITLES.includes(getSitepackFormTemplateTitle(doc));
}

function formatSitepackFormDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function SitepackManagement() {
    const { isDarkMode } = useTheme();
    const { role, currentUser } = useAuth();
    const currentUserId = currentUser?.id || currentUser?._id;

    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const search = searchParams.get("search") || "";
    const [selectedSite, setSelectedSite] = useState(null);
    const [selectedSubfolder, setSelectedSubfolder] = useState(null);
    const [selectedModule, setSelectedModule] = useState(null);
    const [subfolders, setSubfolders] = useState([]);
    const [subfoldersLoading, setSubfoldersLoading] = useState(false);
    const [moduleItemsLoading, setModuleItemsLoading] = useState(false);
    const [subfolderItemCounts, setSubfolderItemCounts] = useState({});
    const [showUnfiledSubfolder, setShowUnfiledSubfolder] = useState(false);
    const [totalCategoryItemCount, setTotalCategoryItemCount] = useState(0);
    const [createSubfolderOpen, setCreateSubfolderOpen] = useState(false);
    const [newSubfolderName, setNewSubfolderName] = useState("");
    const [subfolderError, setSubfolderError] = useState("");
    const [creatingSubfolder, setCreatingSubfolder] = useState(false);
    const [editSubfolderOpen, setEditSubfolderOpen] = useState(false);
    const [editingSubfolder, setEditingSubfolder] = useState(null);
    const [savingSubfolder, setSavingSubfolder] = useState(false);
    const [deleteSubfolderOpen, setDeleteSubfolderOpen] = useState(false);
    const [subfolderToDelete, setSubfolderToDelete] = useState(null);
    const [deletingSubfolder, setDeletingSubfolder] = useState(false);
    const [modules, setModules] = useState(
        MODULES_CONFIG_DEFAULT.map((m) => ({ ...m, count: "0 documents", id: m.title }))
    );
    const [reportCounts, setReportCounts] = useState(
        () => Object.fromEntries(SITEPACK_REPORT_MODULES.map((m) => [m.title, "0 documents"]))
    );
    const [openFormGroup, setOpenFormGroup] = useState("report-concern");
    const location = useLocation();

    const getSiteId = () => selectedSite?._id || selectedSite?.id;
    const getSubfolderId = () =>
        isUnfiledSubfolder(selectedSubfolder) || isAllFormsSubfolder(selectedSubfolder)
            ? null
            : selectedSubfolder?.id;
    const sitepackParams = (extra = {}) =>
        sitepackSearchParams({
            siteId: getSiteId(),
            subfolderId: selectedSubfolder?.id,
            category: selectedModule?.title,
            extra: {
                ...(selectedSubfolder?.name &&
                !isUnfiledSubfolder(selectedSubfolder) &&
                !isAllFormsSubfolder(selectedSubfolder)
                    ? { subfolderName: selectedSubfolder.name }
                    : {}),
                ...extra,
            },
        });

    const getKnownSubfolderIds = () =>
        subfolders.map((sf) => sf.id).filter(Boolean);

    const includeSitepackFormRow = (row, moduleTitle) => {
        if (!belongsInSitepackCategory(row, moduleTitle)) return false;
        if (moduleTitle === FRIDAY_PACK_FORMS_CATEGORY) {
            return includeFridayPackListRow(row);
        }
        return true;
    };

    const sitepackFormFetchParams = (moduleTitle, siteId) =>
        moduleTitle === FRIDAY_PACK_FORMS_CATEGORY
            ? fridayPackFormListFetchParams(siteId)
            : { category: moduleTitle, siteId };

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
                if (location.state.subfolderId) {
                    const sfid = location.state.subfolderId;
                    const fromList = subfolders.find((sf) => sf.id === sfid);
                    setSelectedSubfolder(
                        fromList || {
                            id: sfid,
                            name: location.state.subfolderName || "Subfolder",
                        }
                    );
                }
                window.history.replaceState({}, document.title);
            }
        }
    }, [sites, location.state, modules, subfolders]);

    // Document State
    const [docs, setDocs] = useState([]);

    // UI State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [createFormModalOpen, setCreateFormModalOpen] = useState(false);
    const [createFormPickerTab, setCreateFormPickerTab] = useState(CREATE_FORM_TAB_TEMPLATES);
    const [createFormSearch, setCreateFormSearch] = useState("");
    const [savedGeneralSubmissions, setSavedGeneralSubmissions] = useState([]);
    const [builderForms, setBuilderForms] = useState([]);
    const [createFormModalLoading, setCreateFormModalLoading] = useState(false);
    const [graphModalOpen, setGraphModalOpen] = useState(false);
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

    // Load subfolders when a site category is selected
    useEffect(() => {
        if (!selectedSite || !selectedModule) {
            setSubfolders([]);
            return;
        }
        const loadSubfolders = async () => {
            setSubfoldersLoading(true);
            try {
                const { subfolders: list } = await fetchSiteSubfolders(getSiteId(), {
                    scope: "sitepack",
                });
                setSubfolders(list || []);
                if (location.state?.subfolderId && !selectedSubfolder?.name) {
                    const match = (list || []).find((sf) => sf.id === location.state.subfolderId);
                    if (match) setSelectedSubfolder(match);
                } else if (
                    selectedSubfolder?.id &&
                    !isUnfiledSubfolder(selectedSubfolder) &&
                    !isAllFormsSubfolder(selectedSubfolder)
                ) {
                    const match = (list || []).find((sf) => sf.id === selectedSubfolder.id);
                    if (match) setSelectedSubfolder(match);
                }
            } catch (error) {
                console.error("Error loading subfolders:", error);
            } finally {
                setSubfoldersLoading(false);
            }
        };
        loadSubfolders();
    }, [selectedSite, selectedModule]);

    // Per-subfolder item counts when picking a subfolder inside a category
    useEffect(() => {
        if (!selectedSite || !selectedModule || selectedSubfolder || !currentUserId) {
            setSubfolderItemCounts({});
            setShowUnfiledSubfolder(false);
            setTotalCategoryItemCount(0);
            return;
        }

        let cancelled = false;
        const loadSubfolderCounts = async () => {
            const siteId = getSiteId();
            const moduleTitle = selectedModule.title;
            const knownSubfolderIds = getKnownSubfolderIds();
            try {
                const [formsRes, docsRes] = await Promise.all([
                    fetchAllFormResponsesList(sitepackFormFetchParams(moduleTitle, siteId)),
                    fetchDocuments(siteId, moduleTitle),
                ]);
                if (cancelled) return;

                const counts = {};
                let unfiled = 0;
                let total = 0;
                const bump = (subfolderId) => {
                    const sfid = normalizeSitepackId(subfolderId);
                    if (sfid && knownSubfolderIds.includes(sfid)) {
                        counts[sfid] = (counts[sfid] || 0) + 1;
                    } else {
                        unfiled += 1;
                    }
                    total += 1;
                };

                (formsRes?.data || []).forEach((row) => {
                    if (!matchesSitepackScope(row, { siteId, knownSubfolderIds })) return;
                    if (!includeSitepackFormRow(row, moduleTitle)) return;
                    bump(row.answers?.subfolderId ?? row.subfolderId);
                });
                (docsRes?.documents || []).forEach((doc) => bump(doc.subfolderId));

                setSubfolderItemCounts(counts);
                setShowUnfiledSubfolder(unfiled > 0);
                setTotalCategoryItemCount(total);
            } catch (error) {
                console.error("Error loading subfolder counts:", error);
            }
        };
        loadSubfolderCounts();
        return () => {
            cancelled = true;
        };
    }, [selectedSite, selectedModule, selectedSubfolder, location.key, currentUserId, subfolders]);

    // Load module counts when viewing categories for a site
    useEffect(() => {
        if (selectedSite && !selectedModule && currentUserId) {
            const loadCounts = async () => {
                try {
                    const siteId = getSiteId();
                    const { counts } = await fetchDocumentCounts(siteId);

                    let formCountsByCategory = {};
                    try {
                        const res = await fetchAllFormResponsesList({ siteId });
                        if (res?.success) {
                            const siteResponses = (res.data || []).filter((r) =>
                                matchesSitepackScope(r, { siteId })
                            );

                            siteResponses.forEach((r) => {
                                if (!isFridayPackSiteSubmission(r)) {
                                    const cat = r.category || "General";
                                    formCountsByCategory[cat] = (formCountsByCategory[cat] || 0) + 1;
                                    return;
                                }
                                formCountsByCategory[FRIDAY_PACK_FORMS_CATEGORY] =
                                    (formCountsByCategory[FRIDAY_PACK_FORMS_CATEGORY] || 0) + 1;
                            });
                        }
                    } catch (e) {
                        console.error("Failed to load form counts", e);
                    }

                    setModules(prev => prev.map(m => {
                        const docTotal = counts[m.title] || 0;
                        const formTotal = formCountsByCategory[m.title] || 0;

                        return {
                            ...m,
                            count: `${docTotal + formTotal} documents`
                        };
                    }));

                    const nextReportCounts = {};
                    SITEPACK_REPORT_MODULES.forEach((mod) => {
                        const docTotal = counts[mod.title] || 0;
                        const formTotal = formCountsByCategory[mod.title] || 0;
                        nextReportCounts[mod.title] = `${docTotal + formTotal} documents`;
                    });
                    setReportCounts(nextReportCounts);
                } catch (error) {
                    console.error("Error loading counts:", error);
                }
            };
            loadCounts();
        }
    }, [selectedSite, selectedModule, location.key, currentUserId]);

    // Load documents when module + subfolder selected (location.key refreshes after saving a form).
    useEffect(() => {
        if (!selectedSite || !selectedSubfolder || !selectedModule || !currentUserId) {
            setDocs([]);
            return;
        }
        reloadModuleDocuments();
    }, [selectedSite, selectedSubfolder, selectedModule, location.key, currentUserId, subfolders]);

    const generalFormTitleToPath = useMemo(
        () => Object.fromEntries(TEMPLATES.map((t) => [t.title, t.path])),
        []
    );

    const filteredSavedTemplates = useMemo(() => {
        const q = createFormSearch.trim().toLowerCase();
        if (!q) return savedGeneralSubmissions;
        return savedGeneralSubmissions.filter((sub) => {
            const primary = (sub.name || sub.answers?.name || sub.form?.title || "").toLowerCase();
            const secondary = (sub.form?.title || "").toLowerCase();
            return primary.includes(q) || secondary.includes(q);
        });
    }, [savedGeneralSubmissions, createFormSearch]);

    const filteredBlankTemplates = useMemo(() => {
        const q = createFormSearch.trim().toLowerCase();
        if (!q) return TEMPLATES;
        return TEMPLATES.filter(
            (t) =>
                t.title.toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q)
        );
    }, [createFormSearch]);

    const filteredBuilderForms = useMemo(() => {
        const q = createFormSearch.trim().toLowerCase();
        if (!q) return builderForms;
        return builderForms.filter((form) => {
            const title = (form.title || "").toLowerCase();
            const desc = (form.description || "").toLowerCase();
            return title.includes(q) || desc.includes(q);
        });
    }, [builderForms, createFormSearch]);

    const closeCreateFormModal = () => {
        setCreateFormModalOpen(false);
        setCreateFormPickerTab(CREATE_FORM_TAB_TEMPLATES);
        setCreateFormSearch("");
    };

    // Load saved templates + form builder forms for the Create Form dialog
    useEffect(() => {
        if (!createFormModalOpen) return;
        let cancelled = false;
        const load = async () => {
            setCreateFormModalLoading(true);
            setSavedGeneralSubmissions([]);
            setBuilderForms([]);
            try {
                const [responsesRes, formsRes] = await Promise.all([
                    fetchAllFormResponsesList({ category: "General forms,__empty__" }),
                    api.get("/forms"),
                ]);
                if (cancelled) return;
                if (responsesRes?.success) {
                    const list = responsesRes.data || [];
                    const saved = list
                        .filter(isSavedGeneralFormTemplate)
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setSavedGeneralSubmissions(saved);
                }
                if (formsRes.data?.success) {
                    const userCreatedForms = (formsRes.data.data || []).filter(
                        (form) =>
                            !(
                                form.fields?.length === 1 &&
                                form.fields[0].id === "custom_hardcoded_form_data"
                            )
                    );
                    setBuilderForms(userCreatedForms);
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
    }, [createFormModalOpen]);

    // Handlers
    const handleSiteClick = (site) => {
        setSelectedSite(site);
        setSelectedSubfolder(null);
        setSelectedModule(null);
    };

    const handleBackToSites = () => {
        // Subfolder contents → module subfolder list
        if (selectedModule && selectedSubfolder) {
            setSelectedSubfolder(null);
            return;
        }
        // Module view (e.g. Friday Pack subfolders) → All Sites list
        if (selectedModule) {
            setSelectedModule(null);
            setSelectedSubfolder(null);
            setSelectedSite(null);
            return;
        }
        // Site categories → All Sites list
        setSelectedSite(null);
        setSelectedSubfolder(null);
    };

    const handleSubfolderClick = (subfolder) => {
        setSelectedSubfolder(subfolder);
    };

    const handleOpenCreateSubfolder = () => {
        setNewSubfolderName("");
        setSubfolderError("");
        setCreateSubfolderOpen(true);
    };

    const handleCloseCreateSubfolder = () => {
        if (creatingSubfolder) return;
        setCreateSubfolderOpen(false);
        setNewSubfolderName("");
        setSubfolderError("");
    };

    const handleCreateSubfolder = async () => {
        const name = newSubfolderName.trim();
        if (!name) {
            setSubfolderError("Folder name is required");
            return;
        }
        setCreatingSubfolder(true);
        setSubfolderError("");
        try {
            const { subfolder } = await createSiteSubfolder(getSiteId(), name);
            setSubfolders((prev) => [subfolder, ...prev]);
            setCreateSubfolderOpen(false);
            setNewSubfolderName("");
            setSelectedSubfolder(subfolder);
        } catch (error) {
            console.error("Failed to create subfolder", error);
            setSubfolderError(error.response?.data?.message || "Failed to create subfolder");
        } finally {
            setCreatingSubfolder(false);
        }
    };

    const handleOpenEditSubfolder = (event, subfolder) => {
        event.stopPropagation();
        setEditingSubfolder(subfolder);
        setNewSubfolderName(subfolder.name);
        setSubfolderError("");
        setEditSubfolderOpen(true);
    };

    const handleCloseEditSubfolder = () => {
        if (savingSubfolder) return;
        setEditSubfolderOpen(false);
        setEditingSubfolder(null);
        setNewSubfolderName("");
        setSubfolderError("");
    };

    const handleUpdateSubfolder = async () => {
        const name = newSubfolderName.trim();
        if (!name) {
            setSubfolderError("Folder name is required");
            return;
        }
        if (!editingSubfolder?.id) return;
        setSavingSubfolder(true);
        setSubfolderError("");
        try {
            const { subfolder } = await updateSiteSubfolder(getSiteId(), editingSubfolder.id, name);
            setSubfolders((prev) =>
                prev.map((sf) => (sf.id === subfolder.id ? subfolder : sf))
            );
            if (selectedSubfolder?.id === subfolder.id) {
                setSelectedSubfolder(subfolder);
            }
            handleCloseEditSubfolder();
        } catch (error) {
            console.error("Failed to update subfolder", error);
            setSubfolderError(error.response?.data?.message || "Failed to update folder");
        } finally {
            setSavingSubfolder(false);
        }
    };

    const handleOpenDeleteSubfolder = (event, subfolder) => {
        event.stopPropagation();
        setSubfolderToDelete(subfolder);
        setDeleteSubfolderOpen(true);
    };

    const handleCloseDeleteSubfolder = () => {
        if (deletingSubfolder) return;
        setDeleteSubfolderOpen(false);
        setSubfolderToDelete(null);
    };

    const confirmDeleteSubfolder = async () => {
        if (!subfolderToDelete?.id) return;
        setDeletingSubfolder(true);
        try {
            await deleteSiteSubfolder(getSiteId(), subfolderToDelete.id);
            setSubfolders((prev) => prev.filter((sf) => sf.id !== subfolderToDelete.id));
            if (selectedSubfolder?.id === subfolderToDelete.id) {
                setSelectedSubfolder(null);
            }
            handleCloseDeleteSubfolder();
        } catch (error) {
            console.error("Failed to delete subfolder", error);
            window.alert(error.response?.data?.message || "Failed to delete folder");
        } finally {
            setDeletingSubfolder(false);
        }
    };

    const handleModuleClick = (module) => {
        setSelectedModule(module);
        setSelectedSubfolder(null);
    };

    const handleReportModuleClick = (reportModule) => {
        setSelectedModule({
            title: reportModule.title,
            icon: <FileText size={32} />,
            count: reportCounts[reportModule.title] || "0 documents",
            isReport: true,
        });
    };

    const reloadModuleDocuments = async () => {
        if (!selectedSite || !selectedSubfolder || !selectedModule || !currentUserId) return;
        setModuleItemsLoading(true);
        const siteId = getSiteId();
        const subfolderId = getSubfolderId();
        const moduleTitle = selectedModule.title;
        const allFormsView = isAllFormsSubfolder(selectedSubfolder);
        const unfiledView = isUnfiledSubfolder(selectedSubfolder);
        const knownSubfolderIds = getKnownSubfolderIds();
        let allItems = [];

        try {
            const formsParams = sitepackFormFetchParams(moduleTitle, siteId);

            const [docsRes, formsRes] = await Promise.allSettled([
                fetchDocuments(
                    siteId,
                    moduleTitle,
                    allFormsView || unfiledView ? undefined : subfolderId
                ),
                fetchAllFormResponsesList(formsParams),
            ]);

            const documents = docsRes.status === "fulfilled" ? docsRes.value?.documents : [];
            const scopedDocs = (documents || []).filter((doc) => {
                const docSubfolderId = normalizeSitepackId(doc.subfolderId);
                if (allFormsView) return true;
                if (unfiledView) return !docSubfolderId;
                return docSubfolderId === subfolderId;
            });
            allItems = [...allItems, ...scopedDocs];
            if (docsRes.status === "rejected") {
                console.error("Failed to fetch documents for module", docsRes.reason);
            }

            const res = formsRes.status === "fulfilled" ? formsRes.value : null;
            if (res?.success) {
                const scopeSubfolderId = allFormsView
                    ? ALL_SITEPACK_FORMS_ID
                    : unfiledView
                      ? selectedSubfolder.id
                      : subfolderId;
                const siteResponses = (res.data || []).filter((r) => {
                    if (!includeSitepackFormRow(r, moduleTitle)) return false;
                    return matchesSitepackScope(r, {
                        siteId,
                        subfolderId: scopeSubfolderId,
                        unfiledOnly: unfiledView,
                        allFormsOnly: allFormsView,
                        knownSubfolderIds,
                    });
                });
                const mappedForms = siteResponses.map((r) => {
                    const customName = r.name || r.answers?.name || r.answers?.formMetadata?.name || r.answers?.report_heading;
                    const templateTitle = r.form?.title || r.title || r.category || "Form Response";
                    const title = customName || templateTitle;

                    let rawTags = r.tags || r.answers?.tags || r.answers?.formMetadata?.tags || [];
                    let tags = [];
                    if (typeof rawTags === "string" && rawTags.trim().length > 0) {
                        tags = rawTags.split(",").map((t) => t.trim());
                    } else if (Array.isArray(rawTags)) {
                        tags = rawTags.filter(Boolean);
                    }

                    return {
                        id: r.id || r._id,
                        title,
                        templateTitle: customName ? templateTitle : null,
                        type: "FORM",
                        version: "1.0",
                        size: customName ? templateTitle : "Digital Form",
                        tags,
                        createdAt: r.createdAt,
                        isFormBase: true,
                        rawResponse: { ...r, formId: r.formId || r.form?.id },
                    };
                });
                allItems = [...allItems, ...mappedForms];
            }
            if (formsRes.status === "rejected") {
                console.error("Failed to fetch form responses for module", formsRes.reason);
            }

            allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setDocs(allItems);
        } finally {
            setModuleItemsLoading(false);
        }
    };

    const handleNewReport = () => {
        const route = getSitepackReportRoute(selectedModule?.title);
        if (!route) return;
        navigate(pathWithSearchParams(route, sitepackParams({
            category: selectedModule.title,
            create: "true",
        })));
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
            uploadData.append('siteId', getSiteId());
            uploadData.append('subfolderId', getSubfolderId());
            uploadData.append('category', selectedModule.title);

            const uploadResult = await uploadDocument(uploadData);
            handleCloseUploadModal();
            if (uploadResult?.offlineQueued) {
                // Upload is queued; document list will refresh after sync.
            } else {
                await reloadModuleDocuments();
            }
        } catch (error) {
            console.error("Upload failed", error);
            setFormErrors((prev) => ({ ...prev, file: formatUploadError(error) }));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSelectForm = (formPath, isCustom = false, customFormId = null) => {
        const params = sitepackParams({ category: "Friday Pack Forms" });
        const qs = new URLSearchParams(params).toString();

        closeCreateFormModal();
        if (isCustom) {
            navigate(`/forms/${customFormId}/use?${qs}`);
        } else {
            navigate(`${formPath}?${qs}`);
        }
    };

    const handlePreviewForm = (formPath, isCustom = false, customFormId = null) => {
        const params = sitepackParams({ category: "Friday Pack Forms", preview: "true" });
        const qs = new URLSearchParams(params).toString();

        const url = isCustom
            ? `/forms/${customFormId}/use?${qs}`
            : `${formPath}?${qs}`;
        setPreviewUrl(url);
        setPreviewModalOpen(true);
    };

    const handleUseBuilderForm = (form) => {
        const formId = form._id || form.id;
        handleSelectForm(null, true, formId);
    };

    const handlePreviewBuilderForm = (form) => {
        const formId = form._id || form.id;
        handlePreviewForm(null, true, formId);
    };

    const handleSelectSavedGeneralSubmission = (submission) => {
        const path = generalFormTitleToPath[submission.form?.title];
        if (!path) return;
        const rid = submission.id || submission._id;
        closeCreateFormModal();
        navigate(pathWithSearchParams(path, sitepackParams({
            category: "Friday Pack Forms",
            fromTemplate: rid,
        })));
    };

    const handlePreviewSavedGeneralSubmission = (submission) => {
        const path = generalFormTitleToPath[submission.form?.title];
        if (!path) return;
        const rid = submission.id || submission._id;
        setPreviewUrl(pathWithSearchParams(path, sitepackParams({
            category: "Friday Pack Forms",
            fromTemplate: rid,
            preview: "true",
        })));
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

    const handleView = async (docOverride) => {
        const activeDoc = docOverride || menuDoc;
        if (!activeDoc) return;

        if (activeDoc.isFormBase) {
            if (!docOverride) handleMenuClose();
            const resId = activeDoc.id || activeDoc._id;
            const category = selectedModule?.title || activeDoc.rawResponse?.category || "Friday Pack Forms";
            const reportPath = getSitepackReportFormPath(activeDoc, resId, sitepackParams({ category }));
            if (reportPath) {
                navigate(reportPath);
                return;
            }
            const path = getSitepackFormPathForResponse(activeDoc, resId);
            if (!path) return;
            navigate(pathWithSearchParams(path, sitepackParams({ category })));
            return;
        }

        const docToView = activeDoc;
        if (!docOverride) handleMenuClose();

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

            if (shouldFetchPreviewViaApi(docToView)) {
                const response = await fetchDocumentPreviewBlob(docId);
                const apiError = await readBlobApiError(response.data);
                if (apiError) {
                    throw new Error(apiError);
                }
                const typedBlob = createTypedBlob(
                    response.data,
                    docType,
                    response.headers?.["content-type"]
                );
                const blobUrl = URL.createObjectURL(typedBlob);
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
            window.alert(await parseAxiosErrorMessage(err));
        } finally {
            setDownloadInProgress(false);
        }
    };

    const handleDownload = () => {
        if (menuDoc?.isFormBase) {
            handleMenuClose();
            runFormDownloadPdf(menuDoc);
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
            runFormDownloadWord(menuDoc);
            return;
        }
        handleMenuClose();
    };

    const runFormDownloadPdf = (doc) => {
        const resId = doc.id || doc._id;
        const category = selectedModule?.title || doc?.rawResponse?.category || FRIDAY_PACK_FORMS_CATEGORY;
        const reportPath = getSitepackReportFormPath(doc, resId, sitepackParams({ category }));
        if (reportPath) {
            window.open(pathWithSearchParams(reportPath, { action: "download" }), "_blank");
            return;
        }
        const path = getSitepackFormPathForResponse(doc, resId);
        if (!path) return;
        window.open(pathWithSearchParams(path, sitepackParams({ category, action: "download" })), "_blank");
    };

    const runFormDownloadWord = (doc) => {
        if (!canSitepackFormDownloadWord(doc)) return;
        const resId = doc.id || doc._id;
        const category = selectedModule?.title || doc?.rawResponse?.category || FRIDAY_PACK_FORMS_CATEGORY;
        const reportPath = getSitepackReportFormPath(doc, resId, sitepackParams({ category }));
        if (reportPath) {
            window.open(pathWithSearchParams(reportPath, { action: "download_word" }), "_blank");
            return;
        }
        const path = getSitepackFormPathForResponse(doc, resId);
        if (!path) return;
        window.open(pathWithSearchParams(path, sitepackParams({ category, action: "download_word" })), "_blank");
    };

    const handleFormPreview = (doc) => {
        if (!doc?.isFormBase) {
            handleView(doc);
            return;
        }
        const resId = doc.id || doc._id;
        const category = selectedModule?.title || FRIDAY_PACK_FORMS_CATEGORY;
        const reportPath = getSitepackReportFormPath(doc, resId, sitepackParams({ category, preview: "true" }));
        if (reportPath) {
            setPreviewUrl(reportPath);
            setPreviewModalOpen(true);
            return;
        }
        const path = getSitepackFormPathForResponse(doc, resId);
        if (!path) return;
        setPreviewUrl(pathWithSearchParams(path, sitepackParams({ category, preview: "true" })));
        setPreviewModalOpen(true);
    };

    const handleFormEdit = (doc) => {
        if (!doc?.isFormBase) return;
        const resId = doc.id || doc._id;
        const category = selectedModule?.title || FRIDAY_PACK_FORMS_CATEGORY;
        const reportPath = getSitepackReportFormPath(doc, resId, sitepackParams({ category }));
        if (reportPath) {
            navigate(reportPath);
            return;
        }
        const path = getSitepackFormPathForResponse(doc, resId);
        if (!path) return;
        navigate(pathWithSearchParams(path, sitepackParams({ category })));
    };

    const handleFormDeletePrompt = (doc) => {
        setMenuDoc(doc);
        setDeleteModalOpen(true);
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
                if (selectedSite && selectedSubfolder && selectedModule) {
                    await reloadModuleDocuments();
                }
            } catch (error) {
                console.error("Delete failed", error);
            }
        }
    };

    const filteredDocs = docs;
    const isFridayPackFolderView = selectedModule?.title === FRIDAY_PACK_FORMS_CATEGORY;
    const fridayPackTableDocs = useMemo(
        () =>
            isFridayPackFolderView
                ? [...filteredDocs].sort(
                      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                  )
                : filteredDocs,
        [filteredDocs, isFridayPackFolderView]
    );

    const fridayPackActionBtnSx = {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "0.72rem",
        borderRadius: 1.5,
        minWidth: 0,
        px: 1,
        py: 0.35,
        borderColor: isDarkMode ? "#374151" : "#E2E8F0",
        color: isDarkMode ? "#E5E7EB" : "#334155",
    };

    const fridayPackTableHeadSx = {
        fontWeight: 700,
        fontSize: "0.7rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        bgcolor: isDarkMode ? "#111827" : "#F8FAFC",
        color: isDarkMode ? "#9CA3AF" : "#64748B",
        borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)",
        py: 1.25,
    };

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
                            {selectedModule
                                ? selectedModule.title
                                : selectedSubfolder
                                    ? selectedSubfolder.name
                                    : selectedSite
                                        ? selectedSite.name
                                        : "All Sites"}
                        </Typography>
                        {!selectedSite && !selectedModule && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                Select a site to manage its document packs
                            </Typography>
                        )}
                        {selectedSite && !selectedModule && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                Select a category to manage documents
                            </Typography>
                        )}
                        {selectedSite && selectedModule && !selectedSubfolder && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                {selectedSite.name} &bull; Create or open a subfolder
                            </Typography>
                        )}
                        {selectedModule && selectedSubfolder && (
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                {selectedSite.name} / {selectedModule.title} / {selectedSubfolder.name}
                                {isUnfiledSubfolder(selectedSubfolder)
                                    ? " (saved before subfolders were used)"
                                    : isAllFormsSubfolder(selectedSubfolder)
                                      ? " (all subfolders)"
                                      : ""}
                            </Typography>
                        )}
                        {selectedModule && selectedSubfolder && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {filteredDocs.length}{" "}
                                {selectedModule.title === FRIDAY_PACK_FORMS_CATEGORY
                                    ? `saved item${filteredDocs.length === 1 ? "" : "s"}`
                                    : `document${filteredDocs.length === 1 ? "" : "s"}`}
                            </Typography>
                        )}

                    </Box>
                </Box>

                {selectedSite && selectedModule && !selectedSubfolder ? (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreateSubfolder}
                        sx={{
                            textTransform: "none",
                            borderRadius: 3,
                            boxShadow: "none",
                            bgcolor: "#3B82F6",
                            "&:hover": { bgcolor: "#2563EB", boxShadow: "none" },
                        }}
                    >
                        Create Subfolder
                    </Button>
                ) : selectedModule && selectedSubfolder && !isUnfiledSubfolder(selectedSubfolder) && !isAllFormsSubfolder(selectedSubfolder) && isSitepackReportModule(selectedModule.title) ? (
                    <Button
                        variant="contained"
                        startIcon={<DriveFileRenameOutlineIcon />}
                        onClick={handleNewReport}
                        sx={{
                            textTransform: "none",
                            borderRadius: 3,
                            boxShadow: "none",
                            bgcolor: "#E89F17",
                            "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
                        }}
                    >
                        New Report
                    </Button>
                ) : selectedModule && selectedSubfolder && !isUnfiledSubfolder(selectedSubfolder) && !isAllFormsSubfolder(selectedSubfolder) && selectedModule.title === "Friday Pack Forms" ? (
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
                ) : selectedModule && selectedSubfolder && !isUnfiledSubfolder(selectedSubfolder) && !isAllFormsSubfolder(selectedSubfolder) ? (
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
                    </Box>
                ) : selectedSite && !selectedModule ? (
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
                    selectedSubfolder ? (
                        // DOCUMENT VIEW
                        <>
                            {moduleItemsLoading ? (
                                <Box sx={{ py: 2 }}>
                                    <TablePageSkeleton rows={5} />
                                </Box>
                            ) : null}
                            {!moduleItemsLoading && filteredDocs.length === 0 ? (
                                <Typography color="text.secondary" align="center" sx={{ py: 5 }}>
                                    {selectedModule?.title === FRIDAY_PACK_FORMS_CATEGORY
                                        ? "No saved forms in this folder yet. Use Create Form to add one."
                                        : "No documents or saved forms in this folder yet."}
                                </Typography>
                            ) : null}
                            {!moduleItemsLoading && isFridayPackFolderView && fridayPackTableDocs.length > 0 ? (
                                <Paper
                                    elevation={0}
                                    sx={{
                                        borderRadius: 3,
                                        overflow: "hidden",
                                        border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                                    }}
                                >
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ ...fridayPackTableHeadSx, width: 56 }}>#</TableCell>
                                                    <TableCell sx={fridayPackTableHeadSx}>Form</TableCell>
                                                    <TableCell sx={{ ...fridayPackTableHeadSx, width: 140 }}>Template</TableCell>
                                                    <TableCell sx={{ ...fridayPackTableHeadSx, width: 120 }}>Submitted</TableCell>
                                                    <TableCell align="right" sx={{ ...fridayPackTableHeadSx, width: 360 }}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {fridayPackTableDocs.map((doc, index) => (
                                                    <TableRow
                                                        key={doc.id || doc._id}
                                                        hover
                                                        sx={{
                                                            "&:last-child td": { borderBottom: 0 },
                                                            "& td": {
                                                                borderBottom: isDarkMode
                                                                    ? "1px solid rgba(255,255,255,0.05)"
                                                                    : "1px solid rgba(15,23,42,0.06)",
                                                                py: 1.35,
                                                            },
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontWeight: 700, color: isDarkMode ? "#94A3B8" : "#64748B" }}>
                                                                {index + 1}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", lineHeight: 1.35 }}>
                                                                {doc.title}
                                                            </Typography>
                                                            {doc.tags?.length > 0 ? (
                                                                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                                                                    {doc.tags.slice(0, 3).map((tag) => (
                                                                        <Chip
                                                                            key={tag}
                                                                            label={tag}
                                                                            size="small"
                                                                            sx={{ height: 18, fontSize: "0.65rem" }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: 500 }}>
                                                                {doc.templateTitle || doc.size || "—"}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: 600, whiteSpace: "nowrap" }}>
                                                                {formatSitepackFormDate(doc.createdAt)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<Eye size={13} />}
                                                                    onClick={() => handleFormPreview(doc)}
                                                                    sx={fridayPackActionBtnSx}
                                                                >
                                                                    View
                                                                </Button>
                                                                {doc.isFormBase ? (
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        startIcon={<Pencil size={13} />}
                                                                        onClick={() => handleFormEdit(doc)}
                                                                        sx={fridayPackActionBtnSx}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                ) : null}
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<Download size={13} />}
                                                                    onClick={() => (doc.isFormBase ? runFormDownloadPdf(doc) : runDocumentDownload(doc))}
                                                                    sx={fridayPackActionBtnSx}
                                                                >
                                                                    PDF
                                                                </Button>
                                                                {canSitepackFormDownloadWord(doc) ? (
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        startIcon={<FileText size={13} />}
                                                                        onClick={() => runFormDownloadWord(doc)}
                                                                        sx={fridayPackActionBtnSx}
                                                                    >
                                                                        Word
                                                                    </Button>
                                                                ) : null}
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color="error"
                                                                    startIcon={<Trash2 size={13} />}
                                                                    onClick={() => handleFormDeletePrompt(doc)}
                                                                    sx={{
                                                                        ...fridayPackActionBtnSx,
                                                                        borderColor: isDarkMode ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.25)",
                                                                        color: "#EF4444",
                                                                    }}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Paper>
                            ) : !moduleItemsLoading ? (
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
                            ) : null}
                        </>
                    ) : (
                        // SUBFOLDER LIST VIEW
                        subfoldersLoading ? (
                            <Box sx={{ py: 2 }}>
                                <TablePageSkeleton rows={3} />
                            </Box>
                        ) : (
                            <Grid container spacing={3}>
                                {showUnfiledSubfolder ? (
                                    <Grid item xs={12} sm={6} md={4}>
                                        <Card
                                            variant="outlined"
                                            onClick={() => handleSubfolderClick(createUnfiledSubfolder())}
                                            sx={{
                                                borderRadius: 4,
                                                width: 350,
                                                height: 120,
                                                display: "flex",
                                                flexDirection: "column",
                                                bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                                border: isDarkMode ? "1px dashed #6B7280" : "1px dashed #D1D5DB",
                                                transition: "all 0.2s ease-in-out",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    borderColor: "#F59E0B",
                                                    boxShadow: isDarkMode
                                                        ? "0 4px 20px rgba(0,0,0,0.4)"
                                                        : "0 4px 6px -1px rgba(245, 158, 11, 0.15)",
                                                },
                                            }}
                                        >
                                            <CardActionArea sx={{ height: "100%", p: 3, display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 3, width: "100%" }}>
                                                    <Box
                                                        sx={{
                                                            bgcolor: isDarkMode ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB",
                                                            p: 1.5,
                                                            borderRadius: 3,
                                                            color: "#F59E0B",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            minWidth: 56,
                                                            height: 56,
                                                        }}
                                                    >
                                                        <Folder size={28} />
                                                    </Box>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="h6" fontWeight={700} noWrap sx={{ fontSize: "1.05rem", color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                                            Unfiled items
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Forms saved without a subfolder
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ) : null}
                                {subfolders.length === 0 && !showUnfiledSubfolder ? (
                                    <Grid item xs={12}>
                                        <Typography color="text.secondary" align="center">
                                            No subfolders yet. Click &quot;Create Subfolder&quot; to add one.
                                        </Typography>
                                    </Grid>
                                ) : (
                                    subfolders.map((subfolder) => (
                                        <Grid item xs={12} sm={6} md={4} key={subfolder.id}>
                                            <Card
                                                variant="outlined"
                                                onClick={() => handleSubfolderClick(subfolder)}
                                                sx={{
                                                    borderRadius: 4,
                                                    width: 350,
                                                    height: 120,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                                    border: isDarkMode ? "1px solid #374151" : '1px solid #E5E7EB',
                                                    transition: 'all 0.2s ease-in-out',
                                                    cursor: 'pointer',
                                                    position: "relative",
                                                    "&:hover": {
                                                        borderColor: "#3B82F6",
                                                        boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)"
                                                    }
                                                }}
                                            >
                                                {selectedModule?.title === FRIDAY_PACK_FORMS_CATEGORY ? (
                                                    <Box
                                                        sx={{ position: "absolute", top: 6, right: 6, zIndex: 2, display: "flex", gap: 0.25 }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Edit folder"
                                                            onClick={(e) => handleOpenEditSubfolder(e, subfolder)}
                                                            sx={{ color: isDarkMode ? "#9CA3AF" : "#64748B" }}
                                                        >
                                                            <Pencil size={15} />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Delete folder"
                                                            onClick={(e) => handleOpenDeleteSubfolder(e, subfolder)}
                                                            sx={{ color: "#EF4444" }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </IconButton>
                                                    </Box>
                                                ) : null}
                                                <CardActionArea sx={{ height: '100%', p: 3, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
                                                        <Box
                                                            sx={{
                                                                bgcolor: isDarkMode ? "rgba(59, 130, 246, 0.1)" : '#EFF6FF',
                                                                p: 1.5,
                                                                borderRadius: 3,
                                                                color: '#3B82F6',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                minWidth: 56,
                                                                height: 56
                                                            }}
                                                        >
                                                            <Folder size={28} />
                                                        </Box>
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography variant="h6" fontWeight={700} noWrap sx={{ fontSize: '1.05rem', color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                                                                {subfolder.name}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {subfolderItemCounts[subfolder.id]
                                                                    ? `${subfolderItemCounts[subfolder.id]} item${subfolderItemCounts[subfolder.id] === 1 ? "" : "s"}`
                                                                    : "Open to view documents"}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </CardActionArea>
                                            </Card>
                                        </Grid>
                                    ))
                                )}
                            </Grid>
                        )
                    )
                    ) : (
                        // MODULE SELECTION VIEW
                        <>
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

                        </>
                    )
                ) : (
                    // SITE LIST VIEW
                    loading ? (
                        <Box sx={{ py: 2 }}>
                            <TablePageSkeleton rows={4} />
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {sites.length === 0 ? (
                                <Grid item xs={12}>
                                    <Typography color="text.secondary" align="center">
                                        {search.trim() || role === "company_admin" || role === "superadmin"
                                            ? "No sites found."
                                            : "No sites assigned to you yet. Ask your company admin to create a site and select you as a site manager."}
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
                                        "The file is removed automatically after this date."
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
                {menuDoc?.isFormBase ? (
                    <MenuItem onClick={() => { handleMenuClose(); handleFormEdit(menuDoc); }} sx={{ gap: 1.5, py: 1.5 }}>
                        <Pencil size={18} color="#6B7280" />
                        <ListItemText primary="Edit" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </MenuItem>
                ) : null}
                {selectedModule?.title !== "Induction" && (
                    <MenuItem onClick={handleDownload} disabled={downloadInProgress} sx={{ gap: 1.5, py: 1.5 }}>
                        <Download size={18} color="#6B7280" />
                        <ListItemText primary="Download as PDF" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    </MenuItem>
                )}
                {selectedModule?.title !== "Induction" && menuDoc?.isFormBase && canSitepackFormDownloadWord(menuDoc) && (
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

            {/* Create Subfolder Dialog */}
            <Dialog
                open={createSubfolderOpen}
                onClose={handleCloseCreateSubfolder}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        padding: 2,
                        minWidth: 360,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: '1.25rem' }}>
                    Create Subfolder
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        Name your subfolder. Documents for {selectedModule?.title || "this category"} are organised inside subfolders.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Folder name"
                        value={newSubfolderName}
                        onChange={(e) => {
                            setNewSubfolderName(e.target.value);
                            setSubfolderError("");
                        }}
                        error={Boolean(subfolderError)}
                        helperText={subfolderError}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateSubfolder();
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ borderTop: isDarkMode ? "1px solid #374151" : "none", pt: 2 }}>
                    <Button
                        onClick={handleCloseCreateSubfolder}
                        disabled={creatingSubfolder}
                        variant="outlined"
                        sx={{ textTransform: 'none', borderRadius: 50, px: 3 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateSubfolder}
                        disabled={creatingSubfolder}
                        variant="contained"
                        sx={{
                            textTransform: 'none',
                            borderRadius: 50,
                            px: 3,
                            bgcolor: "#3B82F6",
                            "&:hover": { bgcolor: "#2563EB" },
                        }}
                    >
                        {creatingSubfolder ? "Creating..." : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Subfolder Dialog */}
            <Dialog
                open={editSubfolderOpen}
                onClose={handleCloseEditSubfolder}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        padding: 2,
                        minWidth: 360,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    },
                }}
            >
                <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: "1.25rem" }}>
                    Rename folder
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        Update the folder name for {selectedModule?.title || "this category"}.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Folder name"
                        value={newSubfolderName}
                        onChange={(e) => {
                            setNewSubfolderName(e.target.value);
                            setSubfolderError("");
                        }}
                        error={Boolean(subfolderError)}
                        helperText={subfolderError}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateSubfolder();
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ borderTop: isDarkMode ? "1px solid #374151" : "none", pt: 2 }}>
                    <Button
                        onClick={handleCloseEditSubfolder}
                        disabled={savingSubfolder}
                        variant="outlined"
                        sx={{ textTransform: "none", borderRadius: 50, px: 3 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateSubfolder}
                        disabled={savingSubfolder}
                        variant="contained"
                        sx={{
                            textTransform: "none",
                            borderRadius: 50,
                            px: 3,
                            bgcolor: "#3B82F6",
                            "&:hover": { bgcolor: "#2563EB" },
                        }}
                    >
                        {savingSubfolder ? "Saving..." : "Save"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Subfolder Dialog */}
            <Dialog
                open={deleteSubfolderOpen}
                onClose={handleCloseDeleteSubfolder}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        padding: 2,
                        minWidth: 360,
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    },
                }}
            >
                <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: "1.25rem", color: "#EF4444" }}>
                    Delete folder?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
                        Delete &quot;{subfolderToDelete?.name}&quot;? Saved forms inside this folder will remain on the site but may become unfiled.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ pt: 2 }}>
                    <Button
                        onClick={handleCloseDeleteSubfolder}
                        disabled={deletingSubfolder}
                        variant="outlined"
                        sx={{ textTransform: "none", borderRadius: 50, px: 3 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDeleteSubfolder}
                        disabled={deletingSubfolder}
                        variant="contained"
                        color="error"
                        sx={{ textTransform: "none", borderRadius: 50, px: 3 }}
                    >
                        {deletingSubfolder ? "Deleting..." : "Delete folder"}
                    </Button>
                </DialogActions>
            </Dialog>

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
                onClose={closeCreateFormModal}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        overflow: "hidden",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        fontWeight: 700,
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        pb: 1,
                    }}
                >
                    Select template / form
                </DialogTitle>

                <Box
                    sx={{
                        px: 3,
                        borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    }}
                >
                    <Tabs
                        value={createFormPickerTab}
                        onChange={(_, value) => setCreateFormPickerTab(value)}
                        sx={{
                            minHeight: 40,
                            "& .MuiTab-root": {
                                textTransform: "none",
                                fontWeight: 600,
                                minHeight: 40,
                                color: isDarkMode ? "#9CA3AF" : "#6B7280",
                            },
                            "& .Mui-selected": { color: "#E89F17" },
                            "& .MuiTabs-indicator": { bgcolor: "#E89F17" },
                        }}
                    >
                        <Tab
                            value={CREATE_FORM_TAB_TEMPLATES}
                            label={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    Template library
                                    <Chip
                                        size="small"
                                        label={filteredBlankTemplates.length}
                                        sx={{ height: 20, fontSize: "0.7rem" }}
                                    />
                                </Box>
                            }
                        />
                        <Tab
                            value={CREATE_FORM_TAB_SAVED}
                            label={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    Saved templates
                                    <Chip
                                        size="small"
                                        label={filteredSavedTemplates.length}
                                        sx={{ height: 20, fontSize: "0.7rem" }}
                                    />
                                </Box>
                            }
                        />
                        <Tab
                            value={CREATE_FORM_TAB_BUILDER}
                            label={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    Form builder
                                    <Chip
                                        size="small"
                                        label={filteredBuilderForms.length}
                                        sx={{ height: 20, fontSize: "0.7rem" }}
                                    />
                                </Box>
                            }
                        />
                    </Tabs>
                </Box>

                <DialogContent
                    dividers
                    sx={{
                        maxHeight: "70vh",
                        bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                    }}
                >
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={
                            createFormPickerTab === CREATE_FORM_TAB_SAVED
                                ? "Search saved templates..."
                                : createFormPickerTab === CREATE_FORM_TAB_BUILDER
                                  ? "Search form builder forms..."
                                  : "Search templates..."
                        }
                        value={createFormSearch}
                        onChange={(e) => setCreateFormSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 18, color: isDarkMode ? "#9CA3AF" : "#6B7280" }} />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 2 },
                        }}
                        sx={{ mb: 2.5 }}
                    />

                    {createFormModalLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                            <CircularProgress sx={{ color: FRIDAY_PACK_ACCENT }} />
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                                gap: 2,
                            }}
                        >
                            {createFormPickerTab === CREATE_FORM_TAB_SAVED &&
                                (filteredSavedTemplates.length === 0 ? (
                                    <Typography
                                        sx={{
                                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                            gridColumn: "1 / -1",
                                            py: 3,
                                            textAlign: "center",
                                        }}
                                    >
                                        {savedGeneralSubmissions.length === 0
                                            ? "No saved templates yet. Save a template from the Templates page to see it here."
                                            : "No saved templates match your search."}
                                    </Typography>
                                ) : (
                                    filteredSavedTemplates.map((sub) => {
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
                                        const savedLabel = sub.createdAt
                                            ? `Saved ${new Date(sub.createdAt).toLocaleDateString("en-GB", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                              })}`
                                            : null;
                                        return (
                                            <FormPickerCard
                                                key={rid}
                                                isDarkMode={isDarkMode}
                                                title={primary}
                                                description={secondary}
                                                meta={savedLabel}
                                                onUse={() => handleSelectSavedGeneralSubmission(sub)}
                                                onPreview={() => handlePreviewSavedGeneralSubmission(sub)}
                                            />
                                        );
                                    })
                                ))}

                            {createFormPickerTab === CREATE_FORM_TAB_TEMPLATES &&
                                (filteredBlankTemplates.length === 0 ? (
                                    <Typography
                                        sx={{
                                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                            gridColumn: "1 / -1",
                                            py: 3,
                                            textAlign: "center",
                                        }}
                                    >
                                        No templates match your search.
                                    </Typography>
                                ) : (
                                    filteredBlankTemplates.map((template) => (
                                        <FormPickerCard
                                            key={template.id}
                                            isDarkMode={isDarkMode}
                                            title={template.title}
                                            description={template.description}
                                            onUse={() => handleSelectForm(template.path, false)}
                                            onPreview={() => handlePreviewForm(template.path, false)}
                                        />
                                    ))
                                ))}

                            {createFormPickerTab === CREATE_FORM_TAB_BUILDER &&
                                (filteredBuilderForms.length === 0 ? (
                                    <Typography
                                        sx={{
                                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                            gridColumn: "1 / -1",
                                            py: 3,
                                            textAlign: "center",
                                        }}
                                    >
                                        {builderForms.length === 0
                                            ? "No form builder forms yet. Create forms in the Form Builder first."
                                            : "No form builder forms match your search."}
                                    </Typography>
                                ) : (
                                    filteredBuilderForms.map((form) => {
                                        const formId = form._id || form.id;
                                        return (
                                            <FormPickerCard
                                                key={formId}
                                                isDarkMode={isDarkMode}
                                                title={form.title || "Untitled form"}
                                                description={
                                                    form.description ||
                                                    "Custom form from the form builder"
                                                }
                                                onUse={() => handleUseBuilderForm(form)}
                                                onPreview={() => handlePreviewBuilderForm(form)}
                                            />
                                        );
                                    })
                                ))}
                        </Box>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={closeCreateFormModal} sx={{ textTransform: "none" }}>
                        Cancel
                    </Button>
                </DialogActions>
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
