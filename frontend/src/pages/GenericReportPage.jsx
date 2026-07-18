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
    TextField,
    InputAdornment,
    Tabs,
    Tab
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import { Eye, Pencil, Download, FileText, Mail, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "../components/Layout";
import PageContent from "../components/PageContent";
import { formatSubmitterDisplay, showSubmissionCreatorColumn } from "../utils/submitterDisplay";
import { formatUserDisplayName } from "../utils/plainName";
import { useAuth } from "../context/AuthContext";
import FormSelectionDialog from "../components/FormSelectionDialog";
import TemplatePreviewDialog from "../components/TemplatePreviewDialog";
import FormRenderer from "../components/FormRenderer";
import HealthSafetyConcernForm from "../components/HealthSafetyConcernForm";
import WeeklySupervisorInspectionForm from "../components/WeeklySupervisorInspectionForm";
import api, {
    fetchActionTrackerItemByResponse,
    fetchAllFormResponsesList,
    fetchFormResponseById,
    reviewActionTrackerItem,
    sendActionTrackerItem,
    updateActionTrackerItem,
} from "../services/api";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import { withLogoPreviewFields } from "../utils/formLogoUrl";
import { downloadPdfFromRef, loadBrandLogos } from "../utils/pdfGenerator";
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
import { CONTEXTUAL_FORM_DONE, withEmbeddedFill } from "../utils/embeddedFormFill";
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
const NONCON_RESPONSE_TEXT_FIELDS = [
    "noncon_response_correction",
    "noncon_response_root_cause",
    "noncon_response_corrective_action",
];
const NONCON_RESPONSE_EVIDENCE_FIELDS = [
    "noncon_response_correction_evidence",
    "noncon_response_root_cause_evidence",
    "noncon_response_corrective_action_evidence",
];

/** PDF: paginate the concern report section-by-section (readable multi-page layout). */
const CONCERN_PDF_OPTIONS = {
    paginateBlocks: true,
    skipBuiltInFooter: false,
    useRunningHeader: true,
    marginX: 10,
    contentWidthRatio: 0.9,
    blockScale: 2,
    jpegQuality: 0.86,
    minJpegQuality: 0.6,
    maxOutputBytes: 5 * 1024 * 1024,
    targetMaxBytes: 1.5 * 1024 * 1024,
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
    return "Health and Safety Concern";
}

function concernFormTypeFromPageTitle(pageTitle) {
    if (pageTitle === "Sustainability concern") return "sustainability";
    if (pageTitle === "Quality concern") return "quality";
    if (pageTitle === "Positive observation") return "positive";
    return "health_safety";
}

// Concern pages get the All / Assigned to me / Raised by me tabs and open-closed status.
const CONCERN_TAB_PAGES = new Set([
    "Health & Safety concern",
    "Sustainability concern",
    "Quality concern",
]);

const CALENDAR_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseNonconDate(value) {
    const str = String(value || "").trim();
    if (!str) return null;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T00:00:00` : str);
    return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const DUE_SOON_WINDOW_DAYS = 7;

/** Month calendar of nonconformance target dates assigned to the current user. */
function ConcernScheduleCalendar({ items, isDarkMode, getTitle, isClosed, onOpen }) {
    const [monthStart, setMonthStart] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    // "all" | "overdue" | "notdue"
    const [dueFilter, setDueFilter] = useState("all");

    const borderColor = isDarkMode ? "#374151" : "#E5E7EB";
    const subColor = isDarkMode ? "#9CA3AF" : "#6B7280";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";

    const now = new Date();
    const todayStartForFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueSoonEnd = new Date(todayStartForFilter);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + DUE_SOON_WINDOW_DAYS);

    const isOverdueRow = (row) => {
        if (isClosed(row)) return false;
        const due = parseNonconDate(row?.answers?.noncon_date);
        return Boolean(due && due < todayStartForFilter);
    };
    const isDueSoonRow = (row) => {
        if (isClosed(row)) return false;
        const due = parseNonconDate(row?.answers?.noncon_date);
        return Boolean(due && due >= todayStartForFilter && due <= dueSoonEnd);
    };

    const matchesDueFilter = (row) => {
        if (dueFilter === "overdue") return isOverdueRow(row);
        if (dueFilter === "notdue") return !isClosed(row) && !isOverdueRow(row);
        return true;
    };

    const overdueItems = items
        .filter(isOverdueRow)
        .sort((a, b) => parseNonconDate(a?.answers?.noncon_date) - parseNonconDate(b?.answers?.noncon_date));
    const dueSoonItems = items
        .filter(isDueSoonRow)
        .sort((a, b) => parseNonconDate(a?.answers?.noncon_date) - parseNonconDate(b?.answers?.noncon_date));

    const filteredItems = items.filter(matchesDueFilter);

    const eventsByDay = {};
    filteredItems.forEach((row) => {
        const due = parseNonconDate(row?.answers?.noncon_date);
        if (!due) return;
        const key = calendarDayKey(due);
        if (!eventsByDay[key]) eventsByDay[key] = [];
        eventsByDay[key].push(row);
    });

    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first grid
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const today = new Date();
    const todayKey = calendarDayKey(today);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const shiftMonth = (delta) => {
        setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: textColor }}>
                    {monthLabel}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <IconButton size="small" onClick={() => shiftMonth(-1)} sx={{ border: `1px solid ${borderColor}`, borderRadius: 2, color: textColor }} aria-label="Previous month">
                        <ChevronLeft size={18} />
                    </IconButton>
                    <Button
                        size="small"
                        onClick={() => {
                            const now = new Date();
                            setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1));
                        }}
                        sx={{ textTransform: "none", color: "#E89F17", fontWeight: 600, minWidth: 0 }}
                    >
                        Today
                    </Button>
                    <IconButton size="small" onClick={() => shiftMonth(1)} sx={{ border: `1px solid ${borderColor}`, borderRadius: 2, color: textColor }} aria-label="Next month">
                        <ChevronRight size={18} />
                    </IconButton>
                </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 1.5 }}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {[
                        { value: "all", label: `All (${items.length})` },
                        { value: "overdue", label: `Overdue (${overdueItems.length})` },
                        { value: "notdue", label: `Not due (${items.filter((row) => !isClosed(row) && !isOverdueRow(row)).length})` },
                    ].map((option) => {
                        const active = dueFilter === option.value;
                        return (
                            <Chip
                                key={option.value}
                                label={option.label}
                                size="small"
                                onClick={() => setDueFilter(option.value)}
                                sx={{
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    bgcolor: active ? "#E89F17" : isDarkMode ? "#111722" : "#F3F4F6",
                                    color: active ? "#FFFFFF" : subColor,
                                    border: `1px solid ${active ? "#E89F17" : borderColor}`,
                                    "&:hover": { bgcolor: active ? "#D18E0C" : isDarkMode ? "#1B2432" : "#E5E7EB" },
                                }}
                            />
                        );
                    })}
                </Box>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {[{ label: "Open / due", color: "#EF4444" }, { label: "Closed", color: "#22C55E" }].map((item) => (
                        <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: item.color }} />
                            <Typography variant="caption" sx={{ color: subColor }}>{item.label}</Typography>
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexDirection: { xs: "column", md: "row" } }}>
            <Box sx={{ flex: 1, width: "100%", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: `1px solid ${borderColor}`, borderRadius: 2, overflow: "hidden" }}>
                {CALENDAR_WEEKDAYS.map((day) => (
                    <Box key={day} sx={{ px: 1, py: 0.75, textAlign: "center", bgcolor: isDarkMode ? "#111722" : "#F9FAFB", borderBottom: `1px solid ${borderColor}` }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: subColor, letterSpacing: "0.04em" }}>
                            {day.toUpperCase()}
                        </Typography>
                    </Box>
                ))}
                {cells.map((date, idx) => {
                    const key = date ? calendarDayKey(date) : `empty-${idx}`;
                    const events = date ? eventsByDay[key] || [] : [];
                    const isToday = date && key === todayKey;
                    return (
                        <Box
                            key={key}
                            sx={{
                                minHeight: { xs: 72, sm: 104 },
                                p: 0.75,
                                borderBottom: `1px solid ${borderColor}`,
                                borderRight: `1px solid ${borderColor}`,
                                "&:nth-of-type(7n)": { borderRight: "none" },
                                bgcolor: date ? "transparent" : isDarkMode ? "rgba(255,255,255,0.02)" : "#FAFAFA",
                            }}
                        >
                            {date ? (
                                <>
                                    <Box
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            mb: 0.5,
                                            bgcolor: isToday ? "#E89F17" : "transparent",
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontWeight: isToday ? 700 : 600, color: isToday ? "#FFFFFF" : subColor }}>
                                            {date.getDate()}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                        {events.map((row) => {
                                            const closed = isClosed(row);
                                            const overdue = !closed && date < todayStart;
                                            return (
                                                <Box
                                                    key={row.id || row._id}
                                                    onClick={() => onOpen(row)}
                                                    title={`${getTitle(row)} — ${closed ? "Closed" : overdue ? "Overdue" : "Open"}`}
                                                    sx={{
                                                        cursor: "pointer",
                                                        px: 0.75,
                                                        py: 0.25,
                                                        borderRadius: 1,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        lineHeight: 1.5,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        color: closed ? "#15803D" : "#B91C1C",
                                                        bgcolor: closed ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.14)",
                                                        border: overdue ? "1px solid rgba(239, 68, 68, 0.6)" : "1px solid transparent",
                                                        "&:hover": { filter: "brightness(0.95)" },
                                                    }}
                                                >
                                                    {getTitle(row)}
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </>
                            ) : null}
                        </Box>
                    );
                })}
            </Box>

            <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                    {
                        key: "overdue",
                        title: "Overdue",
                        rows: overdueItems,
                        accent: "#EF4444",
                        bg: isDarkMode ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.05)",
                        empty: "Nothing is overdue.",
                    },
                    {
                        key: "duesoon",
                        title: `Due soon (next ${DUE_SOON_WINDOW_DAYS} days)`,
                        rows: dueSoonItems,
                        accent: "#E89F17",
                        bg: isDarkMode ? "rgba(232, 159, 23, 0.08)" : "rgba(232, 159, 23, 0.06)",
                        empty: "Nothing is due soon.",
                    },
                ].map((panel) => (
                    <Box
                        key={panel.key}
                        sx={{
                            border: `1px solid ${borderColor}`,
                            borderTop: `3px solid ${panel.accent}`,
                            borderRadius: 2,
                            bgcolor: panel.bg,
                            overflow: "hidden",
                        }}
                    >
                        <Box sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: textColor }}>
                                {panel.title}
                            </Typography>
                            <Chip
                                label={panel.rows.length}
                                size="small"
                                sx={{ height: 20, fontWeight: 700, bgcolor: panel.accent, color: "#FFFFFF" }}
                            />
                        </Box>
                        {panel.rows.length === 0 ? (
                            <Typography variant="caption" sx={{ display: "block", px: 1.5, pb: 1.5, color: subColor }}>
                                {panel.empty}
                            </Typography>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
                                {panel.rows.map((row) => {
                                    const due = parseNonconDate(row?.answers?.noncon_date);
                                    return (
                                        <Box
                                            key={row.id || row._id}
                                            onClick={() => onOpen(row)}
                                            sx={{
                                                px: 1.5,
                                                py: 1,
                                                cursor: "pointer",
                                                borderTop: `1px solid ${borderColor}`,
                                                "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 600,
                                                    color: textColor,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {getTitle(row)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: panel.accent, fontWeight: 600 }}>
                                                {due ? due.toLocaleDateString() : ""}
                                                {panel.key === "overdue" && due
                                                    ? ` — ${Math.max(1, Math.round((todayStartForFilter - due) / 86400000))} day(s) overdue`
                                                    : ""}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}
                    </Box>
                ))}
            </Box>
            </Box>

            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: subColor, textAlign: "center", mt: 3, mb: 1 }}>
                    No nonconformances with a target date are assigned to you.
                </Typography>
            ) : filteredItems.length === 0 ? (
                <Typography variant="body2" sx={{ color: subColor, textAlign: "center", mt: 3, mb: 1 }}>
                    {dueFilter === "overdue"
                        ? "No overdue nonconformances."
                        : "No upcoming nonconformances for this filter."}
                </Typography>
            ) : null}
        </Box>
    );
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
    const { role, currentUser } = useAuth();
    const showCreatorColumn = showSubmissionCreatorColumn(role);
    const isConcernTabsPage = CONCERN_TAB_PAGES.has(pageTitle);
    // "all" | "assigned" (nonconformances assigned to me) | "raised" (reports I created)
    const [concernTab, setConcernTab] = useState("all");
    // Open/Closed filter for concern listings: "all" | "open" | "closed"
    const [statusFilter, setStatusFilter] = useState("all");
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("search") || "");
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
    const [assignedAction, setAssignedAction] = useState(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    // PDF Ref
    const printRef = useRef();
    const [downloading, setDownloading] = useState(false);
    const [pdfExportValues, setPdfExportValues] = useState(null);
    // Set from the list action menu ("pdf" | "word"); triggers a download once the report view renders
    const [pendingDownload, setPendingDownload] = useState(null);
    const menuDownloadRunningRef = useRef(false);
    // While a menu download is in progress the report renders off-screen and the UI keeps showing the list
    const silentExport = Boolean(pendingDownload);
    const uiViewMode = silentExport ? "initial" : viewMode;

    // Email State
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [emailingItem, setEmailingItem] = useState(null);
    const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
    const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
    const [templatePreviewUrl, setTemplatePreviewUrl] = useState("");
    const [formPanelOpen, setFormPanelOpen] = useState(false);
    const [formPanelUrl, setFormPanelUrl] = useState("");
    const [formPanelTitle, setFormPanelTitle] = useState("");
    const [templateMetadata, setTemplateMetadata] = useState({
        name: "",
        tags: "",
        visibility: GENERAL_FORM_VISIBILITY.PRIVATE,
    });

    const getSubmissionTitle = (row) =>
        row?.answers?.report_name?.trim() ||
        row?.answers?.project_name?.trim() ||
        row?.answers?.report_heading?.trim() ||
        row?.form?.title ||
        row?.formId?.title ||
        "Untitled";

    const matchesSearch = (row) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const title = getSubmissionTitle(row).toLowerCase();
        const date = row?.createdAt ? new Date(row.createdAt).toLocaleDateString().toLowerCase() : "";
        const creator = String(formatSubmitterDisplay(row?.submittedBy) || "").toLowerCase();
        return title.includes(query) || date.includes(query) || creator.includes(query);
    };

    const matchesStatusFilter = (row) => {
        if (!isConcernTabsPage || statusFilter === "all") return true;
        return statusFilter === "closed" ? isConcernClosed(row) : !isConcernClosed(row);
    };

    const currentUserId = String(currentUser?.id || currentUser?._id || "");
    const currentUserEmail = String(currentUser?.email || "").trim().toLowerCase();
    const currentUserName = formatUserDisplayName(currentUser).trim().toLowerCase().replace(/\s+/g, " ");

    // Every saved concern starts Open (red). It becomes Closed only when a later
    // edit stamps noncon_status = "closed" (nonconformance completed).
    const isConcernClosed = (row) => row?.answers?.noncon_status === "closed";

    // Match Responsible person by user id, email, or display name.
    const isAssignedToMe = (row) => {
        const answers = row?.answers || {};
        const assignedId = answers.noncon_responsible_user_id;
        if (assignedId && currentUserId && String(assignedId) === currentUserId) return true;

        const assignedEmail = String(answers.noncon_responsible_email || "").trim().toLowerCase();
        if (assignedEmail && currentUserEmail && assignedEmail === currentUserEmail) return true;

        const assignedName = String(answers.noncon_responsible || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
        if (
            assignedName &&
            currentUserName &&
            currentUserName !== "unknown" &&
            assignedName === currentUserName
        ) {
            return true;
        }
        return false;
    };

    const isRaisedByMe = (row) => {
        const submitterId = row?.submittedById || row?.submittedBy?.id;
        return Boolean(submitterId && currentUserId && String(submitterId) === currentUserId);
    };

    const matchesConcernTab = (row) => {
        if (!isConcernTabsPage) return true;
        if (concernTab === "assigned") return isAssignedToMe(row);
        if (concernTab === "raised") return isRaisedByMe(row);
        return true;
    };

    const assignedCount = isConcernTabsPage ? submissions.filter(isAssignedToMe).length : 0;
    const raisedCount = isConcernTabsPage ? submissions.filter(isRaisedByMe).length : 0;
    const scheduledItems = isConcernTabsPage
        ? submissions.filter((row) => isAssignedToMe(row) && parseNonconDate(row?.answers?.noncon_date))
        : [];
    const isAssignedResponseEdit =
        isConcernTabsPage &&
        concernTab === "assigned" &&
        viewMode === "editing" &&
        Boolean(lastResponse) &&
        isAssignedToMe(lastResponse);
    const isReporterReviewView =
        isConcernTabsPage &&
        concernTab === "raised" &&
        viewMode === "viewed" &&
        Boolean(lastResponse) &&
        isRaisedByMe(lastResponse) &&
        assignedAction?.status === "sent" &&
        assignedAction?.registerStatus !== "closed";


    const fetchSubmissions = useCallback(async () => {
        try {
            const params = { category: pageTitle };
            if (isSitepackContext && siteId) {
                params.siteId = siteId;
                if (subfolderId) {
                    params.subfolderId = subfolderId;
                }
            }
            const res = await fetchAllFormResponsesList(params);
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
        } else if (pageTitle) {
            // Keep Choose Form / catalog saves under this Reporting Concerns page category
            // so they list here instead of falling into "General forms".
            extra.category = pageTitle;
            const listPathByTitle = {
                "Health & Safety concern": "/report-health-safety",
                "Quality concern": "/report-quality",
                "Positive observation": "/report-positive",
                "Sustainability concern": "/report-environmental",
            };
            if (listPathByTitle[pageTitle]) {
                extra.listPath = listPathByTitle[pageTitle];
            }
        }
        return extra;
    };

    const openTemplatePreviewUrl = (url) => {
        if (!url) return;
        setTemplatePreviewUrl(url);
        setTemplatePreviewOpen(true);
        setDialogOpen(false);
    };

    const closeFormPanel = useCallback(() => {
        setFormPanelOpen(false);
        setFormPanelUrl("");
        setFormPanelTitle("");
        setViewMode("initial");
        fetchSubmissions();
    }, [fetchSubmissions]);

    const openFillPanel = useCallback((url, title) => {
        if (!url) return;
        setFormPanelTitle(title || "Fill form");
        setFormPanelUrl(withEmbeddedFill(url));
        setFormPanelOpen(true);
        setDialogOpen(false);
    }, []);

    useEffect(() => {
        const onMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== CONTEXTUAL_FORM_DONE) return;
            closeFormPanel();
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [closeFormPanel]);

    const handleSelectSavedTemplate = async (submission, { preview = false } = {}) => {
        const responseId = submission?.id || submission?._id;
        if (!responseId) return;

        try {
            // List/picker rows are compact — always load the full payload for media.
            const detail = await fetchFormResponseById(responseId);
            if (!detail?.success || !detail?.data) {
                alert("Could not load the selected template.");
                return;
            }
            const sub = detail.data;

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

                // Report concern modules: fill the built-in form on this page.
                if (template.type === "report") {
                    handleOpenConcernForm();
                    setDialogOpen(false);
                    return;
                }

                let url = null;
                if (template.type === "general") {
                    url = pathWithSearchParams(template.path, extra);
                } else if (template.type === "sheq") {
                    url = buildSheqFormUrl(template, extra);
                }

                if (url) {
                    openFillPanel(url, template.title || getSubmissionTitle(sub));
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
        // Stay on this Reporting Concerns page — don't navigate to Templates / other modules.
        if (template.type === "report") {
            handleOpenConcernForm();
            setDialogOpen(false);
            return;
        }
        const url = buildTemplateUseUrl(template, extra);
        if (!url) return;
        openFillPanel(url, template.title);
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
        submitReport();
    };

    const submitReport = async () => {
        if (!selectedForm) return;

        setIsSubmitting(true);
        try {
            let workingValues = { ...formValues };
            // The listing name comes from the form's project name; the form heading stays untouched.
            const projectName = String(workingValues.project_name || "").trim();
            if (projectName) {
                workingValues.report_name = projectName;
            }
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

            if (activeFormKind === "concern") {
                if (!processedAnswers.report_heading?.trim()) {
                    processedAnswers.report_heading =
                        selectedForm?.title || concernDefaultTitle(pageTitle);
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

            // Concern reports always start Open; they only become Closed when the
            // report is edited later with the nonconformance completion date filled in.
            if (isConcernTabsPage && activeFormKind === "concern") {
                const isEditSave = viewMode === "editing" && editingId;
                const dateCompleted = String(answersWithSitepack.noncon_date || "").trim();
                answersWithSitepack.noncon_status =
                    isEditSave && dateCompleted ? "closed" : "open";
            }

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
                const offlineData = res.data.data;
                if (offlineData) {
                    const savedAnswers = withLogoPreviewFields(offlineData.answers || processedAnswers);
                    setEditingId(offlineData.id || offlineData._id || editingId);
                    setFormValues(savedAnswers);
                }
                alert(res.data?.message || "Saved offline — will sync when you're back online.");
                setLastResponse(null);
                fetchSubmissions();
                if (isTemplatesPageEdit) {
                    setViewMode("viewed");
                } else {
                    setSelectedForm(null);
                    setActiveFormKind(null);
                    setFormValues({});
                    setEditingId(null);
                    setViewMode("initial");
                }
            } else if (res.data?.success) {
                const newSub = res.data.data;
                const savedAnswers = withLogoPreviewFields(newSub?.answers || processedAnswers);

                // Transition immediately instead of showing a modal
                setEditingId(null);
                setLastResponse(null);
                fetchSubmissions();
                // Return to the list so the new/updated row shows right away
                // (Templates library edits keep the form open for further edits).
                if (isTemplatesPageEdit) {
                    setSelectedForm(selectedForm);
                    setActiveFormKind(inferFormDisplayKind(selectedForm, pageTitle));
                    setFormValues(savedAnswers);
                    setViewMode("viewed");
                } else {
                    setSelectedForm(null);
                    setActiveFormKind(null);
                    setFormValues({});
                    setViewMode("initial");
                }
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

    const submitAssignedResponse = async (asDraft) => {
        if (!assignedAction) return;

        const missing = NONCON_RESPONSE_TEXT_FIELDS.some(
            (key) => !String(formValues[key] || "").trim()
        );
        if (!asDraft && missing) {
            alert("Complete all three nonconformance response fields before sending.");
            return;
        }

        setIsSubmitting(true);
        try {
            const details = {};
            for (const key of NONCON_RESPONSE_TEXT_FIELDS) {
                details[key] = String(formValues[key] || "").trim();
            }
            for (const evidenceKey of NONCON_RESPONSE_EVIDENCE_FIELDS) {
                const evidence = formValues[evidenceKey];
                if (evidence instanceof File) {
                    details[evidenceKey] = await toBase64(evidence);
                } else if (typeof evidence === "string" && !evidence.startsWith("blob:")) {
                    details[evidenceKey] = evidence;
                }
                for (const suffix of ["_name", "_description"]) {
                    const metadataKey = `${evidenceKey}${suffix}`;
                    if (formValues[metadataKey] != null) {
                        details[metadataKey] = formValues[metadataKey];
                    }
                }
            }

            const responseNotes = [
                `Correction completed: ${details.noncon_response_correction || "Not provided"}`,
                `Root cause: ${details.noncon_response_root_cause || "Not provided"}`,
                `Corrective action: ${details.noncon_response_corrective_action || "Not provided"}`,
            ].join("\n\n");

            const payload = { details, responseNotes };
            const result = asDraft
                ? await updateActionTrackerItem(assignedAction.id, {
                      ...payload,
                      asDraft: true,
                  })
                : await sendActionTrackerItem(assignedAction.id, payload);

            setAssignedAction(result.data);
            await fetchSubmissions();

            if (asDraft) {
                setFormValues((previous) => ({ ...previous, ...details }));
                alert("Draft saved.");
            } else {
                alert("Response saved and sent to the reporter.");
                setSelectedForm(null);
                setActiveFormKind(null);
                setFormValues({});
                setEditingId(null);
                setLastResponse(null);
                setAssignedAction(null);
                setViewMode("initial");
            }
        } catch (err) {
            alert(
                err?.response?.data?.message ||
                    (asDraft
                        ? "Could not save the draft."
                        : "Could not send the response to the reporter.")
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const reviewReporterResponse = async (decision) => {
        if (!assignedAction) return;
        const reason = rejectionReason.trim();
        if (decision === "reject" && !reason) {
            alert("Enter a reason for rejecting the response.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await reviewActionTrackerItem(
                assignedAction.id,
                decision,
                reason
            );
            await fetchSubmissions();
            alert(result.message);
            setRejectDialogOpen(false);
            setRejectionReason("");
            setSelectedForm(null);
            setActiveFormKind(null);
            setFormValues({});
            setEditingId(null);
            setLastResponse(null);
            setAssignedAction(null);
            setViewMode("initial");
        } catch (err) {
            alert(
                err?.response?.data?.message ||
                    "Could not review the nonconformance response."
            );
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
            case "download_pdf":
                setPendingDownload("pdf");
                openSubmissionView(item, "viewed");
                break;
            case "download_word":
                setPendingDownload("word");
                openSubmissionView(item, "viewed");
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
            const responseId = sub?.id || sub?._id;
            // List rows are compact (signatures/images stripped). Always load full detail.
            let fullSub = sub;
            if (responseId) {
                try {
                    const detail = await fetchFormResponseById(responseId);
                    if (detail?.success && detail?.data) {
                        fullSub = detail.data;
                    }
                } catch (detailErr) {
                    console.warn("Full form response load failed; using list row", detailErr);
                }
            }

            const formId =
                fullSub.form?.id ||
                fullSub.formId?._id ||
                fullSub.formId ||
                sub.form?.id ||
                sub.formId?._id ||
                sub.formId;

            if (!formId) {
                console.error("No form ID found in submission", fullSub);
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
                const openingAssignedResponse =
                    mode === "editing" &&
                    isConcernTabsPage &&
                    concernTab === "assigned" &&
                    isAssignedToMe(fullSub);
                const openingReporterReview =
                    mode === "viewed" &&
                    isConcernTabsPage &&
                    concernTab === "raised" &&
                    isRaisedByMe(fullSub);

                if (openingAssignedResponse || openingReporterReview) {
                    let action = null;
                    try {
                        const actionsResponse =
                            await fetchActionTrackerItemByResponse(responseId);
                        action = actionsResponse?.data || null;
                    } catch (actionError) {
                        if (openingAssignedResponse) throw actionError;
                    }
                    if (!action) {
                        if (openingAssignedResponse) {
                            alert("The nonconformance action for this report could not be found.");
                            return;
                        }
                        setAssignedAction(null);
                        setFormValues(withLogoPreviewFields(fullSub.answers || {}));
                    } else {
                        setAssignedAction(action);
                        setFormValues(
                            withLogoPreviewFields({
                                ...(fullSub.answers || {}),
                                ...(openingAssignedResponse ? action.details || {} : {}),
                            })
                        );
                    }
                } else {
                    setAssignedAction(null);
                    setFormValues(withLogoPreviewFields(fullSub.answers || {}));
                }
                setSelectedForm(loadedForm);
                setActiveFormKind(inferFormDisplayKind(loadedForm, pageTitle));
                setEditingId(fullSub.id || fullSub._id || responseId);
                setLastResponse(fullSub);
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

    const handleDownloadWord = async () => {
        if (!printRef.current || downloading) return;

        const safeTitle = (selectedForm?.title || pageTitle || "report")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-") || "report";
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

            const contentHtml = printRef.current.innerHTML;
            const docTitle = selectedForm?.title || pageTitle || "Report";

            // Same branded logos as the PDF header, embedded as data URLs.
            let logoHeaderHtml = "";
            try {
                const logos = await loadBrandLogos();
                if (logos?.left?.dataUrl || logos?.right?.dataUrl) {
                    const logoCell = (logo, align) =>
                        logo?.dataUrl
                            ? `<td style="width:50%;text-align:${align};vertical-align:middle;border:none;padding:0;"><img src="${logo.dataUrl}" style="height:40px;width:auto;" /></td>`
                            : `<td style="width:50%;border:none;padding:0;"></td>`;
                    logoHeaderHtml = `<table style="width:100%;border:none;border-collapse:collapse;margin-bottom:16px;"><tr>${logoCell(logos.left, "left")}${logoCell(logos.right, "right")}</tr></table>`;
                }
            } catch (logoErr) {
                console.warn("Could not embed header logos in Word export", logoErr);
            }

            const wordDocument = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${docTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
    @page { size: A4; margin: 20mm 15mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 12pt; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
</style>
</head>
<body>${logoHeaderHtml}${contentHtml}</body>
</html>`;

            const blob = new Blob(["\ufeff", wordDocument], { type: "application/msword" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `report-${safeTitle}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Word generation failed", err);
            alert("Could not generate Word document. Please try again.");
        } finally {
            setDownloading(false);
            setPdfExportValues(null);
        }
    };

    // From the list action menu: the report renders off-screen (list stays visible),
    // the download starts immediately, then the hidden report is torn down.
    useEffect(() => {
        if (!pendingDownload || viewMode !== "viewed" || !selectedForm || !printRef.current) return;
        if (menuDownloadRunningRef.current) return;
        menuDownloadRunningRef.current = true;
        const kind = pendingDownload;
        (async () => {
            try {
                if (kind === "word") {
                    await handleDownloadWord();
                } else {
                    await handleDownloadPdf();
                }
            } finally {
                menuDownloadRunningRef.current = false;
                setPendingDownload(null);
                setSelectedForm(null);
                setActiveFormKind(null);
                setFormValues({});
                setEditingId(null);
                setLastResponse(null);
                setViewMode("initial");
            }
        })();
    }, [pendingDownload, viewMode, selectedForm]);

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
                            {(isSitepackContext && uiViewMode === "initial") ||
                            (isMonitoringContext && uiViewMode !== "initial") ||
                            (isTemplatesPageEdit && uiViewMode !== "initial") ? (
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
                        {(uiViewMode !== "initial") && (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                {uiViewMode === "viewed" && (
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
                                {(viewMode === "filling" || viewMode === "editing") &&
                                !isAssignedResponseEdit && (
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
                                {isAssignedResponseEdit && (
                                    <>
                                        <Button
                                            variant="outlined"
                                            onClick={() => submitAssignedResponse(true)}
                                            disabled={isSubmitting}
                                            sx={{
                                                textTransform: "none",
                                                borderRadius: 4,
                                                px: 2.5,
                                                py: 1,
                                                color: "#E89F17",
                                                borderColor: "#E89F17",
                                                fontWeight: 700,
                                            }}
                                        >
                                            {isSubmitting ? "Saving..." : "Save as draft"}
                                        </Button>
                                        <Button
                                            variant="contained"
                                            onClick={() => submitAssignedResponse(false)}
                                            disabled={isSubmitting}
                                            sx={{
                                                textTransform: "none",
                                                borderRadius: 4,
                                                px: 2.5,
                                                py: 1,
                                                bgcolor: "#E89F17",
                                                color: "#FFFFFF",
                                                fontWeight: 700,
                                                boxShadow: "none",
                                                "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
                                            }}
                                        >
                                            {isSubmitting ? "Sending..." : "Save and send to reporter"}
                                        </Button>
                                    </>
                                )}
                                {isReporterReviewView && (
                                    <>
                                        <Button
                                            variant="contained"
                                            color="success"
                                            disabled={isSubmitting}
                                            onClick={() => reviewReporterResponse("accept")}
                                            sx={{ textTransform: "none", borderRadius: 4, fontWeight: 700 }}
                                        >
                                            Accept and close
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            disabled={isSubmitting}
                                            onClick={() => setRejectDialogOpen(true)}
                                            sx={{ textTransform: "none", borderRadius: 4, fontWeight: 700 }}
                                        >
                                            Reject and reopen
                                        </Button>
                                    </>
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
                        {uiViewMode === "initial" && (
                            <Box sx={{ display: "flex", gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                {silentExport && (
                                    <Typography variant="body2" sx={{ color: "#E89F17", fontWeight: 600 }}>
                                        Preparing download…
                                    </Typography>
                                )}
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
                                    Select Forms
                                </Button>
                            </Box>
                        )}
                    </Box>

                    {isTemplatesPageEdit && uiViewMode !== "initial" && (
                        <GeneralFormTemplateInfoBanner
                            canEdit={canEditTemplate}
                            isSitePackContext={false}
                            pdfLayout={false}
                        />
                    )}

                    {uiViewMode === "initial" && !isTemplatesPageEdit && (
                        <Paper sx={{ width: '100%', mb: 2, borderRadius: 3, boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0, 0, 0, 0.1)", border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF" }}>
                            {isConcernTabsPage && (
                                <Tabs
                                    value={concernTab}
                                    onChange={(event, next) => {
                                        setConcernTab(next);
                                        setPage(0);
                                    }}
                                    variant="scrollable"
                                    allowScrollButtonsMobile
                                    sx={{
                                        px: 2,
                                        borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                                        "& .MuiTab-root": {
                                            textTransform: "none",
                                            fontWeight: 600,
                                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                                            minHeight: 48,
                                        },
                                        "& .MuiTab-root.Mui-selected": { color: "#E89F17" },
                                        "& .MuiTabs-indicator": { bgcolor: "#E89F17" },
                                    }}
                                >
                                    <Tab value="all" label="All reports" />
                                    <Tab value="assigned" label={`Assigned to me (${assignedCount})`} />
                                    <Tab value="raised" label={`Raised by me (${raisedCount})`} />
                                    <Tab value="scheduled" label={`Scheduled (${scheduledItems.length})`} />
                                </Tabs>
                            )}
                            {isConcernTabsPage && concernTab === "scheduled" ? (
                                <ConcernScheduleCalendar
                                    items={scheduledItems}
                                    isDarkMode={isDarkMode}
                                    getTitle={getSubmissionTitle}
                                    isClosed={isConcernClosed}
                                    onOpen={(row) => openSubmissionView(row, "viewed")}
                                />
                            ) : (
                            <>
                            <Box sx={{ p: 2, pb: 1, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search reports by name, date or creator..."
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setPage(0);
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search size={18} color={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        maxWidth: 420,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 3,
                                            bgcolor: isDarkMode ? "#111722" : "#F9FAFB",
                                            color: isDarkMode ? "#F9FAFB" : "inherit",
                                            "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                                            "&:hover fieldset": { borderColor: "#E89F17" },
                                            "&.Mui-focused fieldset": { borderColor: "#E89F17" },
                                        },
                                        "& .MuiOutlinedInput-input::placeholder": {
                                            color: isDarkMode ? "#9CA3AF" : "#9CA3AF",
                                            opacity: 1,
                                        },
                                    }}
                                />
                                {isConcernTabsPage && (() => {
                                    const tabRows = submissions.filter(matchesConcernTab);
                                    const openCount = tabRows.filter((row) => !isConcernClosed(row)).length;
                                    const closedCount = tabRows.length - openCount;
                                    return (
                                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                            {[
                                                { value: "all", label: `All (${tabRows.length})`, activeColor: "#E89F17" },
                                                { value: "open", label: `Opened (${openCount})`, activeColor: "#EF4444" },
                                                { value: "closed", label: `Closed (${closedCount})`, activeColor: "#22C55E" },
                                            ].map((option) => {
                                                const active = statusFilter === option.value;
                                                return (
                                                    <Chip
                                                        key={option.value}
                                                        label={option.label}
                                                        size="small"
                                                        onClick={() => {
                                                            setStatusFilter(option.value);
                                                            setPage(0);
                                                        }}
                                                        sx={{
                                                            fontWeight: 600,
                                                            cursor: "pointer",
                                                            bgcolor: active ? option.activeColor : isDarkMode ? "#111722" : "#F3F4F6",
                                                            color: active ? "#FFFFFF" : isDarkMode ? "#9CA3AF" : "#6B7280",
                                                            border: `1px solid ${active ? option.activeColor : isDarkMode ? "#374151" : "#E5E7EB"}`,
                                                            "&:hover": { bgcolor: active ? option.activeColor : isDarkMode ? "#1B2432" : "#E5E7EB" },
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Box>
                                    );
                                })()}
                            </Box>
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
                                            const filtered = submissions.filter(matchesConcernTab).filter(matchesStatusFilter).filter(matchesSearch);
                                            const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
                                            
                                            if (filtered.length === 0) {
                                                const emptyMessage =
                                                    isConcernTabsPage && statusFilter !== "all"
                                                        ? `No ${statusFilter === "open" ? "opened" : "closed"} reports found.`
                                                        : isConcernTabsPage && concernTab === "assigned"
                                                        ? "No nonconformance reports are assigned to you."
                                                        : isConcernTabsPage && concernTab === "raised"
                                                        ? "You have not raised any reports yet."
                                                        : "No submissions found.";
                                                return <TableRow><TableCell colSpan={showCreatorColumn ? 6 : 5} align="center" sx={{ py: 4, color: isDarkMode ? "#9CA3AF" : "inherit", borderBottom: "none" }}>{emptyMessage}</TableCell></TableRow>;
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
                                                    <TableCell sx={{ borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>
                                                        {isConcernTabsPage ? (
                                                            isConcernClosed(row) ? (
                                                                <Chip label="Closed" size="small" sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', fontWeight: 500, border: 'none' }} />
                                                            ) : (
                                                                <Chip
                                                                    label={
                                                                        row?.answers?.noncon_response_decision === "rejected"
                                                                            ? "Rejected – Open"
                                                                            : "Open"
                                                                    }
                                                                    size="small"
                                                                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 500, border: 'none' }}
                                                                />
                                                            )
                                                        ) : (
                                                            <Chip label="Submitted" color="success" size="small" sx={{ bgcolor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', fontWeight: 500, border: 'none' }} />
                                                        )}
                                                    </TableCell>
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
                                    count={submissions.filter(matchesConcernTab).filter(matchesStatusFilter).filter(matchesSearch).length}
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
                            </>
                            )}
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
                                    formType={concernFormTypeFromPageTitle(pageTitle)}
                                    readOnly={isTemplatesPageEdit && !canEditTemplate}
                                    assignedResponseMode={isAssignedResponseEdit}
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
                        <Box
                            sx={{
                                width: '100%',
                                overflow: 'auto',
                                display: 'flex',
                                justifyContent: 'center',
                                py: 4,
                                // Menu downloads render the report off-screen so the list stays visible
                                ...(silentExport
                                    ? {
                                          position: 'fixed',
                                          top: 0,
                                          left: '-20000px',
                                          width: '1100px',
                                          overflow: 'visible',
                                          py: 0,
                                          zIndex: -1,
                                          pointerEvents: 'none',
                                      }
                                    : null),
                            }}
                        >
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

            <Dialog
                open={formPanelOpen}
                onClose={closeFormPanel}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        height: "min(90vh, 900px)",
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        fontWeight: 700,
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        pr: 1,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
                            {formPanelTitle}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", mt: 0.25 }}
                        >
                            Fill and save here — the form stays on this page
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, flex: 1, overflow: "hidden" }}>
                    {formPanelUrl ? (
                        <iframe
                            src={formPanelUrl}
                            title={formPanelTitle || "Form"}
                            style={{ border: "none", width: "100%", height: "100%" }}
                        />
                    ) : null}
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 3,
                        py: 2,
                        borderTop: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    }}
                >
                    <Button onClick={closeFormPanel} sx={{ textTransform: "none" }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

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

            <Dialog
                open={rejectDialogOpen}
                onClose={() => !isSubmitting && setRejectDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Reject and reopen nonconformance</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: "#6B7280" }}>
                        Explain why the response is being rejected. The responsible person will receive this reason by notification and email.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={4}
                        label="Reason for rejection"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        disabled={isSubmitting}
                        onClick={() => {
                            setRejectDialogOpen(false);
                            setRejectionReason("");
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        disabled={isSubmitting || !rejectionReason.trim()}
                        onClick={() => reviewReporterResponse("reject")}
                    >
                        {isSubmitting ? "Reopening..." : "Reject and reopen"}
                    </Button>
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
                <MenuItem onClick={() => handleAction("download_pdf")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <Download size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Download PDF
                </MenuItem>
                <MenuItem onClick={() => handleAction("download_word")} sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}>
                    <FileText size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Download Word
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
