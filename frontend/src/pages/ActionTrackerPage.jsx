import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Divider,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  TablePagination,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Eye, Pencil, Send, Download, MoreHorizontal } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import Layout from "../components/Layout";
import PageContent from "../components/PageContent";
import { useTheme } from "../context/ThemeContext";
import {
  fetchActionTrackerItem,
  fetchActionTrackerItems,
  sendActionTrackerItem,
  updateActionTrackerItem,
  updateActionTrackerRegisterStatus,
} from "../services/api";
import {
  ACTION_TRACKER_FIELD_SECTIONS,
  actionToFormValues,
  formValuesToUpdatePayload,
} from "../constants/actionTrackerFields";
import { downloadPdfFromRef } from "../utils/pdfGenerator";

const MAIN_TABS = [
  { id: "list", label: "Register (List)" },
  { id: "graphs", label: "Register (Graphs)" },
  { id: "detail", label: "NCR Detail — Manage Finding" },
  { id: "schedule", label: "Schedule — NCR Due Dates" },
];

const CHART_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"];

const REGISTER_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

function statusChip(status) {
  switch (status) {
    case "sent":
      return { label: "Sent", color: "success" };
    case "draft":
      return { label: "Draft", color: "warning" };
    default:
      return { label: "Pending", color: "info" };
  }
}

function registerStatusChip(registerStatus) {
  switch (registerStatus) {
    case "closed":
      return { label: "CLOSED", color: "#6B7280", bg: "#F3F4F6" };
    case "accepted":
      return { label: "ACCEPTED", color: "#047857", bg: "#D1FAE5" };
    case "rejected":
      return { label: "REJECTED", color: "#B91C1C", bg: "#FEE2E2" };
    default:
      return { label: "OPEN", color: "#1D4ED8", bg: "#DBEAFE" };
  }
}

function formatNcrNumber(row) {
  const token = String(row?.id || "").replace(/-/g, "").slice(0, 6).toUpperCase();
  return token ? `NCR-${token}` : "NCR";
}

function resolveSeverity(row) {
  const d = row?.details || {};
  return (
    d.severity ||
    d.noncon_severity ||
    d.nonconformance_severity ||
    (d.incidents?.length ? "Major Nonconformance" : "") ||
    "—"
  );
}

function resolveStandard(row) {
  const d = row?.details || {};
  return d.standard || d.standard_category || d.category || "—";
}

function resolveSiteDepartment(row) {
  const d = row?.details || {};
  const site = d.site_name || d.project_name || row?.title || "";
  const dept = d.department || d.exact_location || d.full_address || "";
  if (site && dept) return `${site} — ${dept}`;
  return site || dept || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseDateValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Target due date: explicit completion date, report date, or 14 days from creation. */
function resolveDueDate(item) {
  const completed = parseDateValue(item?.dateCompleted);
  if (completed) return completed;
  const fromDetails = parseDateValue(item?.details?.noncon_date);
  if (fromDetails) return fromDetails;
  const reportDate = parseDateValue(item?.details?.report_date);
  if (reportDate) {
    const due = new Date(reportDate);
    due.setDate(due.getDate() + 14);
    return due;
  }
  const created = parseDateValue(item?.createdAt);
  if (!created) return null;
  const due = new Date(created);
  due.setDate(due.getDate() + 14);
  return due;
}

function FieldDisplay({ field, value }) {
  if (field.type === "textarea") {
    return (
      <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.25 }}>
        {value || "—"}
      </Typography>
    );
  }
  return <Typography sx={{ mt: 0.25 }}>{value || "—"}</Typography>;
}

function ActionFormBody({ formValues, editable, onChange }) {
  return (
    <Box>
      {ACTION_TRACKER_FIELD_SECTIONS.map((section, sectionIdx) => (
        <Box key={section.heading || `section-${sectionIdx}`} sx={{ mb: 3 }}>
          {section.heading ? (
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, color: "#0B4DA6", mb: 1.5 }}
            >
              {section.heading}
            </Typography>
          ) : null}
          {section.fields.map((field) => {
            const value = formValues[field.id] ?? "";
            const readOnly = !editable || field.readOnlyInEdit;
            return (
              <Box key={field.id} sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}
                >
                  {field.label}
                </Typography>
                {readOnly ? (
                  <FieldDisplay field={field} value={value} />
                ) : field.type === "textarea" ? (
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={value}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    sx={{ mt: 0.5 }}
                  />
                ) : (
                  <TextField
                    fullWidth
                    type={field.type === "date" ? "date" : "text"}
                    value={value}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    InputLabelProps={field.type === "date" ? { shrink: true } : undefined}
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      ))}

      {Array.isArray(formValues.incidents) && formValues.incidents.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}
          >
            Incident classification
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {formValues.incidents.map((inc) => (
              <Chip key={inc} size="small" label={inc} />
            ))}
          </Box>
          {formValues.incidents_other ? (
            <Typography variant="body2" sx={{ mt: 1, color: "#64748b" }}>
              Other: {formValues.incidents_other}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function ActionPrintView({ action, formValues }) {
  if (!action) return null;
  return (
    <Box
      sx={{
        fontFamily: "'Inter', sans-serif",
        color: "#1e293b",
        p: 2,
        bgcolor: "#fff",
      }}
    >
      <Box data-pdf-block sx={{ mb: 2, pb: 1, borderBottom: "2px solid #0B4DA6" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0B4DA6" }}>
          {action.title || "Nonconformance report"}
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Reported by {action.reporter?.name || "—"} · {formatDate(action.createdAt)}
        </Typography>
        <Chip
          size="small"
          label={statusChip(action.status).label}
          color={statusChip(action.status).color}
          sx={{ mt: 1 }}
        />
      </Box>

      {ACTION_TRACKER_FIELD_SECTIONS.map((section, sectionIdx) => (
        <Box key={section.heading || `section-${sectionIdx}`} data-pdf-block sx={{ mb: 2 }}>
          {section.heading ? (
            <Typography sx={{ fontWeight: 700, color: "#0B4DA6", mb: 1 }}>
              {section.heading}
            </Typography>
          ) : null}
          {section.fields.map((field) => (
            <Box key={field.id} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#64748b" }}>
                {field.label}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {formValues[field.id] || "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}

      {action.responseNotes ? (
        <Box data-pdf-block sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, color: "#0B4DA6", mb: 1 }}>
            Assignee response
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {action.responseNotes}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function RegisterListTab({
  items,
  loading,
  isDarkMode,
  headingColor,
  subColor,
  borderColor,
  downloading,
  statusFilter,
  onStatusFilterChange,
  onOpenItem,
  onDownloadMenu,
  onRegisterStatusChange,
  statusUpdatingId,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [actionMenu, setActionMenu] = useState({ anchor: null, row: null });

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((row) => (row.registerStatus || "open") === statusFilter);
  }, [items, statusFilter]);

  const pagedItems = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, items.length]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#E89F17" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: subColor,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            flex: 1,
            minWidth: 220,
          }}
        >
          Nonconformance register — findings assigned to you or reported by you
        </Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="ncr-status-filter">Status</InputLabel>
          <Select
            labelId="ncr-status-filter"
            label="Status"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            {REGISTER_STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {filteredItems.length === 0 ? (
        <Box sx={{ py: 8, px: 3, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, color: headingColor, mb: 0.5 }}>
            No nonconformances found
          </Typography>
          <Typography sx={{ color: subColor, fontSize: "0.9rem" }}>
            Reports you submit or receive as the responsible person will appear here.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F9FAFB" }}>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>NCR #</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Standard / Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Site &amp; Department</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>Open date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: subColor, fontSize: "0.75rem" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedItems.map((row) => {
                  const reg = registerStatusChip(row.registerStatus || "open");
                  const workflow = statusChip(row.status);
                  const isUpdating = statusUpdatingId === row.id;
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Button
                          variant="text"
                          onClick={() => onOpenItem(row.id, "view")}
                          sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            color: "#2563EB",
                            p: 0,
                            minWidth: 0,
                          }}
                        >
                          {formatNcrNumber(row)}
                        </Button>
                      </TableCell>
                      <TableCell sx={{ color: headingColor, fontWeight: 600 }}>
                        {row.details?.project_name || row.title || "—"}
                      </TableCell>
                      <TableCell sx={{ color: subColor }}>{resolveStandard(row)}</TableCell>
                      <TableCell sx={{ color: subColor, maxWidth: 220 }}>
                        {resolveSiteDepartment(row)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={resolveSeverity(row)}
                          variant="outlined"
                          sx={{ fontSize: "0.7rem", maxWidth: 180 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={reg.label}
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            color: reg.color,
                            bgcolor: reg.bg,
                            border: `1px solid ${reg.color}33`,
                          }}
                        />
                        {row.status !== "pending" ? (
                          <Chip
                            size="small"
                            label={workflow.label}
                            color={workflow.color}
                            sx={{ ml: 0.5, fontSize: "0.65rem" }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ color: subColor, whiteSpace: "nowrap" }}>
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="View finding">
                          <IconButton size="small" onClick={() => onOpenItem(row.id, "view")}>
                            <Eye size={16} />
                          </IconButton>
                        </Tooltip>
                        {row.isAssignee && row.status !== "sent" ? (
                          <Tooltip title="Edit response">
                            <IconButton size="small" onClick={() => onOpenItem(row.id, "edit")}>
                              <Pencil size={16} />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        <Tooltip title="More actions">
                          <IconButton
                            size="small"
                            disabled={isUpdating}
                            onClick={(e) => setActionMenu({ anchor: e.currentTarget, row })}
                          >
                            <MoreHorizontal size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredItems.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </>
      )}

      <Menu
        anchorEl={actionMenu.anchor}
        open={Boolean(actionMenu.anchor)}
        onClose={() => setActionMenu({ anchor: null, row: null })}
      >
        {["open", "closed", "accepted", "rejected"].map((status) => (
          <MenuItem
            key={status}
            disabled={
              !actionMenu.row ||
              statusUpdatingId === actionMenu.row.id ||
              (actionMenu.row.registerStatus || "open") === status
            }
            onClick={() => {
              if (actionMenu.row) {
                onRegisterStatusChange(actionMenu.row.id, status);
              }
              setActionMenu({ anchor: null, row: null });
            }}
            sx={{ textTransform: "capitalize" }}
          >
            {status}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={(e) => {
            if (actionMenu.row) onDownloadMenu(e, actionMenu.row);
            setActionMenu({ anchor: null, row: null });
          }}
        >
          Download PDF
        </MenuItem>
      </Menu>
    </Box>
  );
}

function RegisterGraphsTab({ items, headingColor, subColor, borderColor }) {
  const statusData = useMemo(() => {
    const counts = { Open: 0, Closed: 0, Accepted: 0, Rejected: 0 };
    items.forEach((row) => {
      const chip = registerStatusChip(row.registerStatus || "open");
      const key = chip.label.charAt(0) + chip.label.slice(1).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [items]);

  const monthlyData = useMemo(() => {
    const buckets = {};
    items.forEach((row) => {
      const d = new Date(row.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [items]);

  if (items.length === 0) {
    return (
      <Box sx={{ py: 8, px: 3, textAlign: "center" }}>
        <Typography sx={{ color: subColor }}>No data to chart yet.</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3} sx={{ p: 2 }}>
      <Grid item xs={12} md={5}>
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, borderColor, height: 320 }}
        >
          <Typography sx={{ fontWeight: 700, color: headingColor, mb: 2 }}>
            Status breakdown
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
      <Grid item xs={12} md={7}>
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, borderColor, height: 320 }}
        >
          <Typography sx={{ fontWeight: 700, color: headingColor, mb: 2 }}>
            Reports by month
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );
}

function ScheduleTab({ items, headingColor, subColor, borderColor, onOpenItem }) {
  const rows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return items
      .map((item) => {
        const due = resolveDueDate(item);
        const overdue = due ? due < today && item.status !== "sent" : false;
        return { item, due, overdue };
      })
      .sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due - b.due;
      });
  }, [items]);

  if (items.length === 0) {
    return (
      <Box sx={{ py: 8, px: 3, textAlign: "center" }}>
        <Typography sx={{ color: subColor }}>No scheduled NCR due dates yet.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
            <TableCell sx={{ fontWeight: 600, color: subColor }}>Report</TableCell>
            <TableCell sx={{ fontWeight: 600, color: subColor }}>Project</TableCell>
            <TableCell sx={{ fontWeight: 600, color: subColor }}>Responsible</TableCell>
            <TableCell sx={{ fontWeight: 600, color: subColor }}>Due date</TableCell>
            <TableCell sx={{ fontWeight: 600, color: subColor }}>Status</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: subColor }}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ item, due, overdue }) => {
            const chip = statusChip(item.status);
            return (
              <TableRow key={item.id} hover>
                <TableCell sx={{ color: headingColor, fontWeight: 600 }}>
                  {item.title}
                </TableCell>
                <TableCell sx={{ color: subColor }}>
                  {item.details?.project_name || "—"}
                </TableCell>
                <TableCell sx={{ color: subColor }}>
                  {item.responsibleName || item.assignee?.name || "—"}
                </TableCell>
                <TableCell sx={{ color: overdue ? "#DC2626" : subColor, fontWeight: overdue ? 700 : 400 }}>
                  {due ? formatDate(due) : "—"}
                  {overdue ? " (Overdue)" : ""}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={chip.label} color={chip.color} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => onOpenItem(item.id, item.status !== "sent" ? "edit" : "view")}
                    sx={{ textTransform: "none" }}
                  >
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DetailManageTab({
  items,
  loading,
  isDarkMode,
  headingColor,
  subColor,
  borderColor,
  selectedId,
  detailLoading,
  displayAction,
  displayFormValues,
  editForm,
  responseNotes,
  detailMode,
  versionTab,
  saving,
  downloading,
  showVersionTabs,
  previousActions,
  latestAction,
  canEditLatest,
  onSelectFinding,
  onVersionTabChange,
  onDetailModeChange,
  onFormChange,
  onResponseNotesChange,
  onSaveDraft,
  onSend,
  onDownloadPdf,
}) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "#E89F17" }} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ py: 8, px: 3, textAlign: "center" }}>
        <Typography sx={{ fontWeight: 600, color: headingColor, mb: 0.5 }}>
          No assigned findings
        </Typography>
        <Typography sx={{ color: subColor, fontSize: "0.9rem" }}>
          Nonconformances where you are the responsible person will appear here for you to manage.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, minHeight: 480 }}>
      <Box
        sx={{
          width: { xs: "100%", lg: 360 },
          flexShrink: 0,
          borderRight: { lg: `1px solid ${borderColor}` },
          borderBottom: { xs: `1px solid ${borderColor}`, lg: "none" },
          maxHeight: { lg: "72vh" },
          overflow: "auto",
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${borderColor}`, bgcolor: isDarkMode ? "#111827" : "#FAFAF9" }}>
          <Typography variant="caption" sx={{ color: subColor, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Assigned findings ({items.length})
          </Typography>
        </Box>
        {items.map((row) => {
          const active = row.id === selectedId;
          const reg = registerStatusChip(row.registerStatus || "open");
          const workflow = statusChip(row.status);
          return (
            <Box
              key={row.id}
              onClick={() => onSelectFinding(row.id, row.status !== "sent" ? "edit" : "view")}
              sx={{
                px: 2,
                py: 1.5,
                cursor: "pointer",
                borderBottom: `1px solid ${borderColor}`,
                bgcolor: active
                  ? isDarkMode
                    ? "rgba(232, 159, 23, 0.12)"
                    : "rgba(232, 159, 23, 0.08)"
                  : "transparent",
                borderLeft: active ? "3px solid #E89F17" : "3px solid transparent",
                "&:hover": {
                  bgcolor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                },
              }}
            >
              <Typography sx={{ fontWeight: 700, color: headingColor, fontSize: "0.9rem", mb: 0.25 }}>
                {formatNcrNumber(row)}
              </Typography>
              <Typography sx={{ color: headingColor, fontWeight: 600, fontSize: "0.85rem", mb: 0.5 }}>
                {row.details?.project_name || row.title}
              </Typography>
              <Typography sx={{ color: subColor, fontSize: "0.8rem", mb: 0.75 }}>
                Reported by {row.reporter?.name || "—"} · {formatDate(row.createdAt)}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  label={reg.label}
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: reg.color,
                    bgcolor: reg.bg,
                  }}
                />
                <Chip size="small" label={workflow.label} color={workflow.color} sx={{ height: 22, fontSize: "0.65rem" }} />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: "auto" }}>
        {detailLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress sx={{ color: "#E89F17" }} />
          </Box>
        ) : displayAction ? (
          <Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2, alignItems: "center" }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: headingColor }}>
                  {displayAction.title}
                </Typography>
                <Typography sx={{ color: subColor, fontSize: "0.85rem" }}>
                  {formatNcrNumber(displayAction)} · Reported by {displayAction.reporter?.name || "—"}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={statusChip(displayAction.status).label}
                color={statusChip(displayAction.status).color}
              />
              <Button
                size="small"
                startIcon={<Download size={16} />}
                disabled={downloading}
                onClick={() => onDownloadPdf(displayAction)}
                sx={{ textTransform: "none" }}
              >
                PDF
              </Button>
            </Box>

            {showVersionTabs ? (
              <Tabs
                value={versionTab}
                onChange={(_, v) => onVersionTabChange(v)}
                sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
              >
                <Tab label="Latest" sx={{ textTransform: "none", fontWeight: 600 }} />
                <Tab
                  label={`Previous (${previousActions.length})`}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                />
              </Tabs>
            ) : null}

            {versionTab === 0 ? (
              <>
                <ActionFormBody
                  formValues={canEditLatest ? editForm : displayFormValues}
                  editable={canEditLatest}
                  onChange={onFormChange}
                />
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}
                  >
                    Your response to reporter
                  </Typography>
                  {canEditLatest ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={responseNotes}
                      onChange={(e) => onResponseNotesChange(e.target.value)}
                      placeholder="Add your response, actions taken, or notes for the reporter..."
                      sx={{ mt: 1 }}
                    />
                  ) : (
                    <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                      {displayAction.responseNotes || "No response yet."}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 3 }}>
                  {latestAction?.status !== "sent" ? (
                    detailMode === "edit" ? (
                      <>
                        <Button
                          variant="outlined"
                          disabled={saving}
                          onClick={onSaveDraft}
                          sx={{ textTransform: "none" }}
                        >
                          Save draft
                        </Button>
                        <Button
                          variant="contained"
                          disabled={saving}
                          onClick={onSend}
                          startIcon={<Send size={16} />}
                          sx={{
                            textTransform: "none",
                            bgcolor: "#E89F17",
                            "&:hover": { bgcolor: "#cc8b14" },
                          }}
                        >
                          Send to reporter
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => onDetailModeChange("edit")}
                        sx={{
                          textTransform: "none",
                          bgcolor: "#E89F17",
                          "&:hover": { bgcolor: "#cc8b14" },
                        }}
                      >
                        Edit response
                      </Button>
                    )
                  ) : null}
                </Box>
              </>
            ) : (
              <Box>
                {previousActions.map((prev, idx) => {
                  const prevValues = actionToFormValues(prev);
                  return (
                    <Paper
                      key={prev.id}
                      variant="outlined"
                      sx={{ p: 2, mb: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 700, mb: 1 }}>
                        Previous action {previousActions.length - idx}
                      </Typography>
                      <ActionFormBody
                        formValues={prevValues}
                        editable={false}
                        onChange={() => {}}
                      />
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        ) : (
          <Typography sx={{ color: subColor, py: 4, textAlign: "center" }}>
            Select an assigned finding from the list to manage it.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function ActionTrackerPage() {
  const { isDarkMode } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const itemIdFromUrl = searchParams.get("item");
  const tabFromUrl = searchParams.get("tab");
  const pdfRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState(() => {
    const parsed = Number.parseInt(tabFromUrl || "", 10);
    return Number.isFinite(parsed) && parsed >= 0 && parsed < MAIN_TABS.length ? parsed : 0;
  });
  const [selectedId, setSelectedId] = useState(itemIdFromUrl || "");
  const [relatedActions, setRelatedActions] = useState([]);
  const [detailMode, setDetailMode] = useState("view");
  const [versionTab, setVersionTab] = useState(0);
  const [editForm, setEditForm] = useState({});
  const [responseNotes, setResponseNotes] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [registerStatusFilter, setRegisterStatusFilter] = useState("all");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const headingColor = isDarkMode ? "#F9FAFB" : "#111827";
  const subColor = isDarkMode ? "#9CA3AF" : "#6B7280";
  const borderColor = isDarkMode ? "#374151" : "#E5E7EB";

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchActionTrackerItems();
      setItems(res?.data || []);
    } catch (err) {
      console.error("Failed to load nonconformance items", err);
      setSnack({
        open: true,
        message: "Could not load nonconformance actions.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const selected = useMemo(
    () => items.find((row) => row.id === selectedId) || relatedActions[0] || null,
    [items, selectedId, relatedActions]
  );

  const latestAction = useMemo(
    () => relatedActions[0] || selected,
    [relatedActions, selected]
  );

  const previousActions = useMemo(
    () => (relatedActions.length > 1 ? relatedActions.slice(1) : []),
    [relatedActions]
  );

  const displayAction = useMemo(() => {
    if (versionTab === 0) return latestAction;
    return previousActions[0] || latestAction;
  }, [versionTab, latestAction, previousActions]);

  const displayFormValues = useMemo(
    () => actionToFormValues(displayAction),
    [displayAction]
  );

  const assignedItems = useMemo(
    () => items.filter((row) => row.isAssignee),
    [items]
  );

  const loadDetail = useCallback(async (id, mode = "view") => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const res = await fetchActionTrackerItem(id);
      const row = res?.data;
      if (!row) return;
      const related = res?.relatedActions?.length ? res.relatedActions : [row];
      setRelatedActions(related);
      const focus = related[0] || row;
      setEditForm(actionToFormValues(focus));
      setResponseNotes(focus.responseNotes || "");
      setVersionTab(0);
      setDetailMode(mode);
      setSelectedId(id);
      setSearchParams({ tab: "2", item: id });
    } catch (err) {
      console.error("Failed to load nonconformance detail", err);
      setSnack({ open: true, message: "Could not open this finding.", severity: "error" });
    } finally {
      setDetailLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    if (itemIdFromUrl) {
      loadDetail(itemIdFromUrl, "view");
      setMainTab(2);
    }
  }, [itemIdFromUrl, loadDetail]);

  useEffect(() => {
    if (mainTab !== 2 || itemIdFromUrl || assignedItems.length === 0) return;
    const selectedIsAssigned = assignedItems.some((row) => row.id === selectedId);
    if (!selectedIsAssigned) {
      loadDetail(assignedItems[0].id, assignedItems[0].status !== "sent" ? "edit" : "view");
    }
  }, [mainTab, assignedItems, selectedId, itemIdFromUrl, loadDetail]);

  const openItem = (id, mode = "view") => {
    const row = items.find((r) => r.id === id);
    if (!row?.isAssignee) return;
    setMainTab(2);
    loadDetail(id, mode);
  };

  const handleMainTabChange = (_, value) => {
    setMainTab(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", String(value));
      return next;
    });
  };

  const handleFormChange = (fieldId, value) => {
    setEditForm((prev) => ({ ...prev, [fieldId]: value }));
  };

  const buildPayload = () => formValuesToUpdatePayload(editForm, responseNotes);

  const handleSaveDraft = async () => {
    if (!latestAction) return;
    setSaving(true);
    try {
      const res = await updateActionTrackerItem(latestAction.id, {
        ...buildPayload(),
        asDraft: true,
      });
      setRelatedActions((prev) =>
        prev.map((a) => (a.id === res.data.id ? res.data : a))
      );
      await loadItems();
      setSnack({ open: true, message: "Draft saved.", severity: "success" });
    } catch (err) {
      setSnack({
        open: true,
        message: err?.response?.data?.message || "Could not save draft.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!latestAction) return;
    setSaving(true);
    try {
      const res = await sendActionTrackerItem(latestAction.id, buildPayload());
      setRelatedActions((prev) =>
        prev.map((a) => (a.id === res.data.id ? res.data : a))
      );
      await loadItems();
      setSnack({
        open: true,
        message: "Response sent to the reporter.",
        severity: "success",
      });
      setDetailMode("view");
    } catch (err) {
      setSnack({
        open: true,
        message: err?.response?.data?.message || "Could not send response.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (action) => {
    setDownloadAnchor(null);
    setDownloading(true);
    setDownloadTarget(action);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));
    try {
      const fileName = `Nonconformance_${(action.title || "report").replace(/\s+/g, "_")}`;
      await downloadPdfFromRef(pdfRef, fileName, (err) => {
        if (err) throw err;
      });
    } catch (err) {
      console.error("PDF download failed", err);
      setSnack({ open: true, message: "Could not download PDF.", severity: "error" });
    } finally {
      setDownloading(false);
      setDownloadTarget(null);
    }
  };

  const handleRegisterStatusChange = async (id, registerStatus) => {
    setStatusUpdatingId(id);
    try {
      const res = await updateActionTrackerRegisterStatus(id, registerStatus);
      setItems((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...res.data } : row))
      );
      setSnack({
        open: true,
        message: `Marked as ${registerStatus}.`,
        severity: "success",
      });
    } catch (err) {
      setSnack({
        open: true,
        message: err?.response?.data?.message || "Could not update status.",
        severity: "error",
      });
    } finally {
      setStatusUpdatingId("");
    }
  };

  const canEditLatest =
    latestAction?.status !== "sent" && versionTab === 0 && detailMode === "edit";

  const showVersionTabs = relatedActions.length > 1;

  return (
    <Layout disablePadding>
      <PageContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: headingColor, mb: 0.5 }}>
            Nonconformance
          </Typography>
          <Typography sx={{ color: subColor, fontSize: "0.95rem" }}>
            NCR register, findings, and due-date schedule for assigned nonconformance reports.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{ borderRadius: 3, border: `1px solid ${borderColor}`, overflow: "hidden" }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              borderBottom: `1px solid ${borderColor}`,
              bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
            }}
          >
            <Tabs
              value={mainTab}
              onChange={handleMainTabChange}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 48,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: subColor,
                  minHeight: 48,
                  px: { xs: 1.5, sm: 2.5 },
                },
                "& .Mui-selected": {
                  color: headingColor,
                },
                "& .MuiTabs-indicator": {
                  bgcolor: "#E89F17",
                  height: 3,
                  borderRadius: "3px 3px 0 0",
                },
              }}
            >
              {MAIN_TABS.map((tab) => (
                <Tab key={tab.id} label={tab.label} />
              ))}
            </Tabs>
          </Box>

          {mainTab === 0 ? (
            <RegisterListTab
              items={items}
              loading={loading}
              isDarkMode={isDarkMode}
              headingColor={headingColor}
              subColor={subColor}
              borderColor={borderColor}
              downloading={downloading}
              statusFilter={registerStatusFilter}
              onStatusFilterChange={setRegisterStatusFilter}
              onOpenItem={openItem}
              onDownloadMenu={(e, row) => {
                setDownloadAnchor(e.currentTarget);
                setDownloadTarget(row);
                handleDownloadPdf(row);
              }}
              onRegisterStatusChange={handleRegisterStatusChange}
              statusUpdatingId={statusUpdatingId}
            />
          ) : null}

          {mainTab === 1 ? (
            <RegisterGraphsTab
              items={items}
              headingColor={headingColor}
              subColor={subColor}
              borderColor={borderColor}
            />
          ) : null}

          {mainTab === 2 ? (
            <DetailManageTab
              items={assignedItems}
              loading={loading}
              isDarkMode={isDarkMode}
              headingColor={headingColor}
              subColor={subColor}
              borderColor={borderColor}
              selectedId={selectedId}
              detailLoading={detailLoading}
              displayAction={displayAction}
              displayFormValues={displayFormValues}
              editForm={editForm}
              responseNotes={responseNotes}
              detailMode={detailMode}
              versionTab={versionTab}
              saving={saving}
              downloading={downloading}
              showVersionTabs={showVersionTabs}
              previousActions={previousActions}
              latestAction={latestAction}
              canEditLatest={canEditLatest}
              onSelectFinding={loadDetail}
              onVersionTabChange={setVersionTab}
              onDetailModeChange={setDetailMode}
              onFormChange={handleFormChange}
              onResponseNotesChange={setResponseNotes}
              onSaveDraft={handleSaveDraft}
              onSend={handleSend}
              onDownloadPdf={handleDownloadPdf}
            />
          ) : null}

          {mainTab === 3 ? (
            <ScheduleTab
              items={items}
              headingColor={headingColor}
              subColor={subColor}
              borderColor={borderColor}
              onOpenItem={openItem}
            />
          ) : null}
        </Paper>

        <Menu
          anchorEl={downloadAnchor}
          open={Boolean(downloadAnchor)}
          onClose={() => setDownloadAnchor(null)}
        >
          <MenuItem onClick={() => downloadTarget && handleDownloadPdf(downloadTarget)}>
            Download as PDF
          </MenuItem>
        </Menu>

        <Box
          sx={{
            position: "fixed",
            left: -10000,
            top: 0,
            width: 794,
            bgcolor: "#fff",
            zIndex: -1,
          }}
        >
          <Box ref={pdfRef}>
            {downloadTarget ? (
              <ActionPrintView
                action={downloadTarget}
                formValues={actionToFormValues(downloadTarget)}
              />
            ) : null}
          </Box>
        </Box>

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </PageContent>
    </Layout>
  );
}
