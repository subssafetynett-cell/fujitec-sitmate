import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    TextField
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import { Eye, Pencil, Download, Mail, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import PageContent from "../components/PageContent";
import { formatSubmitterDisplay, showSubmissionCreatorColumn } from "../utils/submitterDisplay";
import { useAuth } from "../context/AuthContext";
import FormSelectionDialog from "../components/FormSelectionDialog";
import TemplatePreviewDialog from "../components/TemplatePreviewDialog";
import FormRenderer from "../components/FormRenderer";
import HealthSafetyConcernForm from "../components/HealthSafetyConcernForm";
import WeeklySupervisorInspectionForm from "../components/WeeklySupervisorInspectionForm";
import api, { fetchFormResponsesList } from "../services/api";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { withLogoPreviewFields } from "../utils/formLogoUrl";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import { prepareConcernWeeklyPdfAssets } from "../utils/prepareFormPdfAssets";
import {
    appendSitepackToAnswers,
    matchesSitepackScope,
    sitepackNavState,
} from "../utils/sitepackContext";
import { getMonitoringSection } from "../constants/monitoringSections";
import {
    TEMPLATE_LIBRARY,
    TEMPLATE_LIBRARY_BY_TITLE,
    buildSheqFormUrl,
    buildTemplatePreviewUrl,
    buildTemplateUseUrl,
} from "../constants/templateCatalog";
import {
    monitoringFolderPath,
    monitoringFormSearchParams,
    monitoringSitePath,
    pathWithSearchParams,
} from "../utils/monitoringContext";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import { saveGeneralFormResponse } from "../services/formUtils";
import { GENERAL_FORMS_CATEGORY } from "../utils/generalFormSubmissions";
import { canEditGeneralFormTemplate } from "../utils/generalFormTemplateAccess";
import {
    withGeneralFormVisibility,
    GENERAL_FORM_VISIBILITY,
} from "../utils/generalFormVisibility";
import {
    appendTemplatesPageMetadata,
    isTemplatesPageEditContext,
    templatesPageListUrl,
    templateSaveButtonLabel,
} from "../utils/templatePageContext";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const getSubheading = (title) => {
    switch (title) {
        case "Health & Safety concern":
            return "Submit and track health & safety observations and issues.";
        case "Sustainability concern":
            return "Report and monitor environmental and sustainability matters.";
        case "Quality concern":
            return "Document and manage quality control observations and defects.";
        case "Positive observation":
            return "Highlight and share positive safety practices and behaviors.";
        case "Concern and positive feedback report":
            return "Overview of all logged concerns and positive feedback across sites.";
        case "Weekly supervisor health & safety inspection":
            return "Conduct and review weekly site safety inspections.";
        case "Weekly supervisor reports":
            return "View and manage weekly submitted supervisor reports.";
        case "SHEQ Inspection service report":
            return "Manage SHEQ service inspections, audits, and their findings.";
        case "SHEQ Inspection installation":
            return "Record and analyze SHEQ installation observations.";
        case "SHEQ Inspection installation report":
            return "View detailed SHEQ installation reports and audits.";
        case "Client level analysis":
            return "Analyze performance and safety metrics across the entire client portfolio.";
        case "Site level analysis":
            return "Analyze performance and safety metrics for specific operational sites.";
        case "Friday pack forms":
            return "Manage and review Friday pack form submissions.";
        default:
            return `Manage and track ${title ? title.toLowerCase() : "reports"}.`;
    }
};

const STATIC_CONCERN_FORM_ID = "health-safety-concern-static-id";

/** PDF: scale the full concern report onto one A4 page. */
const CONCERN_PDF_OPTIONS = {
    paginateBlocks: false,
    onePageOnly: true,
    skipBuiltInFooter: true,
    marginX: 8,
    headerInsetMm: 6,
    footerInsetMm: 6,
    blockScale: 2,
    jpegQuality: 0.86,
    minJpegQuality: 0.6,
    maxOutputBytes: 5 * 1024 * 1024,
    targetMaxBytes: 450_000,
};

const WEEKLY_PDF_OPTIONS = {
    paginateBlocks: true,
    blockScale: 1.75,
    jpegQuality: 0.82,
    minJpegQuality: 0.55,
    maxOutputBytes: 5 * 1024 * 1024,
    targetMaxBytes: 320_000,
    skipBuiltInFooter: false,
    useRunningHeader: true,
    imageCompression: "FAST",
};

/** Built-in concern/weekly UI vs form-builder template chosen via "Choose Form". */
function inferFormDisplayKind(form, pageTitle) {
    if (!form) return null;
    const formId = form.id || form._id;
    const isWeeklyPage =
        pageTitle === "Weekly supervisor health & safety inspection" ||
        pageTitle === "Weekly supervisor reports";
    if (formId === STATIC_CONCERN_FORM_ID) {
        return isWeeklyPage ? "weekly" : "concern";
    }
    if (isWeeklyPage && (!Array.isArray(form.fields) || form.fields.length === 0)) {
        return "weekly";
    }
    return "builder";
}

function concernDefaultTitle(pageTitle) {
    if (pageTitle === "Sustainability concern") return "Environmental & Sustainability Concern";
    if (pageTitle === "Quality concern") return "Quality Concern";
    if (pageTitle === "Positive observation") return "Positive Observation";
    return "Health & Safety Concern";
}

function concernFormTypeFromPageTitle(pageTitle) {
    if (pageTitle === "Sustainability concern") return "sustainability";
    if (pageTitle === "Quality concern") return "quality";
    if (pageTitle === "Positive observation") return "positive";
    return "health_safety";
}

function concernFormButtonLabel(pageTitle) {
    if (
        pageTitle === "Weekly supervisor health & safety inspection" ||
        pageTitle === "Weekly supervisor reports"
    ) {
        return "H&S form";
    }
    return "Concern Form";
}

export default function GenericReportPage({ pageTitle }) {
    const themeContext = useTheme();
    const isDarkMode = themeContext?.isDarkMode;
    const { role } = useAuth();
    const showCreatorColumn = showSubmissionCreatorColumn(role);
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchParams] = useSearchParams();
    const search = searchParams.get("search") || "";
    const siteId = searchParams.get("siteId");
    const subfolderId = searchParams.get("subfolderId");
    const monitoringSection = searchParams.get("monitoringSection");
    const urlResponseId = searchParams.get("responseId");
    const shouldAutoCreate = searchParams.get("create") === "true";
    const isTemplatesPageEdit = isTemplatesPageEditContext(searchParams);
    const canEditTemplate = canEditGeneralFormTemplate(role, { siteId });
    const isSitepackContext = Boolean(siteId);
    const isMonitoringContext = Boolean(monitoringSection && siteId);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    const [selectedForm, setSelectedForm] = useState(null);
    /** @type {"concern"|"weekly"|"builder"|null} */
    const [activeFormKind, setActiveFormKind] = useState(null);
    const [formValues, setFormValues] = useState({});
    const logoUrl = useCompanyLogo();

    // Modes: 
    // - initial: List view
    // - filling: New submission
    // - editing: Editing existing submission
    // - viewed: Read-only view
    const [viewMode, setViewMode] = useState("initial");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Submissions list state
    const [submissions, setSubmissions] = useState([]);


    // Success Dialog state
    const [successOpen, setSuccessOpen] = useState(false);
    const [lastResponse, setLastResponse] = useState(null);

    // Delete Dialog
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Menu State
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuItem, setMenuItem] = useState(null);

    // Edit State
    const [editingId, setEditingId] = useState(null);

    // PDF Ref
    const printRef = useRef();
    const [downloading, setDownloading] = useState(false);
    const [pdfExportValues, setPdfExportValues] = useState(null);

    // Email State
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailingItem, setEmailingItem] = useState(null);
    const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
    const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
    const [templatePreviewUrl, setTemplatePreviewUrl] = useState("");
    const [templateMetadata, setTemplateMetadata] = useState({
        name: "",
        tags: "",
        visibility: GENERAL_FORM_VISIBILITY.PRIVATE,
    });

    const getSubmissionTitle = (row) =>
        row?.answers?.report_heading?.trim() ||
        row?.form?.title ||
        row?.formId?.title ||
        "Untitled";


    const fetchSubmissions = useCallback(async () => {
        try {
            const params = { category: pageTitle };
            if (isSitepackContext && siteId) {
                params.siteId = siteId;
                if (subfolderId) {
                    params.subfolderId = subfolderId;
                }
            }
            const res = await fetchFormResponsesList(params);
            if (res?.success) {
                let list = res.data || [];
                if (isSitepackContext) {
                    list = list.filter((row) =>
                        matchesSitepackScope(row, { siteId, subfolderId })
                    );
                }
                setSubmissions(list);
            }
        } catch (err) {
            console.error("Failed to fetch submissions", err);
        }
    }, [pageTitle, isSitepackContext, siteId, subfolderId]);

    const navigateBackToSitepack = useCallback(() => {
        if (isMonitoringContext) {
            if (subfolderId) {
                navigate(monitoringFolderPath(monitoringSection, siteId, subfolderId));
            } else {
                navigate(monitoringSitePath(monitoringSection, siteId));
            }
            return;
        }
        navigate("/sitepack-management", {
            state: sitepackNavState({
                siteId,
                subfolderId,
                moduleTitle: pageTitle,
            }),
        });
    }, [navigate, siteId, subfolderId, pageTitle, isMonitoringContext, monitoringSection]);

    // Reset state when title changes (e.g. navigating between sidebar items)
    useEffect(() => {
        setViewMode("initial");
        setSelectedForm(null);
        setActiveFormKind(null);
        setFormValues({});
        setEditingId(null);
        fetchSubmissions();
    }, [pageTitle, fetchSubmissions]);

    const handleOpenConcernForm = () => {
        const kind =
            pageTitle === "Weekly supervisor health & safety inspection" ||
            pageTitle === "Weekly supervisor reports"
                ? "weekly"
                : "concern";
        setActiveFormKind(kind);
        const defaultTitle = kind === "weekly" ? pageTitle : concernDefaultTitle(pageTitle);
        setSelectedForm({
            id: STATIC_CONCERN_FORM_ID,
            title: defaultTitle,
            fields: [],
        });
        setFormValues(kind === "concern" ? { report_heading: defaultTitle } : {});
        setEditingId(null);
        setViewMode("filling");
    };

    const getTemplateContextExtra = () => {
        const extra = {};
        if (isSitepackContext) {
            if (siteId) extra.siteId = siteId;
            if (subfolderId) extra.subfolderId = subfolderId;
        }
        if (isMonitoringContext) {
            Object.assign(
                extra,
                monitoringFormSearchParams(monitoringSection, siteId, { subfolderId })
            );
        }
        return extra;
    };

    const openTemplatePreviewUrl = (url) => {
        if (!url) return;
        setTemplatePreviewUrl(url);
        setTemplatePreviewOpen(true);
        setDialogOpen(false);
    };

    const handleSelectSavedTemplate = async (submission, { preview = false } = {}) => {
        const responseId = submission?.id || submission?._id;
        if (!responseId) return;

        try {
            let sub = submission;
            if (!sub.answers) {
                const res = await api.get(`/forms/responses/${responseId}`);
                if (!res.data?.success || !res.data.data) {
                    alert("Could not load the selected template.");
                    return;
                }
                sub = res.data.data;
            }

            const moduleTitle =
                sub.answers?.templateModuleTitle || sub.form?.title || "";
            const template =
                TEMPLATE_LIBRARY_BY_TITLE[moduleTitle] ||
                TEMPLATE_LIBRARY.find((row) => row.title === sub.form?.title);

            if (template) {
                const extra = { fromTemplate: String(responseId), ...getTemplateContextExtra() };

                if (preview) {
                    openTemplatePreviewUrl(buildTemplatePreviewUrl(template, extra));
                    return;
                }

                let url = null;
                if (template.type === "report") {
                    url = pathWithSearchParams(template.path, { ...extra, create: "true" });
                } else if (template.type === "general") {
                    url = pathWithSearchParams(template.path, extra);
                } else if (template.type === "sheq") {
                    url = buildSheqFormUrl(template, extra);
                }

                if (url) {
                    setDialogOpen(false);
                    navigate(url);
                    return;
                }
            }

            const formId = sub.formId || sub.form?.id || sub.form?._id;
            if (!formId) {
                alert("Could not load the selected template.");
                return;
            }

            const formRes = await api.get(`/forms/${formId}`);
            if (!formRes.data?.success || !formRes.data.data) {
                alert("Could not load the selected form.");
                return;
            }

            const seedAnswers = { ...(sub.answers || {}) };
            delete seedAnswers.savedFromTemplatesPage;

            setActiveFormKind("builder");
            setSelectedForm(formRes.data.data);
            setFormValues(seedAnswers);
            setEditingId(null);
            setViewMode(preview ? "viewed" : "filling");
            setDialogOpen(false);
        } catch (err) {
            console.error("Failed to load selected template", err);
            alert("Could not load the selected template.");
        }
    };

    const handleSelectCatalogTemplate = (template, { preview = false } = {}) => {
        const extra = getTemplateContextExtra();
        if (preview) {
            openTemplatePreviewUrl(buildTemplatePreviewUrl(template, extra));
            return;
        }
        const url = buildTemplateUseUrl(template, extra);
        if (!url) return;
        setDialogOpen(false);
        navigate(url);
    };

    const handleSelectBuilderForm = async (form, { preview = false } = {}) => {
        const formId = form?.id || form?._id;
        if (!formId) return;
        try {
            const res = await api.get(`/forms/${formId}`);
            if (!res.data?.success || !res.data.data) {
                alert("Could not load the selected form.");
                return;
            }
            if (preview) {
                const params = new URLSearchParams({ preview: "true", ...getTemplateContextExtra() });
                openTemplatePreviewUrl(`/forms/${formId}/use?${params.toString()}`);
                return;
            }
            setActiveFormKind("builder");
            setSelectedForm(res.data.data);
            setFormValues({});
            setEditingId(null);
            setViewMode("filling");
            setDialogOpen(false);
        } catch (err) {
            console.error("Failed to load selected form", err);
            alert("Could not load the selected form.");
        }
    };

    const handleSelectForm = async (selection) => {
        const isPreview = Boolean(selection?.preview);

        if (selection?.type === "catalog-template" && selection.template) {
            handleSelectCatalogTemplate(selection.template, { preview: isPreview });
            return;
        }

        if (selection?.type === "saved-template") {
            await handleSelectSavedTemplate(selection.submission, { preview: isPreview });
            return;
        }

        if (selection?.type === "builder-form" && selection.form) {
            await handleSelectBuilderForm(selection.form, { preview: isPreview });
            return;
        }

        const legacyForm = selection?.form || selection;
        const formId = legacyForm?.id || legacyForm?._id;
        if (formId) {
            await handleSelectBuilderForm(legacyForm, { preview: isPreview });
        }
    };

    const handleFormChange = (fieldId, value) => {
        setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const handleSubmit = () => {
        if (!selectedForm) return;
        if (isTemplatesPageEdit) {
            if (!canEditTemplate) return;
            setTemplateSaveOpen(true);
            return;
        }
        return submitReport();
    };

    const submitReport = async () => {
        if (!selectedForm) return;

        setIsSubmitting(true);
        try {
            let workingValues = { ...formValues };
            if (
                (activeFormKind === "concern" || activeFormKind === "weekly") &&
                !workingValues.report_heading?.trim()
            ) {
                workingValues.report_heading = selectedForm.title;
            }

            // Process answers to handle files
            const processedAnswers = {};
            for (const [key, value] of Object.entries(workingValues)) {
                if (value instanceof File) {
                    processedAnswers[key] = await toBase64(value);
                } else if (!key.endsWith("_preview")) {
                    if (typeof value === "string" && value.startsWith("blob:")) {
                        continue;
                    }
                    if ((key === "logo" || key === "company_logo") && (value == null || value === "")) {
                        processedAnswers[key] = null;
                        continue;
                    }
                    processedAnswers[key] = value;
                }
            }

            const answersWithSitepack = appendSitepackToAnswers(processedAnswers, {
                siteId,
                subfolderId,
            });
            if (monitoringSection) {
                answersWithSitepack.monitoringSection = monitoringSection;
                answersWithSitepack.reportModuleTitle = pageTitle;
            }

            const monitoringMeta = getMonitoringSection(monitoringSection);
            const saveCategory =
                monitoringMeta?.category && monitoringSection ? monitoringMeta.category : pageTitle;

            let res;
            if (viewMode === "editing" && editingId) {
                res = await api.put(`/forms/responses/${editingId}`, {
                    answers: answersWithSitepack,
                    category: saveCategory,
                });
            } else {
                const formId = selectedForm.id || selectedForm._id;
                res = await api.post(`/forms/${formId}/responses`, {
                    formId: formId,
                    answers: answersWithSitepack,
                    category: saveCategory,
                });
            }

            if (res.data?.offlineQueued) {
                alert(
                    res.data?.message ||
                        "Saved offline — will sync when you're back online."
                );
                setViewMode("viewed");
                setLastResponse(null);
            } else if (res.data?.success) {
                const newSub = res.data.data;
                const savedAnswers = withLogoPreviewFields(newSub?.answers || processedAnswers);

                // Transition immediately instead of showing a modal
                setEditingId(null);
                setSelectedForm(selectedForm);
                setActiveFormKind(inferFormDisplayKind(selectedForm, pageTitle));
                setFormValues(savedAnswers);
                setViewMode("viewed");
                setLastResponse(null);
                fetchSubmissions();
            }
        } catch (err) {
            console.error("Submission failed", err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to save form. Please try again.";
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeTemplateSave = async (
        asNew = false,
        name = "",
        tags = "",
        visibility = templateMetadata.visibility
    ) => {
        if (!selectedForm || !canEditTemplate) return;

        setIsSubmitting(true);
        try {
            let workingValues = { ...formValues };
            if (
                (activeFormKind === "concern" || activeFormKind === "weekly") &&
                !workingValues.report_heading?.trim()
            ) {
                workingValues.report_heading = selectedForm.title;
            }

            const processedAnswers = {};
            for (const [key, value] of Object.entries(workingValues)) {
                if (value instanceof File) {
                    processedAnswers[key] = await toBase64(value);
                } else if (!key.endsWith("_preview")) {
                    if (typeof value === "string" && value.startsWith("blob:")) {
                        continue;
                    }
                    if ((key === "logo" || key === "company_logo") && (value == null || value === "")) {
                        processedAnswers[key] = null;
                        continue;
                    }
                    processedAnswers[key] = value;
                }
            }

            let payload = appendTemplatesPageMetadata(
                {
                    ...processedAnswers,
                    name: name || templateMetadata.name,
                    tags: tags || templateMetadata.tags,
                },
                searchParams,
                pageTitle
            );
            payload = withGeneralFormVisibility(payload, visibility, { hasSiteContext: false });

            const savedId = await saveGeneralFormResponse({
                formTitle: pageTitle,
                persistedResponseId: editingId,
                asNew,
                payload,
                category: GENERAL_FORMS_CATEGORY,
            });

            if (savedId) {
                setTemplateSaveOpen(false);
                setTemplateMetadata({
                    name: payload.name,
                    tags: payload.tags,
                    visibility: payload.visibility ?? templateMetadata.visibility,
                });
                navigate(templatesPageListUrl());
            }
        } catch (err) {
            console.error("Template save failed", err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to save template. Please try again.";
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuccessClose = () => {
        setSuccessOpen(false);
        if (lastResponse) {
            setEditingId(null);
            setSelectedForm(lastResponse.formId);
            setActiveFormKind(inferFormDisplayKind(lastResponse.formId, pageTitle));
            setFormValues(lastResponse.answers);
            setViewMode("viewed");
            setLastResponse(null);
        } else {
            setViewMode("initial");
        }
    };

    const handleMenuClick = (event, item) => {
        setAnchorEl(event.currentTarget);
        setMenuItem(item);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setMenuItem(null);
    };

    const handleAction = (action) => {
        if (!menuItem) return;
        const item = menuItem;
        handleMenuClose();

        switch (action) {
            case "view":
                openSubmissionView(item, "viewed");
                break;
            case "edit":
                openSubmissionView(item, "editing");
                break;
            case "delete":
                setItemToDelete(item);
                setDeleteConfirmOpen(true);
                break;
            case "download":
                // Open and then download
                openSubmissionView(item, "viewed");
                setTimeout(() => {
                    alert("Please click the 'Download PDF' button in the viewer.");
                }, 500);
                break;
            case "email":
                setEmailingItem(item);
                setEmailDialogOpen(true);
                break;
            default:
                break;
        }
    };

    const openSubmissionView = async (sub, mode) => {
        try {
            // Prisma response has `formId` as string and `form` as object
            // Mongoose might have `formId` populated
            const formId = sub.form?.id || sub.formId?._id || sub.formId;

            if (!formId) {
                console.error("No form ID found in submission", sub);
                return;
            }

            let loadedForm = null;
            try {
                const formRes = await api.get(`/forms/${formId}`);
                if (formRes.data?.success) {
                    loadedForm = formRes.data.data;
                }
            } catch (e) {
                if (formId !== STATIC_CONCERN_FORM_ID) {
                    throw e;
                }
            }
            if (!loadedForm && formId === STATIC_CONCERN_FORM_ID) {
                const isWeekly =
                    pageTitle === "Weekly supervisor health & safety inspection" ||
                    pageTitle === "Weekly supervisor reports";
                loadedForm = {
                    id: STATIC_CONCERN_FORM_ID,
                    title: isWeekly ? pageTitle : concernDefaultTitle(pageTitle),
                    fields: [],
                };
            }
            if (loadedForm) {
                setSelectedForm(loadedForm);
                setActiveFormKind(inferFormDisplayKind(loadedForm, pageTitle));
                setFormValues(withLogoPreviewFields(sub.answers || {}));
                setEditingId(sub.id || sub._id);
                setLastResponse(sub);
                setViewMode(mode);
            } else {
                alert("Could not load this report. Please try again.");
            }
        } catch (e) {
            console.error("Could not load form definition", e);
            alert("Could not load this report. Please try again.");
        }
    };

    useEffect(() => {
        if (!urlResponseId) return;
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get(`/forms/responses/${urlResponseId}`);
                const body = res.data;
                if (cancelled || !body?.success || !body?.data) return;
                const sub = body.data;
                if (
                    isSitepackContext &&
                    !matchesSitepackScope(sub, { siteId, subfolderId })
                ) {
                    return;
                }
                await openSubmissionView(
                    sub,
                    isTemplatesPageEdit && canEditTemplate ? "editing" : "viewed"
                );
                if (isTemplatesPageEdit && sub.answers) {
                    setTemplateMetadata({
                        name: sub.answers.name || sub.name || "",
                        tags: sub.answers.tags || "",
                        visibility:
                            sub.answers.visibility || GENERAL_FORM_VISIBILITY.PRIVATE,
                    });
                }
            } catch (e) {
                console.error("Failed to open report from link", e);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [urlResponseId, pageTitle, isSitepackContext, siteId, subfolderId]);

    const autoCreateDoneRef = useRef(false);
    useEffect(() => {
        autoCreateDoneRef.current = false;
    }, [pageTitle]);

    useEffect(() => {
        if (!shouldAutoCreate || autoCreateDoneRef.current) return;
        autoCreateDoneRef.current = true;
        handleOpenConcernForm();
    }, [shouldAutoCreate, pageTitle]);

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        try {
            const itemId = itemToDelete.id || itemToDelete._id;
            await api.delete(`/forms/responses/${itemId}`);
            fetchSubmissions();
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
        } catch (e) {
            console.error(e);
            alert("Failed to delete");
        }
    };

    const handleDownloadPdf = async () => {
        if (!printRef.current || downloading) return;

        const safeTitle = (selectedForm?.title || pageTitle || "report")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-") || "report";
        const fileName = `report-${safeTitle}`;
        const isBuiltIn = activeFormKind === "concern" || activeFormKind === "weekly";

        setDownloading(true);
        try {
            let exportValues = formValues;
            if (isBuiltIn) {
                exportValues = await prepareConcernWeeklyPdfAssets(
                    formValues,
                    logoUrl,
                    activeFormKind
                );
            }

            flushSync(() => setPdfExportValues(exportValues));
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            await new Promise((resolve) => {
                const pdfOptions =
                    activeFormKind === "concern"
                        ? CONCERN_PDF_OPTIONS
                        : activeFormKind === "weekly"
                          ? WEEKLY_PDF_OPTIONS
                          : {
                              paginateBlocks: false,
                              blockScale: 1.75,
                              jpegQuality: 0.82,
                              maxOutputBytes: 5 * 1024 * 1024,
                              targetMaxBytes: 320_000,
                          };

                downloadPdfFromRef(
                    printRef,
                    fileName,
                    (err) => {
                        setDownloading(false);
                        setPdfExportValues(null);
                        if (err) {
                            alert("Could not generate PDF. Please try again.");
                        }
                        resolve();
                    },
                    pdfOptions
                );
            });
        } catch (err) {
            console.error("PDF generation failed", err);
            setDownloading(false);
            setPdfExportValues(null);
            alert("Could not generate PDF. Please try again.");
        }
    };

    const handleEmailSend = async () => {
        if (!recipientEmail || !emailingItem) return;
        try {
            const itemId = emailingItem.id || emailingItem._id;
            const res = await api.post(`/forms/responses/${itemId}/email`, { email: recipientEmail });
            if (res.data?.success) {
                alert("Email sent successfully!");
                setEmailDialogOpen(false);
                setRecipientEmail("");
                setEmailingItem(null);
            }
        } catch (e) {
            console.error(e);
            const msg = e.response?.data?.error || e.response?.data?.message || "Failed to send email";
            alert(`Error: ${msg}`);
        }
    };

    return (
        <Layout pageTitle={pageTitle} disablePadding={true}>
            <PageContent sx={{ flex: 1, height: "100%", overflowY: "auto" }}>
                <Box>
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", mb: 4, alignItems: { xs: "flex-start", sm: "center" }, gap: { xs: 2.5, sm: 0 } }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                            {(isSitepackContext && viewMode === "initial") ||
                            (isMonitoringContext && viewMode !== "initial") ||
                            (isTemplatesPageEdit && viewMode !== "initial") ? (
                                <IconButton
                                    onClick={() => {
                                        if (isTemplatesPageEdit) {
                                            navigate("/general-forms");
                                            return;
                                        }
                                        navigateBackToSitepack();
                                    }}
                                    sx={{ mt: -0.5, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                                    aria-label="Back"
                                >
                                    <ArrowBackIcon />
                                </IconButton>
                            ) : null}
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", }}>
                                    {isTemplatesPageEdit
                                        ? pageTitle
                                        : isSitepackContext
                                          ? pageTitle
                                          : `All Reports - ${pageTitle}`}
                                </Typography>
                                <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", mt: 0.5 }}>
                                    {isSitepackContext
                                        ? "Saved reports for this site subfolder."
                                        : getSubheading(pageTitle)}
                                </Typography>
                            </Box>
                        </Box>
                        {(viewMode !== "initial") && (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                {viewMode === "viewed" && (
                                    <Button 
                                        startIcon={<Download size={18} />} 
                                        variant="contained" 
                                        onClick={handleDownloadPdf}
                                        disabled={downloading}
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 4,
                                            px: 2.5,
                                            py: 0.8,
                                            fontWeight: 600,
                                            bgcolor: "#E89F17",
                                            color: "#FFFFFF",
                                            boxShadow: "none",
                                            "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" }
                                        }}
                                    >
                                        {downloading ? "Preparing PDF..." : "Download PDF"}
                                    </Button>
                                )}
                                {(viewMode === "filling" || viewMode === "editing") && (
                                    pageTitle === "Health & Safety concern" || 
                                    pageTitle === "Sustainability concern" || 
                                    pageTitle === "Quality concern" ||
                                    pageTitle === "Positive observation" ||
                                    pageTitle === "Weekly supervisor health & safety inspection" ||
                                    pageTitle === "Weekly supervisor reports"
                                ) && (
                                    <Button 
                                        variant="contained" 
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || (isTemplatesPageEdit && !canEditTemplate)}
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 4,
                                            px: 3,
                                            py: 1,
                                            bgcolor: "#EAB308",
                                            color: "#111827",
                                            fontWeight: 700,
                                            boxShadow: "none",
                                            "&:hover": { bgcolor: "#CA8A04", boxShadow: "none" },
                                            "&.Mui-disabled": { bgcolor: "rgba(234, 179, 8, 0.5)", color: "rgba(17, 24, 39, 0.5)" }
                                        }}
                                    >
                                        {isTemplatesPageEdit
                                            ? templateSaveButtonLabel({ saving: isSubmitting })
                                            : isSubmitting
                                              ? "Saving..."
                                              : viewMode === "editing"
                                                ? "Update Report"
                                                : "Save Report"}
                                    </Button>
                                )}
                                {!isTemplatesPageEdit && (
                                <Button 
                                    variant="outlined" 
                                    onClick={() => {
                                        if (isSitepackContext && viewMode === "viewed") {
                                            navigateBackToSitepack();
                                            return;
                                        }
                                        if (viewMode === "filling" || viewMode === "editing") {
                                            setViewMode("initial");
                                        } else if (viewMode === "viewed") {
                                            setViewMode("initial");
                                        }
                                    }}
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: 4,
                                        px: 2.5,
                                        py: 1,
                                        color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                        borderColor: isDarkMode ? "#4B5563" : "#D1D5DB",
                                        fontWeight: 600,
                                        "&:hover": { 
                                            bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "#F3F4F6", 
                                            borderColor: isDarkMode ? "#4B5563" : "#D1D5DB" 
                                        }
                                    }}
                                >
                                    Back to List
                                </Button>
                                )}
                            </Box>
                        )}
                        {viewMode === "initial" && (
                            <Box sx={{ display: "flex", gap: 2, flexWrap: 'wrap' }}>
                                {(pageTitle === "Health & Safety concern" || 
                                  pageTitle === "Sustainability concern" || 
                                  pageTitle === "Quality concern" || 
                                  pageTitle === "Positive observation" || 
                                  pageTitle === "Concern and positive feedback report" ||
                                  pageTitle === "Weekly supervisor health & safety inspection" ||
                                  pageTitle === "Weekly supervisor reports") && (
                                    <Button 
                                        variant="outlined" 
                                        onClick={handleOpenConcernForm}
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 4,
                                            px: 2.5,
                                            py: 1,
                                            color: "#E89F17",
                                            borderColor: "#E89F17",
                                            fontWeight: 600,
                                            "&:hover": { 
                                                borderColor: "#cc8b14", 
                                                bgcolor: isDarkMode ? "rgba(232, 159, 23, 0.1)" : "rgba(232, 159, 23, 0.05)" 
                                            }
                                        }}
                                    >
                                        {concernFormButtonLabel(pageTitle)}
                                    </Button>
                                )}
                                <Button 
                                    variant="contained" 
                                    onClick={() => setDialogOpen(true)}
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: 4,
                                        px: 2.5,
                                        py: 1,
                                        bgcolor: "#E89F17",
                                        color: "white",
                                        fontWeight: 600,
                                        boxShadow: "none",
                                        "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" }
                                    }}
                                >
                                    Choose Form
                                </Button>
                            </Box>
                        )}
                    </Box>

                    {isTemplatesPageEdit && viewMode !== "initial" && (
                        <GeneralFormTemplateInfoBanner
                            canEdit={canEditTemplate}
                            isSitePackContext={false}
                            pdfLayout={false}
                        />
                    )}

                    {viewMode === "initial" && !isTemplatesPageEdit && (
                        <Paper sx={{ width: '100%', mb: 2, borderRadius: 3, boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)", border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }}>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Sl No</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Form Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Date</TableCell>
                                            {showCreatorColumn && (
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Created by</TableCell>
                                            )}
                                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Status</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.75rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(() => {
                                            const filtered = submissions.filter((row) => {
                                                const title = getSubmissionTitle(row);
                                                return title.toLowerCase().includes(search.toLowerCase());
                                            });
                                            const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
                                            
                                            if (filtered.length === 0) {
                                                return <TableRow><TableCell colSpan={showCreatorColumn ? 6 : 5} align="center" sx={{ py: 4, color: isDarkMode ? "#9CA3AF" : "inherit", borderBottom: "none" }}>No submissions found.</TableCell></TableRow>;
                                            }

                                            return paginated.map((row, idx) => {
                                                const slNo = page * rowsPerPage + idx + 1;
                                                return (
                                                <TableRow key={row.id || row._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{slNo}</TableCell>
                                                    <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{getSubmissionTitle(row)}</TableCell>
                                                    <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                                                    {showCreatorColumn && (
                                                    <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.8rem", borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>{formatSubmitterDisplay(row.submittedBy)}</TableCell>
                                                    )}
                                                    <TableCell sx={{ borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}><Chip label="Submitted" color="success" size="small" sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', fontWeight: 500, border: 'none' }} /></TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>
                                                        <IconButton onClick={(e) => handleMenuClick(e, row)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            });
                                        })()}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 1 }}>
                                <TablePagination
                                    component="div"
                                    count={submissions.filter((row) => getSubmissionTitle(row).toLowerCase().includes(search.toLowerCase())).length}
                                    page={page}
                                    onPageChange={handleChangePage}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    rowsPerPageOptions={[5, 10, 25]}
                                    sx={{
                                        border: 'none',
                                        color: isDarkMode ? "#F9FAFB" : "inherit",
                                        '& .MuiTablePagination-actions': { color: isDarkMode ? "#F9FAFB" : "inherit" },
                                        '& .MuiTablePagination-select': { color: isDarkMode ? "#F9FAFB" : "inherit" },
                                        '& .MuiTablePagination-selectIcon': { color: isDarkMode ? "#9CA3AF" : "inherit" },
                                    }}
                                />
                            </Box>
                        </Paper>
                    )}

                    {(viewMode === "filling" || viewMode === "editing") && selectedForm && (
                        <Paper sx={{ 
                            p: activeFormKind === "builder" ? 4 : 0, 
                            borderRadius: 3, 
                            boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)", 
                            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", 
                            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                            overflow: 'hidden'
                        }}>
                            {activeFormKind === "weekly" ? (
                                <WeeklySupervisorInspectionForm
                                    values={formValues}
                                    onChange={handleFormChange}
                                    logoUrl={logoUrl}
                                    readOnly={isTemplatesPageEdit && !canEditTemplate}
                                />
                            ) : activeFormKind === "concern" ? (
                                <HealthSafetyConcernForm 
                                    values={formValues}
                                    onChange={handleFormChange}
                                    logoUrl={logoUrl}
                                    formType={concernFormTypeFromPageTitle(pageTitle)}
                                    readOnly={isTemplatesPageEdit && !canEditTemplate}
                                />
                            ) : (
                                <>
                                    <Typography variant="h6" gutterBottom sx={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>
                                        {viewMode === "editing" ? "Edit Report" : selectedForm.title || "New Report"}
                                    </Typography>
                                    <FormRenderer
                                        form={selectedForm}
                                        values={formValues}
                                        onChange={handleFormChange}
                                        onSubmit={handleSubmit}
                                        isSubmitting={isSubmitting}
                                        logoUrl={logoUrl}
                                    />
                                </>
                            )}
                        </Paper>
                    )}

                    {viewMode === "viewed" && selectedForm && (
                        <Box sx={{ width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', py: 4 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    width: activeFormKind === "concern" && downloading ? "794px" : "1000px",
                                    minHeight:
                                        activeFormKind === "concern" && downloading ? "auto" : "1414px",
                                    p: activeFormKind === "concern" && downloading ? "24px 28px" : "60px",
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxSizing: 'border-box',
                                    bgcolor: "#FFFFFF",
                                    color: "#000000",
                                    boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                                }}
                                ref={printRef}
                            >
                                {/* Form Content - Grows to push footer down */}
                                <Box sx={{ flex: 1, position: 'relative' }}>
                                    {activeFormKind === "weekly" ? (
                                        <WeeklySupervisorInspectionForm
                                            values={pdfExportValues ?? formValues}
                                            readOnly={true}
                                            logoUrl={logoUrl}
                                            pdfLayout={downloading}
                                        />
                                    ) : activeFormKind === "concern" ? (
                                        <HealthSafetyConcernForm 
                                            values={pdfExportValues ?? formValues}
                                            readOnly={true}
                                            logoUrl={logoUrl}
                                            formType={concernFormTypeFromPageTitle(pageTitle)}
                                            pdfLayout={downloading}
                                        />
                                    ) : (
                                        <>
                                            <Typography sx={{ position: 'absolute', top: 0, right: 0, fontWeight: 500, color: 'text.secondary', fontSize: '0.9rem' }}>
                                                Date: {lastResponse?.createdAt ? new Date(lastResponse.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                            </Typography>
                                            <FormRenderer
                                                form={selectedForm}
                                                values={formValues}
                                                readOnly={true}
                                                hideTitle={true}
                                            />
                                        </>
                                    )}
                                </Box>

                            </Paper>
                        </Box>
                    )}
                </Box>
            </PageContent>

            <FormSelectionDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSelect={handleSelectForm}
                variant="full"
            />

            <TemplatePreviewDialog
                open={templatePreviewOpen}
                url={templatePreviewUrl}
                onClose={() => {
                    setTemplatePreviewOpen(false);
                    setTemplatePreviewUrl("");
                }}
            />

            {/* Success Dialog */}
            <Dialog open={successOpen} maxWidth="xs" fullWidth>
                <DialogTitle>Success 🎉</DialogTitle>
                <DialogContent><Typography>Operation completed successfully.</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={handleSuccessClose} variant="contained">View Report</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Delete Report?</DialogTitle>
                <DialogContent>Are you sure you want to delete this report? This action cannot be undone.</DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Email Dialog */}
            <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
                <DialogTitle>Send Report by Email</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Recipient Email"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleEmailSend} variant="contained">Send</Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu 
                anchorEl={anchorEl} 
                open={Boolean(anchorEl)} 
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        borderRadius: 5,
                        mt: 1,
                        boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                        p: 1,
                        minWidth: 180,
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <MenuItem onClick={() => handleAction("view")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <Eye size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> View
                </MenuItem>
                <MenuItem onClick={() => handleAction("edit")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <Pencil size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => handleAction("delete")} sx={{ borderRadius: 2, py: 1, fontSize: "0.95rem", color: "#EF4444", "&:hover": { bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)" } }}>
                    <Trash2 size={18} style={{ marginRight: 12, color: "#EF4444" }} /> Delete
                </MenuItem>
            </Menu>
            <SaveChoiceDialog
                open={templateSaveOpen}
                onClose={() => setTemplateSaveOpen(false)}
                onSave={executeTemplateSave}
                existingId={editingId}
                defaultName={templateMetadata.name}
                defaultTags={templateMetadata.tags}
                defaultVisibility={templateMetadata.visibility}
                showVisibilityChoice
                saving={isSubmitting}
                templateFlow
                nameFieldLabel="Template name"
            />
        </Layout>
    );
}
