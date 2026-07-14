import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Typography,
    Button,
    Paper,
    TextField,
    CircularProgress,
    IconButton,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useSearchParams } from "react-router-dom";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
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
import FormLogoHeaderColumn from "../components/FormLogoHeaderColumn";
import { formHeaderCenterColumnSx } from "../components/FormDocumentHeader";
import SaveChoiceDialog from "../components/SaveChoiceDialog";
import GeneralFormSubmissionDeleteButton from "../components/GeneralFormSubmissionDeleteButton";
import GeneralFormTemplateInfoBanner from "../components/GeneralFormTemplateInfoBanner";
import { useGeneralFormSaveNavigate } from "../hooks/useGeneralFormSaveNavigate";
import { appendTemplatesPageMetadata, templateSaveButtonLabel } from "../utils/templatePageContext";

const FORM_BASE_PATH = "/general-forms/alimak-weekly-check";
import SignatureCapture from "../components/SignatureCapture";

const FORM_TITLE = "Alimak Weekly Check";

const DAYS = ["MON", "TUE", "WED", "THUR", "FRI", "SAT", "SUN"];
const DAY_COL_WIDTH = 118;
const TABLE_MIN_WIDTH = 980;

function isSignatureImage(value) {
    return (
        value &&
        typeof value === "string" &&
        (value.startsWith("data:image/") ||
            value.startsWith("http://") ||
            value.startsWith("https://") ||
            value.startsWith("blob:"))
    );
}

const CHECKLIST_ITEMS = [
    "The hoist must have a valid safety certificate",
    "Visual inspection of the base for any damage",
    "Visual inspection of access and egress at base",
    "Visual inspection of machine guarding",
    "Visual inspection of hoist way for any obstructions",
    "Visual inspection of cables",
    "Visual inspection of mast for damage and missing bolts",
    "Visual inspection of hoist platform for any damage",
    "Check signage for SWL and ID number",
    "Check emergency evacuation tools are in place",
    "Physical check of control panel isolator and stop switch.",
    "Physical check of gate interlock if fitted",
    "Physical check of top and bottom limits",
    "Physical check of brake stopping distance in both directions",
];

const EMPTY_DAY_STATE = () =>
    Object.fromEntries(DAYS.map((d) => [d, false]));

const buildDefaultChecklist = () =>
    CHECKLIST_ITEMS.map((text, index) => ({
        id: index + 1,
        text,
        days: EMPTY_DAY_STATE(),
    }));

const buildDefaultSignatures = () => Object.fromEntries(DAYS.map((d) => [d, ""]));

export default function AlimakWeeklyCheckForm() {
    const logoUrl = useCompanyLogo();
    const { isDarkMode } = useTheme();
    const { persistedResponseId, seedSubmissionId, fromTemplateId } =
        useGeneralFormRouteSubmissionIds();
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

    const [headerLabels, setHeaderLabels] = useState({
        systemTitle: "Integrated Management System",
        formSubtitle: "Alimak Weekly Check",
        docNoLabel: "Doc. No.",
        revNoLabel: "Rev. No.",
        dateLabel: "Date:",
        pageLabel: "Page",
    });

    const [docInfo, setDocInfo] = useState({
        companyAddress: "",
        docNo: "",
        revNo: "",
        date: "",
        page: "",
        logoRight: "",
    });

    const [projectInfo, setProjectInfo] = useState({
        project: "",
        supervisor: "",
        serialNumber: "",
        installationTestDate: "",
        certNo: "",
        expiryDate: "",
    });

    const [weekInfo, setWeekInfo] = useState({
        weekEnding: "",
        liftNo: "",
    });

    const [checklist, setChecklist] = useState(buildDefaultChecklist);
    const [signatures, setSignatures] = useState(buildDefaultSignatures);
    const [persistedSiteId, setPersistedSiteId] = useState(null);
    const [persistedSubfolderId, setPersistedSubfolderId] = useState(null);

    const { canEdit, siteId, subfolderId, pdfLayout, contentReadOnly } =
        useGeneralFormTemplateAccess(
            action,
            downloading,
            persistedSiteId,
            persistedSubfolderId
        );
    const canFillFields = !contentReadOnly;
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
                headerLabels,
                docInfo,
                projectInfo,
                weekInfo,
                checklist,
                signatures,
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
        watchDeps: [
            headerLabels,
            docInfo,
            projectInfo,
            weekInfo,
            checklist,
            signatures,
        ],
        siteId,
        subfolderId,
        category,
        saving,
        canQuickSave: Boolean(persistedResponseId && formMetadata.name?.trim()),
        onQuickSave: () =>
            performSave(
                false,
                formMetadata.name,
                formMetadata.tags,
                formMetadata.visibility
            ),
        onOpenSaveDialog: () => setSaveDialogOpen(true),
    });

    useEffect(() => {
        if (!persistedResponseId && !fromTemplateId) {
            setPersistedSiteId(null);
            setPersistedSubfolderId(null);
        }
    }, [persistedResponseId, fromTemplateId]);

    useEffect(() => {
        if (seedSubmissionId) loadSubmission(seedSubmissionId);
    }, [seedSubmissionId]);

    useEffect(() => {
        const docKey = persistedResponseId || seedSubmissionId;
        if (!loading && action === "download" && docKey) {
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(
                    containerRef,
                    `AlimakWeeklyCheck_${docKey}`,
                    () => {
                        setDownloading(false);
                        window.close();
                    }
                );
            }, 300);
        }
    }, [loading, action, persistedResponseId, seedSubmissionId]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get(`/forms/responses/${submissionId}`);
            if (res.data?.success) {
                const submission = res.data.data;
                if (submission?.answers) {
                    const a = submission.answers;
                    setPersistedSiteId(a.siteId ?? null);
                    setPersistedSubfolderId(a.subfolderId ?? null);
                    if (a.headerLabels) setHeaderLabels(a.headerLabels);
                    if (a.docInfo) setDocInfo(a.docInfo);
                    if (a.projectInfo) setProjectInfo(a.projectInfo);
                    if (a.weekInfo) setWeekInfo(a.weekInfo);
                    if (a.checklist) setChecklist(a.checklist);
                    if (a.signatures) setSignatures(a.signatures);
                    setFormMetadata({
                        name:
                            a.name ||
                            `${FORM_TITLE} - ${new Date(submission.createdAt).toLocaleDateString()}`,
                        tags: a.tags || "",
                        visibility:
                            a.visibility || GENERAL_FORM_VISIBILITY.PRIVATE,
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

    const handleSaveClick = () => setSaveDialogOpen(true);

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

    const toggleDay = (rowIndex, day) => {
        if (contentReadOnly) return;
        setChecklist((rows) =>
            rows.map((row, i) =>
                i === rowIndex
                    ? {
                          ...row,
                          days: { ...row.days, [day]: !row.days[day] },
                      }
                    : row
            )
        );
    };

    const setSignatureForDay = (day, url) => {
        setSignatures((prev) => ({ ...prev, [day]: url || "" }));
    };

    const borderColor = isDarkMode ? "#374151" : "#CCC";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const headerBg = isDarkMode ? "rgba(255,255,255,0.06)" : "#F3F4F6";
    const cellPadding = "6px 8px";

    const CellField = ({ value, onChange, multiline = false }) =>
        contentReadOnly ? (
            <Typography
                sx={{
                    px: 1,
                    py: 0.75,
                    minHeight: "1.5em",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "0.85rem",
                }}
            >
                {value || " "}
            </Typography>
        ) : (
            <TextField
                fullWidth
                multiline={multiline}
                variant="standard"
                value={value}
                onChange={onChange}
                InputProps={{
                    disableUnderline: true,
                    sx: { color: textColor, px: 1, py: 0.5, fontSize: "0.85rem" },
                }}
            />
        );

    const LabelField = ({ labelKey, value, onChange, sx = {} }) =>
        contentReadOnly ? (
            <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", ...sx }}>
                {value}
            </Typography>
        ) : (
            <TextField
                fullWidth
                variant="standard"
                value={value}
                onChange={onChange}
                InputProps={{
                    disableUnderline: true,
                    sx: { fontWeight: 600, fontSize: "0.8rem", ...sx },
                }}
            />
        );

    const DayCheckbox = ({ checked, onClick }) => (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                cursor: contentReadOnly ? "default" : "pointer",
            }}
            onClick={contentReadOnly ? undefined : onClick}
        >
            {checked ? (
                <CheckBoxIcon fontSize="small" color="primary" />
            ) : (
                <CheckBoxOutlineBlankIcon
                    fontSize="small"
                    sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                />
            )}
        </Box>
    );

    if (loading) {
        return (
            <Layout>
                <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                    <CircularProgress />
                </Box>
            </Layout>
        );
    }

    const projectColumns = [
        { key: "project", label: "PROJECT" },
        { key: "supervisor", label: "SUPERVISOR" },
        { key: "serialNumber", label: "SERIAL NUMBER" },
        { key: "installationTestDate", label: "INSTALLATION TEST DATE:" },
        { key: "certNo", label: "CERT NO:" },
        { key: "expiryDate", label: "EXPIRY DATE:" },
    ];

    return (
        <Layout pageTitle={FORM_TITLE}>
            <Box
                sx={{
                    mb: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <IconButton
                    onClick={navigateBack}
                    sx={{ bgcolor: isDarkMode ? "#374151" : "#E5E7EB" }}
                >
                    <ArrowLeft
                        size={20}
                        color={isDarkMode ? "#F9FAFB" : "#111827"}
                    />
                </IconButton>
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
                                "&:hover": { bgcolor: "#cc8b14", boxShadow: "none" },
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

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    mb: 8,
                    overflowX: "auto",
                    px: { xs: 2, md: 0 },
                }}
            >
                <Paper
                    ref={containerRef}
                    elevation={pdfLayout ? 0 : 3}
                    sx={{
                        width: "100%",
                        minWidth: pdfLayout ? "1050px" : "100%",
                        maxWidth: "1050px",
                        p: { xs: 2, md: 4 },
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        color: textColor,
                        borderRadius: 2,
                        border: pdfLayout ? "1px solid #ccc" : "none",
                        fontFamily: "Arial, sans-serif",
                    }}
                >
                    {/* Fujitec-style header: address | metadata | logo */}
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: { xs: "wrap", md: "nowrap" },
                            border: `1px solid ${borderColor}`,
                            mb: 3,
                        }}
                    >
                        <Box
                            sx={{
                                width: { xs: "100%", md: "30%" },
                                flex: { xs: "1 1 100%", md: "0 0 30%" },
                                borderRight: `1px solid ${borderColor}`,
                                p: 1.5,
                                minHeight: 100,
                            }}
                        >
                            <CellField
                                multiline
                                value={docInfo.companyAddress}
                                onChange={(e) =>
                                    setDocInfo({ ...docInfo, companyAddress: e.target.value })
                                }
                            />
                        </Box>

                        <Box sx={formHeaderCenterColumnSx(borderColor)}>
                            <Box
                                sx={{
                                    p: 1,
                                    borderBottom: `1px solid ${borderColor}`,
                                    textAlign: "center",
                                }}
                            >
                                <LabelField
                                    labelKey="systemTitle"
                                    value={headerLabels.systemTitle}
                                    onChange={(e) =>
                                        setHeaderLabels({
                                            ...headerLabels,
                                            systemTitle: e.target.value,
                                        })
                                    }
                                    sx={{ textAlign: "center" }}
                                />
                                <LabelField
                                    labelKey="formSubtitle"
                                    value={headerLabels.formSubtitle}
                                    onChange={(e) =>
                                        setHeaderLabels({
                                            ...headerLabels,
                                            formSubtitle: e.target.value,
                                        })
                                    }
                                    sx={{ textAlign: "center", mt: 0.5 }}
                                />
                            </Box>
                            <Box sx={{ display: "flex", borderBottom: `1px solid ${borderColor}` }}>
                                <Box
                                    sx={{
                                        width: "25%",
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        bgcolor: headerBg,
                                    }}
                                >
                                    <LabelField
                                        labelKey="docNoLabel"
                                        value={headerLabels.docNoLabel}
                                        onChange={(e) =>
                                            setHeaderLabels({
                                                ...headerLabels,
                                                docNoLabel: e.target.value,
                                            })
                                        }
                                    />
                                </Box>
                                <Box sx={{ width: "25%", borderRight: `1px solid ${borderColor}` }}>
                                    <CellField
                                        value={docInfo.docNo}
                                        onChange={(e) =>
                                            setDocInfo({ ...docInfo, docNo: e.target.value })
                                        }
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        width: "25%",
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        bgcolor: headerBg,
                                    }}
                                >
                                    <LabelField
                                        labelKey="revNoLabel"
                                        value={headerLabels.revNoLabel}
                                        onChange={(e) =>
                                            setHeaderLabels({
                                                ...headerLabels,
                                                revNoLabel: e.target.value,
                                            })
                                        }
                                    />
                                </Box>
                                <Box sx={{ width: "25%" }}>
                                    <CellField
                                        value={docInfo.revNo}
                                        onChange={(e) =>
                                            setDocInfo({ ...docInfo, revNo: e.target.value })
                                        }
                                    />
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex" }}>
                                <Box
                                    sx={{
                                        width: "25%",
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        bgcolor: headerBg,
                                    }}
                                >
                                    <LabelField
                                        labelKey="dateLabel"
                                        value={headerLabels.dateLabel}
                                        onChange={(e) =>
                                            setHeaderLabels({
                                                ...headerLabels,
                                                dateLabel: e.target.value,
                                            })
                                        }
                                    />
                                </Box>
                                <Box sx={{ width: "25%", borderRight: `1px solid ${borderColor}` }}>
                                    <CellField
                                        value={docInfo.date}
                                        onChange={(e) =>
                                            setDocInfo({ ...docInfo, date: e.target.value })
                                        }
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        width: "25%",
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        bgcolor: headerBg,
                                    }}
                                >
                                    <LabelField
                                        labelKey="pageLabel"
                                        value={headerLabels.pageLabel}
                                        onChange={(e) =>
                                            setHeaderLabels({
                                                ...headerLabels,
                                                pageLabel: e.target.value,
                                            })
                                        }
                                    />
                                </Box>
                                <Box sx={{ width: "25%" }}>
                                    <CellField
                                        value={docInfo.page}
                                        onChange={(e) =>
                                            setDocInfo({ ...docInfo, page: e.target.value })
                                        }
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <FormLogoHeaderColumn
                            side="right"
                            imageSrc={docInfo.logoRight}
                            companyLogoUrl={logoUrl}
                            onImageChange={(url) =>
                                setDocInfo((prev) => ({ ...prev, logoRight: url }))
                            }
                            readOnly={contentReadOnly}
                            exportMode={pdfLayout}
                            borderColor={borderColor}
                        />
                    </Box>

                    <Typography
                        align="center"
                        sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 2 }}
                    >
                        ALIMAK WEEKLY CHECK
                    </Typography>

                    {/* Project info columns */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 2 }}>
                        <Box sx={{ display: "flex", flexWrap: { xs: "wrap", md: "nowrap" } }}>
                            {projectColumns.map((col, idx) => (
                                <Box
                                    key={col.key}
                                    sx={{
                                        flex: 1,
                                        minWidth: { xs: "50%", md: 0 },
                                        borderRight:
                                            idx < projectColumns.length - 1
                                                ? `1px solid ${borderColor}`
                                                : "none",
                                        borderBottom: `1px solid ${borderColor}`,
                                        bgcolor: headerBg,
                                        p: cellPadding,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: "0.7rem",
                                            textAlign: "center",
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {col.label}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ display: "flex", flexWrap: { xs: "wrap", md: "nowrap" } }}>
                            {projectColumns.map((col, idx) => (
                                <Box
                                    key={col.key}
                                    sx={{
                                        flex: 1,
                                        minWidth: { xs: "50%", md: 0 },
                                        borderRight:
                                            idx < projectColumns.length - 1
                                                ? `1px solid ${borderColor}`
                                                : "none",
                                    }}
                                >
                                    <CellField
                                        value={projectInfo[col.key]}
                                        onChange={(e) =>
                                            setProjectInfo({
                                                ...projectInfo,
                                                [col.key]: e.target.value,
                                            })
                                        }
                                    />
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 2,
                            mb: 2,
                            alignItems: "center",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                                WEEK ENDING: Sunday
                            </Typography>
                            <Box sx={{ minWidth: 160 }}>
                                <CellField
                                    value={weekInfo.weekEnding}
                                    onChange={(e) =>
                                        setWeekInfo({ ...weekInfo, weekEnding: e.target.value })
                                    }
                                />
                            </Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                                Lift No.
                            </Typography>
                            <Box sx={{ minWidth: 120 }}>
                                <CellField
                                    value={weekInfo.liftNo}
                                    onChange={(e) =>
                                        setWeekInfo({ ...weekInfo, liftNo: e.target.value })
                                    }
                                />
                            </Box>
                        </Box>
                    </Box>

                    {/* Weekly checklist */}
                    <Box sx={{ border: `1px solid ${borderColor}`, overflowX: "auto", mb: 2 }}>
                        <Box
                            sx={{
                                display: "flex",
                                minWidth: TABLE_MIN_WIDTH,
                                bgcolor: headerBg,
                                borderBottom: `1px solid ${borderColor}`,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 36,
                                    p: cellPadding,
                                    borderRight: `1px solid ${borderColor}`,
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                }}
                            >
                                Item
                            </Box>
                            <Box
                                sx={{
                                    flex: 1,
                                    p: cellPadding,
                                    borderRight: `1px solid ${borderColor}`,
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                }}
                            >
                                Checking List
                            </Box>
                            {DAYS.map((day) => (
                                <Box
                                    key={day}
                                    sx={{
                                        width: DAY_COL_WIDTH,
                                        flexShrink: 0,
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        fontWeight: 700,
                                        fontSize: "0.65rem",
                                        textAlign: "center",
                                    }}
                                >
                                    {day}
                                </Box>
                            ))}
                        </Box>

                        {checklist.map((row, rowIndex) => (
                            <Box
                                key={row.id}
                                sx={{
                                    display: "flex",
                                    minWidth: TABLE_MIN_WIDTH,
                                    borderBottom: `1px solid ${borderColor}`,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 36,
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        fontSize: "0.8rem",
                                        textAlign: "center",
                                    }}
                                >
                                    {row.id}
                                </Box>
                                <Box
                                    sx={{
                                        flex: 1,
                                        p: cellPadding,
                                        borderRight: `1px solid ${borderColor}`,
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    {row.text}
                                </Box>
                                {DAYS.map((day) => (
                                    <Box
                                        key={day}
                                        sx={{
                                            width: DAY_COL_WIDTH,
                                            flexShrink: 0,
                                            borderRight: `1px solid ${borderColor}`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <DayCheckbox
                                            checked={Boolean(row.days?.[day])}
                                            onClick={() => toggleDay(rowIndex, day)}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        ))}

                        <Box sx={{ display: "flex", minWidth: TABLE_MIN_WIDTH }}>
                            <Box
                                sx={{
                                    width: 36,
                                    p: cellPadding,
                                    borderRight: `1px solid ${borderColor}`,
                                }}
                            />
                            <Box
                                sx={{
                                    flex: 1,
                                    p: cellPadding,
                                    borderRight: `1px solid ${borderColor}`,
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                }}
                            >
                                Signature
                            </Box>
                            {DAYS.map((day) => (
                                <Box
                                    key={day}
                                    sx={{
                                        width: DAY_COL_WIDTH,
                                        flexShrink: 0,
                                        borderRight: `1px solid ${borderColor}`,
                                        p: 0.5,
                                        minHeight: 88,
                                        verticalAlign: "top",
                                    }}
                                >
                                    {canFillFields ? (
                                        <SignatureCapture
                                            value={
                                                isSignatureImage(signatures[day])
                                                    ? signatures[day]
                                                    : null
                                            }
                                            onChange={(url) =>
                                                setSignatureForDay(day, url)
                                            }
                                            readOnly={false}
                                            compact
                                            savedLibraryEnabled
                                            helperText=""
                                        />
                                    ) : isSignatureImage(signatures[day]) ? (
                                        <SignatureCapture
                                            value={signatures[day]}
                                            onChange={() => {}}
                                            readOnly
                                            compact
                                        />
                                    ) : (
                                        <Typography
                                            sx={{
                                                px: 0.5,
                                                py: 0.75,
                                                fontSize: "0.75rem",
                                                minHeight: "1.5em",
                                            }}
                                        >
                                            {signatures[day] || " "}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    <Typography
                        sx={{
                            fontSize: "0.65rem",
                            color: isDarkMode ? "#9CA3AF" : "#6B7280",
                            lineHeight: 1.4,
                            mt: 2,
                        }}
                    >
                        The electronic version of this document is the latest revision. It is the
                        responsibility of the individual to ensure that any paper material is the
                        current revision. The printed version of this document is uncontrolled.
                    </Typography>
                </Paper>
            </Box>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                defaultName={
                    formMetadata.name ||
                    `${FORM_TITLE} - ${new Date().toLocaleDateString()}`
                }
                defaultTags={formMetadata.tags}
                defaultVisibility={formMetadata.visibility}
                existingId={persistedResponseId}
                isSitePackContext={Boolean(siteId)}
                nameFieldLabel={siteId ? "Form name" : "Form Name"}
            />
            {UnsavedDialog}
        </Layout>
    );
}
