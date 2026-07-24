import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogContent,
  Snackbar,
  Alert,
  DialogTitle,
  DialogActions,
  Button,
  TextField,
  Grid,
  Autocomplete,
  TablePagination,
  Divider,
  InputAdornment,
  Tabs,
  Tab,
  Checkbox,
} from "@mui/material";
import {
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  MoreHoriz as MoreHorizIcon,
  PersonAdd as PersonAddIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Eye,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  Mail,
  Phone,
  Building2,
  Clock,
  X,
  FileText,
  Download,
  User,
} from "lucide-react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fetchUsersList, fetchClientsList, LIST_FETCH_TIMEOUT_MS } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { plainNameError } from "../utils/plainName";
import { plainCompanyError } from "../utils/plainCompany";
import { newPasswordError } from "../utils/passwordPolicy";
import { useAuth, ASSIGNABLE_ROLES } from "../context/AuthContext";
import UserPageAccessFields from "../components/UserPageAccessFields";
import { APP_PAGES } from "../constants/pageAccess";
import { isViewOnlyUser } from "../utils/pageAccess";
import { formatLastSignIn, isUserOnline, ONLINE_WINDOW_MS } from "../utils/userPresence";
import {
  buildSubmissionActionUrl,
  isCustomBuilderSubmission,
} from "../utils/submissionNavigation";

function normalizeUserActivityFields(u) {
  if (!u || typeof u !== "object") return u;
  return {
    ...u,
    lastLoginAt: u.lastLoginAt ?? u.last_login_at ?? null,
    lastSeenAt: u.lastSeenAt ?? u.last_seen_at ?? null,
  };
}

export default function UsersPage() {
  const { isDarkMode } = useTheme();
  const { id } = useParams(); // optional client id
  const location = useLocation();
  const clientName = location.state?.clientName;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSafetyNett, currentUser, role: effectiveRole, isSuperAdmin } = useAuth();

  const isSuperAdminAccount = isSuperAdmin;
  const isCompanyAdminAccount = effectiveRole === "company_admin";
  const canInvite = isSuperAdminAccount || isCompanyAdminAccount || isSafetyNett;
  const canManageRoles = isSuperAdminAccount || isCompanyAdminAccount;

  const assignableRoles = useMemo(
    () => ASSIGNABLE_ROLES[effectiveRole] ?? ["worker", "supervisor", "site_manager"],
    [effectiveRole]
  );

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";

  // Search State
  const [searchName, setSearchName] = useState(searchQuery);
  const [debouncedSearchName, setDebouncedSearchName] = useState(searchQuery);
  const [searchCompany, setSearchCompany] = useState("");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchRole, setSearchRole] = useState("all");

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [clientsList, setClientsList] = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Sync searchName with URL search query
  useEffect(() => {
    setSearchName(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 300);
    return () => clearTimeout(t);
  }, [searchName]);

  const [anchorEl, setAnchorEl] = useState(null);

  // Server already paginates/filters; keep a light client guard for view-only.
  const filteredUsers = useMemo(
    () => users.filter((u) => !isViewOnlyUser(u)),
    [users]
  );
  const paginatedUsers = filteredUsers;

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Company options for filter: prefer clients list (superadmin), else from loaded page.
  const uniqueCompanies = useMemo(() => {
    if (clientsList.length > 0) {
      return Array.from(
        new Set(clientsList.map((c) => c.name || c.companyname).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
    }
    return Array.from(
      new Set(
        users
          .filter((u) => !isViewOnlyUser(u))
          .map((u) => u.companyname || u.company)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [clientsList, users]);

  const [menuUser, setMenuUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [detailSubmissions, setDetailSubmissions] = useState([]);
  const [detailSubmissionsLoading, setDetailSubmissionsLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("details");
  const [submissionPreviewOpen, setSubmissionPreviewOpen] = useState(false);
  const [submissionPreviewUrl, setSubmissionPreviewUrl] = useState("");
  const [submissionPreviewTitle, setSubmissionPreviewTitle] = useState("");
  const [submissionPreviewRow, setSubmissionPreviewRow] = useState(null);

  // Edit User State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Access Management State
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessUser, setAccessUser] = useState(null);
  const [accessViewOnly, setAccessViewOnly] = useState(false);
  const [accessPages, setAccessPages] = useState([]);
  const [pageCatalog, setPageCatalog] = useState(APP_PAGES);
  const [selectedRole, setSelectedRole] = useState("user");

  // Invite User State
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "", mobile: "", role: "worker", password: "", companyname: "", clientId: "" });
  const [inviteShowPassword, setInviteShowPassword] = useState(false);
  const [inviteErrors, setInviteErrors] = useState({});

  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  // Bulk delete state (superadmin only)
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteInFlight, setBulkDeleteInFlight] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });

  const loadClientsIfNeeded = React.useCallback(async () => {
    if (!isSuperAdminAccount || clientsLoaded) return;
    try {
      const data = await fetchClientsList();
      if (data?.clients) setClientsList(data.clients);
      else if (Array.isArray(data)) setClientsList(data);
      setClientsLoaded(true);
    } catch (err) {
      console.error("Failed to fetch clients for dropdown", err);
    }
  }, [isSuperAdminAccount, clientsLoaded]);

  const listRequestRef = React.useRef(0);
  const fetchUsers = React.useCallback(async ({ silent = false } = {}) => {
    const requestId = ++listRequestRef.current;
    if (!silent) setLoading(true);
    try {
      if (effectiveRole === "worker") {
        if (requestId !== listRequestRef.current) return;
        setUsers([]);
        setTotalUsers(0);
        return;
      }

      const data = await fetchUsersList(id, {
        page,
        limit: rowsPerPage,
        search: debouncedSearchName.trim(),
        company: searchCompany.trim(),
        status: searchStatus,
        role: searchRole,
      });
      if (requestId !== listRequestRef.current) return;
      const list = data?.users ?? data ?? [];
      setUsers(Array.isArray(list) ? list.map(normalizeUserActivityFields) : []);
      setTotalUsers(Number(data?.total) || (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      console.error("Failed to fetch users:", err);
      setSnack({ open: true, msg: "Failed to load users", severity: "error" });
      if (!silent) {
        setUsers([]);
        setTotalUsers(0);
      }
    } finally {
      if (requestId === listRequestRef.current && !silent) setLoading(false);
    }
  }, [
    effectiveRole,
    id,
    page,
    rowsPerPage,
    debouncedSearchName,
    searchCompany,
    searchStatus,
    searchRole,
  ]);

  const listFiltersKey = `${id || ""}|${debouncedSearchName}|${searchCompany}|${searchStatus}|${searchRole}`;
  const prevListFiltersKeyRef = React.useRef(listFiltersKey);

  useEffect(() => {
    if (prevListFiltersKeyRef.current !== listFiltersKey) {
      prevListFiltersKeyRef.current = listFiltersKey;
      if (page !== 0) {
        setPage(0);
        return;
      }
    }

    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchUsers();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUsers, listFiltersKey, page]);

  const openMenu = (event, user) => {
    setAnchorEl(event.currentTarget);
    setMenuUser(user);
  };
  const closeMenu = () => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  // toggle active/inactive
  const toggleActive = async (user) => {
    const userId = user._id ?? user.id;
    const previousActive = user.active;
    const newActive = !previousActive;

    setUsers((prev) =>
      prev.map((u) => ((u._id ?? u.id) === userId ? { ...u, active: newActive } : u))
    );

    try {
      const res = await api.put(`/users/${userId}/status`, { active: newActive }, { timeout: LIST_FETCH_TIMEOUT_MS });
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "Failed to update");
      }
      setSnack({ open: true, msg: newActive ? "User activated" : "User deactivated", severity: "success" });
    } catch (err) {
      console.error("Toggle status error:", err);
      setUsers((prev) =>
        prev.map((u) => ((u._id ?? u.id) === userId ? { ...u, active: previousActive } : u))
      );
      setSnack({ open: true, msg: "Failed to update user status", severity: "error" });
    } finally {
      closeMenu();
    }
  };

  const formatSubmissionDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // VIEW User — load profile + submissions in parallel
  const detailRequestRef = React.useRef(0);
  const handleView = async (user) => {
    const userId = user._id ?? user.id;
    const requestId = ++detailRequestRef.current;
    setDetailUser(normalizeUserActivityFields(user));
    setDetailSubmissions([]);
    setDetailSubmissionsLoading(true);
    setDetailTab("details");
    setDetailOpen(true);
    closeMenu();

    try {
      const [userRes, subsRes] = await Promise.all([
        api.get(`/users/${userId}`).catch((err) => {
          console.warn("Could not fetch full user, using local copy", err);
          return null;
        }),
        api.get(`/users/${userId}/form-submissions`).catch((err) => {
          console.error("Failed to load user form submissions", err);
          return null;
        }),
      ]);
      if (requestId !== detailRequestRef.current) return;

      const raw = userRes?.data?.user ?? user;
      setDetailUser(normalizeUserActivityFields(raw));
      setDetailSubmissions(subsRes?.data?.success ? subsRes.data.data || [] : []);
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailSubmissionsLoading(false);
      }
    }
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailTab("details");
    closeSubmissionPreview();
    setDetailUser(null);
    setDetailSubmissions([]);
    setDetailSubmissionsLoading(false);
  };

  const openSubmissionPreview = (row) => {
    const url = buildSubmissionActionUrl(row, "view");
    if (!url) {
      setSnack({ open: true, msg: "This form cannot be previewed.", severity: "warning" });
      return;
    }
    setSubmissionPreviewTitle(row.title || "Form");
    setSubmissionPreviewUrl(url);
    setSubmissionPreviewRow(row);
    setSubmissionPreviewOpen(true);
  };

  const downloadSubmission = (row, format) => {
    const mode = format === "word" ? "download_word" : "download_pdf";
    const url = buildSubmissionActionUrl(row, mode);
    if (!url) {
      setSnack({ open: true, msg: "Download is not available for this form.", severity: "warning" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const closeSubmissionPreview = () => {
    setSubmissionPreviewOpen(false);
    setSubmissionPreviewUrl("");
    setSubmissionPreviewTitle("");
    setSubmissionPreviewRow(null);
  };

  const detailUserOnline = detailUser ? isUserOnline(detailUser.lastSeenAt, detailUser.lastLoginAt) : false;

  // EDIT User
  const handleEdit = (user) => {
    setEditUser(user);
    let existingClientId = user.clientId || user.client?.id || "";
    const companyLabel = user.companyname || user.company || "";
    if (!existingClientId && companyLabel && clientsList.length > 0) {
      const match = clientsList.find(
        (c) => String(c.name || "").toLowerCase() === String(companyLabel).toLowerCase()
      );
      if (match) existingClientId = match.id || match._id || "";
    }
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      mobile: user.mobile || "",
      jobTitle: user.jobTitle || "",
      companyname: companyLabel,
      clientId: existingClientId,
    });
    setEditDialogOpen(true);
    loadClientsIfNeeded();
    closeMenu();
  };

  const handleSaveEdit = async () => {
    if (!editUser || editSaving) return;
    const fe = plainNameError(editForm.firstName, "First name");
    const le = plainNameError(editForm.lastName, "Last name");
    if (isSuperAdminAccount && !editForm.clientId) {
      setSnack({ open: true, msg: "Select a company for this user", severity: "error" });
      return;
    }
    const ce = isSuperAdminAccount
      ? null
      : plainCompanyError(editForm.companyname, "Company name");
    if (fe || le || ce) {
      setSnack({ open: true, msg: fe || le || ce, severity: "error" });
      return;
    }

    const id = editUser._id ?? editUser.id;
    const previousUser = editUser;
    const updates = isSuperAdminAccount
      ? {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          mobile: editForm.mobile,
          jobTitle: editForm.jobTitle,
          clientId: editForm.clientId,
          companyname: editForm.companyname,
        }
      : {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          mobile: editForm.mobile,
          jobTitle: editForm.jobTitle,
          companyname: editForm.companyname,
        };

    setUsers((prev) => prev.map((u) => ((u._id ?? u.id) === id ? { ...u, ...updates } : u)));
    setSnack({ open: true, msg: "User updated successfully", severity: "success" });
    setEditDialogOpen(false);
    setEditUser(null);
    setEditSaving(true);

    try {
      const res = await api.put(`/users/${id}`, updates, { timeout: LIST_FETCH_TIMEOUT_MS });
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "Failed to update user");
      }
      if (res.data.user) {
        setUsers((prev) =>
          prev.map((u) => ((u._id ?? u.id) === id ? { ...u, ...normalizeUserActivityFields(res.data.user) } : u))
        );
      }
    } catch (err) {
      console.error("Update user error:", err);
      setUsers((prev) => prev.map((u) => ((u._id ?? u.id) === id ? previousUser : u)));
      setSnack({
        open: true,
        msg: err?.response?.data?.message || "Failed to update user",
        severity: "error",
      });
    } finally {
      setEditSaving(false);
    }
  };

  // ACCESS
  const handleManageAccess = (user) => {
    if (!canManageRoles) return;
    if (!isSuperAdminAccount && user.role === "superadmin") {
      setSnack({ open: true, msg: "Only superadmins can manage superadmin accounts", severity: "warning" });
      closeMenu();
      return;
    }
    setAccessUser(user);
    const current = user.role || "worker";
    setSelectedRole(assignableRoles.includes(current) ? current : assignableRoles[0] || "worker");
    const viewOnly =
      user.viewOnly === true || String(user.accessMode || "").toLowerCase() === "view_only";
    setAccessViewOnly(viewOnly);
    const pages = Array.isArray(user.allowedPages) ? user.allowedPages.filter((k) => k !== "profile" && k !== "account-settings") : [];
    setAccessPages(pages.length ? pages : ["dashboard"]);
    setAccessDialogOpen(true);
    api.get("/users/page-access-catalog").then((res) => {
      if (res.data?.pages?.length) setPageCatalog(res.data.pages);
    }).catch(() => {});
    closeMenu();
  };

  const toggleAccessPage = (key) => {
    setAccessPages((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSaveAccess = async () => {
    if (!accessUser || accessSaving) return;
    if (accessViewOnly && accessPages.length === 0) {
      setSnack({ open: true, msg: "Select at least one page for view-only access.", severity: "warning" });
      return;
    }

    const userId = accessUser._id ?? accessUser.id;
    const previousUser = accessUser;
    const optimisticPatch = {
      role: selectedRole,
      accessMode: accessViewOnly ? "view_only" : "standard",
      viewOnly: accessViewOnly,
      allowedPages: accessViewOnly ? accessPages : null,
    };

    setUsers((prev) =>
      prev.map((u) => ((u._id ?? u.id) === userId ? { ...u, ...optimisticPatch } : u))
    );
    setSnack({ open: true, msg: "User access updated", severity: "success" });
    setAccessDialogOpen(false);
    setAccessUser(null);
    setAccessSaving(true);

    try {
      const res = await api.put(
        `/users/${userId}`,
        {
          role: selectedRole,
          accessMode: accessViewOnly ? "view_only" : "standard",
          allowedPages: accessViewOnly ? accessPages : [],
        },
        { timeout: LIST_FETCH_TIMEOUT_MS }
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "Failed");
      }
      const updated = res.data.user || {};
      setUsers((prev) =>
        prev.map((u) =>
          (u._id ?? u.id) === userId
            ? {
                ...u,
                role: selectedRole,
                accessMode: updated.accessMode ?? optimisticPatch.accessMode,
                viewOnly: accessViewOnly,
                allowedPages: accessViewOnly ? accessPages : null,
              }
            : u
        )
      );
    } catch (err) {
      console.error("Update access error:", err);
      setUsers((prev) => prev.map((u) => ((u._id ?? u.id) === userId ? previousUser : u)));
      setSnack({
        open: true,
        msg: err?.response?.data?.message || "Failed to update access",
        severity: "error",
      });
    } finally {
      setAccessSaving(false);
    }
  };

  // DELETE
  const handleDelete = async () => {
    if (!deleteUser || deleteInFlight) return;

    const userId = deleteUser._id ?? deleteUser.id;
    const removedUser = deleteUser;

    setDeleteInFlight(true);
    setDeleteDialogOpen(false);
    setDeleteUser(null);
    setUsers((prev) => prev.filter((u) => (u._id ?? u.id) !== userId));
    setSelectedIds((prev) => prev.filter((id) => id !== userId));
    setSnack({ open: true, msg: "User deleted successfully", severity: "success" });

    try {
      const res = await api.delete(`/users/${userId}`, { timeout: LIST_FETCH_TIMEOUT_MS });
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      setUsers((prev) => {
        if (prev.some((u) => (u._id ?? u.id) === userId)) return prev;
        return [removedUser, ...prev];
      });
      setSnack({
        open: true,
        msg: err?.response?.data?.message || "Failed to delete user",
        severity: "error",
      });
    } finally {
      setDeleteInFlight(false);
    }
  };

  // BULK DELETE (superadmin only)
  const selfId = currentUser?._id ?? currentUser?.id;
  const isSelectableUser = (u) => (u._id ?? u.id) !== selfId;

  const toggleSelectUser = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectablePageIds = paginatedUsers.filter(isSelectableUser).map((u) => u._id ?? u.id);
  const allPageSelected =
    selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = selectablePageIds.some((id) => selectedIds.includes(id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !selectablePageIds.includes(id))
        : [...new Set([...prev, ...selectablePageIds])]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length || bulkDeleteInFlight) return;
    setBulkDeleteInFlight(true);

    const failed = [];
    for (const userId of selectedIds) {
      try {
        const res = await api.delete(`/users/${userId}`, { timeout: LIST_FETCH_TIMEOUT_MS });
        if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to delete");
        setUsers((prev) => prev.filter((u) => (u._id ?? u.id) !== userId));
      } catch (err) {
        console.error("Bulk delete user error:", userId, err);
        failed.push(userId);
      }
    }

    const deletedCount = selectedIds.length - failed.length;
    setSelectedIds(failed);
    setBulkDeleteDialogOpen(false);
    setBulkDeleteInFlight(false);
    setSnack({
      open: true,
      msg: failed.length
        ? `Deleted ${deletedCount} user${deletedCount === 1 ? "" : "s"}, ${failed.length} failed`
        : `${deletedCount} user${deletedCount === 1 ? "" : "s"} deleted successfully`,
      severity: failed.length ? "warning" : "success",
    });
  };

  return (
    <Layout>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", }}>
            {clientName ? `Users - ${clientName}` : isSuperAdminAccount ? "All users" : `Users — ${currentUser?.companyname || "Your company"}`}
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
            Manage user accounts and permissions
          </Typography>
          <Typography sx={{ mt: 1, display: "inline-block", px: 1.5, py: 0.5, fontSize: "0.7rem", fontWeight: 500, color: "#0B4DA6", backgroundColor: "rgba(11, 77, 166, 0.1)", borderRadius: "12px" }}>
            {totalUsers} members
          </Typography>
        </Box>

        {/* Invite User button — company_admin and above */}
        {canInvite && (
          <Button
            id="invite-user-btn"
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              const cid =
                typeof currentUser?.clientId === "string"
                  ? currentUser.clientId
                  : currentUser?.clientId?.id ?? "";
              setInviteForm({
                firstName: "",
                lastName: "",
                email: "",
                mobile: "",
                role: "worker",
                password: "",
                companyname: isSuperAdminAccount ? "" : (currentUser?.companyname || ""),
                clientId: isSuperAdminAccount ? "" : cid,
              });
              setInviteErrors({});
              setInviteDialogOpen(true);
              loadClientsIfNeeded();
            }}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#0B4DA6",
              px: 2.5,
              py: 1,
              boxShadow: "none",
              "&:hover": { bgcolor: "#083D86", boxShadow: "none" },
            }}
          >
            Invite User
          </Button>
        )}
      </Box>

      {/* Search Filters — disabled while invite modal is open so autofill does not target these fields */}
      <Grid
        container
        spacing={2}
        sx={{ mb: 4 }}
        aria-hidden={inviteDialogOpen}
      >
        {/* Search row */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            type="search"
            name="users-list-search"
            id="users-list-search"
            autoComplete="off"
            disabled={inviteDialogOpen}
            placeholder="Search by name or email..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            inputProps={{
              autoComplete: "off",
              "data-lpignore": "true",
              "data-1p-ignore": "true",
              "data-form-type": "other",
            }}
            InputProps={{
              startAdornment: (
                <Box component="span" sx={{ color: '#6B7280', mr: 1, display: 'flex', ml: 1 }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </Box>
              )
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 4,
                width: 400,
                bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                px: 1,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                "& .MuiInputBase-input": {
                  fontSize: "0.85rem",
                  py: 0,
                  color: isDarkMode ? "#F9FAFB" : "inherit"
                },
                "& .MuiInputBase-input::placeholder": {
                  fontSize: "0.80rem",
                  color: isDarkMode ? "#9CA3AF" : "inherit",
                  opacity: 1
                },
              }
            }}
          />
        </Grid>

        {/* Dropdowns row — superadmin only (multi-company directory) */}
        {isSuperAdminAccount && (
          <Grid item xs={12} md={4}>
          <Autocomplete
            fullWidth
            freeSolo
            disabled={inviteDialogOpen}
            options={uniqueCompanies}
            value={searchCompany}
            onOpen={() => {
              loadClientsIfNeeded();
            }}
            onInputChange={(event, newInputValue) => {
              setSearchCompany(newInputValue);
            }}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: 4,
                  mt: 1,
                  boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                  bgcolor: isDarkMode ? "#1B212C" : "#fff",
                  color: isDarkMode ? "#F9FAFB" : "inherit",
                  border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                  p: 1
                }
              }
            }}
            renderOption={(props, option) => (
              <Box
                component="li"
                {...props}
                sx={{
                  borderRadius: 50,
                  mx: 0.5, my: 0.2, px: 2, py: 1, fontSize: "0.85rem", color: isDarkMode ? "#9CA3AF" : "#4B5563",
                  "&:hover, &.Mui-focused": {
                    bgcolor: isDarkMode ? "rgba(255,255,255,0.05) !important" : "#FEF7EC !important",
                    color: isDarkMode ? "#F9FAFB !important" : "#A16207 !important"
                  },
                  "&[aria-selected='true']": {
                    bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important",
                    color: isDarkMode ? "#60A5FA !important" : "#A16207 !important"
                  }
                }}
              >
                {option}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="All Companies"
                fullWidth
                autoComplete="off"
                inputProps={{
                  ...params.inputProps,
                  autoComplete: "off",
                  name: "users-list-company-filter",
                  "data-lpignore": "true",
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 4,
                    width: 200,
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                    "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                    px: 1.5,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    "& .MuiInputBase-input": {
                      fontSize: "0.85rem",
                      py: 0,
                      color: isDarkMode ? "#F9FAFB" : "inherit"
                    },
                    "& .MuiInputBase-input::placeholder": {
                      fontSize: "0.8rem",
                      color: isDarkMode ? "#9CA3AF" : "inherit",
                      opacity: 1
                    },
                  }
                }}
              />
            )}
          />
        </Grid>
        )}
        <Grid item xs={12} md={4}>
          <TextField
            select
            fullWidth
            size="small"
            disabled={inviteDialogOpen}
            value={searchRole}
            onChange={(e) => setSearchRole(e.target.value)}
            SelectProps={{
              displayEmpty: true,
              MenuProps: {
                PaperProps: {
                  sx: {
                    borderRadius: 5,
                    mt: 1,
                    boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    p: 1,
                    color: isDarkMode ? "#F9FAFB" : "inherit"
                  }
                }
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 4,
                width: 200,
                bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                fontSize: "0.85rem",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                "& .MuiSelect-select": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                "& .MuiSelect-icon": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }
            }}
          >
            <MenuItem value="all" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>All Roles</MenuItem>
            {isSuperAdminAccount && (
            <MenuItem value="superadmin" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Super Admin</MenuItem>
            )}
            <MenuItem value="company_admin" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Company Admin</MenuItem>
            <MenuItem value="site_manager" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Site Manager</MenuItem>
            <MenuItem value="supervisor" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Supervisor</MenuItem>
            <MenuItem value="worker" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Worker</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            select
            fullWidth
            size="small"
            disabled={inviteDialogOpen}
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
            SelectProps={{
              displayEmpty: true,
              MenuProps: {
                PaperProps: {
                  sx: {
                    borderRadius: 4,
                    width: 200,
                    mt: 1,
                    boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                    p: 1,
                    color: isDarkMode ? "#F9FAFB" : "inherit"
                  }
                }
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 4,
                width: 200,
                bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                fontSize: "0.85rem",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                "& .MuiSelect-select": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                "& .MuiSelect-icon": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }
            }}
          >
            <MenuItem value="all" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>All Status</MenuItem>
            <MenuItem value="active" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Active</MenuItem>
            <MenuItem value="inactive" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Inactive</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      {
        loading && users.length === 0 ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 10 }} >
            <CircularProgress />
          </Box >
        ) : (
          <Box>
            {isSuperAdminAccount && selectedIds.length > 0 && (
              <Box
                sx={{
                  mb: 1.5,
                  px: 2,
                  py: 1,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                  border: `1px solid ${isDarkMode ? "rgba(239, 68, 68, 0.35)" : "#FECACA"}`,
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: isDarkMode ? "#FCA5A5" : "#B91C1C" }}>
                  {selectedIds.length} user{selectedIds.length === 1 ? "" : "s"} selected
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setSelectedIds([])}
                    disabled={bulkDeleteInFlight}
                    sx={{ textTransform: "none", color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                  >
                    Clear selection
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<Trash2 size={15} />}
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    disabled={bulkDeleteInFlight}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: 50, px: 2 }}
                  >
                    Delete selected
                  </Button>
                </Box>
              </Box>
            )}
            <TableContainer component={Paper} elevation={0} sx={{ border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", borderRadius: 4, overflow: "hidden", bgcolor: isDarkMode ? "#111827" : "#FFFFFF" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB" }}>
                    {isSuperAdminAccount && (
                      <TableCell padding="checkbox" sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                        <Checkbox
                          size="small"
                          checked={allPageSelected}
                          indeterminate={somePageSelected && !allPageSelected}
                          onChange={toggleSelectAllOnPage}
                          sx={{ color: isDarkMode ? "#9CA3AF" : undefined }}
                          inputProps={{ "aria-label": "Select all users on this page" }}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>SL No</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Email</TableCell>
                    {isSuperAdminAccount && <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Company</TableCell>}
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paginatedUsers.map((user, idx) => {
                    const slNo = page * rowsPerPage + idx + 1;
                    const userId = user._id ?? user.id;
                    const canSelect = isSuperAdminAccount && isSelectableUser(user);
                    return (
                      <TableRow key={userId} hover selected={selectedIds.includes(userId)} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        {isSuperAdminAccount && (
                          <TableCell padding="checkbox" sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                            <Checkbox
                              size="small"
                              checked={selectedIds.includes(userId)}
                              disabled={!canSelect}
                              onChange={() => toggleSelectUser(userId)}
                              sx={{ color: isDarkMode ? "#9CA3AF" : undefined }}
                              inputProps={{ "aria-label": `Select ${user.firstName || user.email || "user"}` }}
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>{slNo}</TableCell>

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Typography sx={{ fontWeight: 400, color: isDarkMode ? "#F9FAFB" : "#111827", fontSize: "0.95rem" }}>
                            {user.firstName ? `${user.firstName} ${user.lastName ?? ""}` : user.username ?? "(no name)"}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", fontWeight: 400, fontSize: "0.95rem" }}>{user.email ?? "-"}</Typography>
                        </TableCell>

                        {isSuperAdminAccount && (
                          <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                            <Typography sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 400, fontSize: "0.95rem" }}>{user.companyname ?? "-"}</Typography>
                          </TableCell>
                        )}

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 1.5,
                              py: 0.5,
                              borderRadius: '9999px',
                              bgcolor:
                                user.role === 'superadmin' || user.role === 'company_admin' ? 'rgba(34, 197, 94, 0.15)' :
                                  user.role === 'site_manager' ? 'rgba(251, 191, 36, 0.15)' :
                                    user.role === 'supervisor' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color:
                                user.role === 'superadmin' || user.role === 'company_admin' ? (isDarkMode ? '#4ADE80' : '#16A34A') :
                                  user.role === 'site_manager' ? (isDarkMode ? '#FBBF24' : '#B45309') :
                                    user.role === 'supervisor' ? (isDarkMode ? '#818CF8' : '#4F46E5') : (isDarkMode ? '#60A5FA' : '#1D4ED8'),
                              fontSize: '0.75rem',
                              fontWeight: 400,
                              textTransform: 'capitalize'
                            }}
                          >
                            {(user.role || 'worker').replace('_', ' ')}
                            {(user.viewOnly || user.accessMode === 'view_only') && (
                              <Chip label="View only" size="small" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                            )}
                          </Box>
                        </TableCell>

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 1.5,
                              py: 0.5,
                              borderRadius: '9999px',
                              bgcolor: user.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: user.active ? '#22C55E' : '#EF4444',
                              fontSize: '0.75rem',
                              fontWeight: 400,
                              textTransform: 'capitalize'
                            }}
                          >
                            {user.active ? "Active" : "Inactive"}
                          </Box>
                        </TableCell>

                        <TableCell align="right" sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <IconButton size="small" onClick={(e) => openMenu(e, user)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                            <MoreHorizIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isSuperAdminAccount ? 8 : 6} align="center" sx={{ py: 4, color: isDarkMode ? "#9CA3AF" : "inherit", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                Showing {totalUsers === 0 ? 0 : page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, totalUsers)} of {totalUsers} users
              </Typography>
              <TablePagination
                component="div"
                count={totalUsers}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                labelRowsPerPage="Rows"
                sx={{
                  border: 'none',
                  color: isDarkMode ? "#F9FAFB" : "inherit",
                  '& .MuiTablePagination-toolbar': { p: 0 },
                  '& .MuiTablePagination-actions': { ml: 1, color: isDarkMode ? "#F9FAFB" : "inherit" },
                  '& .MuiTablePagination-select': { color: isDarkMode ? "#F9FAFB" : "inherit" },
                  '& .MuiTablePagination-selectIcon': { color: isDarkMode ? "#9CA3AF" : "inherit" },
                }}
              />
            </Box>
          </Box>
        )
      }

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
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
        <MenuItem
          onClick={() => { if (!menuUser) return; handleView(menuUser); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          <Eye size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> View Details
        </MenuItem>

        <MenuItem
          onClick={() => { if (!menuUser) return; handleEdit(menuUser); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          <Pencil size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Edit User
        </MenuItem>

        <MenuItem
          onClick={() => { if (!menuUser) return; toggleActive(menuUser); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          {menuUser?.active ? (
            <><UserX size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Make Inactive</>
          ) : (
            <><UserCheck size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Make Active</>
          )}
        </MenuItem>

        {canManageRoles && (
        <MenuItem
          onClick={() => { if (!menuUser) return; handleManageAccess(menuUser); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1.5, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Manage access
        </MenuItem>
        )}

        <Divider sx={{ my: 1, borderColor: isDarkMode ? "#374151" : "#F3F4F6" }} />

        <MenuItem
          onClick={() => { if (!menuUser) return; setDeleteUser(menuUser); setDeleteDialogOpen(true); closeMenu(); }}
          sx={{ borderRadius: 2, py: 1, color: "#EF4444", fontSize: "0.95rem", "&:hover": { bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.05)" } }}
        >
          <Trash2 size={18} style={{ marginRight: 12, color: "#EF4444" }} /> Delete User
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: isDarkMode ? "1px solid #374151" : "none" }}>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="First Name"
                  fullWidth
                  size="small"
                  value={editForm.firstName}
                  onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: isDarkMode ? "#1B212C" : "transparent",
                      "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                      "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                    },
                    "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Last Name"
                  fullWidth
                  size="small"
                  value={editForm.lastName}
                  onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: isDarkMode ? "#1B212C" : "transparent",
                      "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                      "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                    },
                    "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                  }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Email"
              fullWidth
              size="small"
              value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: isDarkMode ? "#1B212C" : "transparent",
                  "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                  "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                },
                "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }}
            />
            <TextField
              label="Mobile"
              fullWidth
              size="small"
              value={editForm.mobile}
              onChange={e => setEditForm({ ...editForm, mobile: e.target.value })}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: isDarkMode ? "#1B212C" : "transparent",
                  "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                  "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                },
                "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }}
            />
            <TextField
              label="Job Title"
              fullWidth
              size="small"
              value={editForm.jobTitle}
              onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: isDarkMode ? "#1B212C" : "transparent",
                  "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                  "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                },
                "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" }
              }}
            />
            {isSuperAdminAccount ? (
              <TextField
                select
                label="Company"
                fullWidth
                size="small"
                value={editForm.clientId || ""}
                onChange={(e) => {
                  const selectedClient = clientsList.find(
                    (c) => (c.id || c._id) === e.target.value
                  );
                  setEditForm((f) => ({
                    ...f,
                    clientId: e.target.value,
                    companyname: selectedClient ? selectedClient.name : "",
                  }));
                }}
                helperText="Moves the user to that organisation. Forms they already completed stay on the original company pages."
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDarkMode ? "#1B212C" : "transparent",
                    "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                    "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                  },
                  "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" },
                  "& .MuiSelect-select": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                  "& .MuiSelect-icon": { color: isDarkMode ? "#9CA3AF" : "inherit" },
                }}
              >
                <MenuItem value="" sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                  <em>Select company</em>
                </MenuItem>
                {clientsList.map((client) => (
                  <MenuItem key={client.id || client._id} value={client.id || client._id}>
                    {client.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Site (Company)"
                fullWidth
                size="small"
                value={editForm.companyname}
                onChange={(e) => setEditForm({ ...editForm, companyname: e.target.value })}
                InputProps={isCompanyAdminAccount ? { readOnly: true } : undefined}
                disabled={isCompanyAdminAccount}
                helperText={
                  isCompanyAdminAccount
                    ? "Company is fixed to your organisation"
                    : undefined
                }
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDarkMode ? "#1B212C" : "transparent",
                    "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                    "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                  },
                  "& .MuiInputLabel-root": { color: isDarkMode ? "#9CA3AF" : "inherit" },
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: isDarkMode ? "#F9FAFB" : "#111827",
                    color: isDarkMode ? "#F9FAFB" : "#111827",
                  },
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: isDarkMode ? "1px solid #374151" : "none" }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ borderRadius: 50, px: 3, textTransform: "none", color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={editSaving} sx={{ borderRadius: 50, px: 3, textTransform: "none", bgcolor: isDarkMode ? "#3B82F6" : "#0B4DA6", boxShadow: "none", "&:hover": { bgcolor: isDarkMode ? "#2563EB" : "#083D86", boxShadow: "none" } }}>
            {editSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog — user profile */}
      <Dialog
        open={detailOpen}
        onClose={closeDetails}
        maxWidth="md"
        fullWidth
        slotProps={{ backdrop: { sx: { backdropFilter: "blur(6px)" } } }}
        PaperProps={{
          elevation: 0,
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
            color: isDarkMode ? "#F9FAFB" : "#111827",
            border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
            boxShadow: isDarkMode
              ? "0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(232,159,23,0.12)"
              : "0 24px 48px rgba(15,23,42,0.12), 0 0 0 1px rgba(232,159,23,0.15)",
          },
        }}
      >
        {detailUser && (
          <>
            <Box
              sx={{
                position: "relative",
                px: 3,
                pt: 3,
                pb: 5,
                background: isDarkMode
                  ? "linear-gradient(145deg, #1B212C 0%, #111827 45%, #1a1510 100%)"
                  : "linear-gradient(145deg, #F8FAFC 0%, #FFFBF5 40%, #FFF7ED 100%)",
                borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 4,
                  background: "linear-gradient(90deg, #E89F17 0%, #F5C15C 50%, #E89F17 100%)",
                  opacity: isDarkMode ? 0.85 : 1,
                },
              }}
            >
              <IconButton
                onClick={closeDetails}
                aria-label="Close"
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  color: isDarkMode ? "#9CA3AF" : "#64748B",
                  bgcolor: isDarkMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.7)",
                  "&:hover": { bgcolor: isDarkMode ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.95)" },
                }}
              >
                <X size={18} strokeWidth={2} />
              </IconButton>

              <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", pr: 5 }}>
                <Box
                  sx={{
                    position: "relative",
                    flexShrink: 0,
                    p: "3px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #E89F17, #F5C15C, #D97706)",
                    boxShadow: "0 8px 24px rgba(232,159,23,0.35)",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 88,
                      height: 88,
                      fontSize: "1.75rem",
                      fontWeight: 700,
                      bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                      color: isDarkMode ? "#F9FAFB" : "#0B4DA6",
                      border: isDarkMode ? "2px solid #111827" : "2px solid #FFF",
                    }}
                  >
                    {(detailUser.firstName || detailUser.username || "?").charAt(0).toUpperCase()}
                  </Avatar>
                </Box>
                <Box sx={{ minWidth: 0, pt: 0.5 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                      color: isDarkMode ? "rgba(232,159,23,0.9)" : "#B45309",
                    }}
                  >
                    User profile
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      lineHeight: 1.2,
                      mt: 0.25,
                      color: isDarkMode ? "#F9FAFB" : "#0f172a",
                    }}
                  >
                    {[detailUser.firstName, detailUser.lastName].filter(Boolean).join(" ") || detailUser.username}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
                    <Chip
                      size="small"
                      label={(detailUser.role || "worker").replace(/_/g, " ")}
                      sx={{
                        textTransform: "capitalize",
                        fontWeight: 600,
                        borderRadius: 2,
                        bgcolor: isDarkMode ? "rgba(11,77,166,0.25)" : "rgba(11,77,166,0.1)",
                        color: isDarkMode ? "#93C5FD" : "#0B4DA6",
                        border: isDarkMode ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(11,77,166,0.2)",
                      }}
                    />
                    <Chip
                      size="small"
                      label={detailUserOnline ? "Online" : "Offline"}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 2,
                        bgcolor: detailUserOnline ? "rgba(34,197,94,0.18)" : isDarkMode ? "rgba(107,114,128,0.2)" : "rgba(100,116,139,0.12)",
                        color: detailUserOnline ? "rgb(34,197,94)" : isDarkMode ? "#9CA3AF" : "#64748B",
                        border: detailUserOnline ? "1px solid rgba(34,197,94,0.35)" : "1px solid transparent",
                      }}
                    />
                    <Chip
                      size="small"
                      label={detailUser.active ? "Active account" : "Inactive"}
                      sx={{
                        fontWeight: 600,
                        borderRadius: 2,
                        bgcolor: detailUser.active ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.1)",
                        color: detailUser.active ? "rgb(22,163,74)" : "rgb(220,38,38)",
                        border: detailUser.active ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(220,38,38,0.2)",
                      }}
                    />
                  </Box>
                  {detailUser.jobTitle && (
                    <Typography
                      variant="body2"
                      sx={{ mt: 1.25, color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: 500 }}
                    >
                      {detailUser.jobTitle}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                px: 3,
                bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
                borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <Tabs
                value={detailTab}
                onChange={(_, value) => setDetailTab(value)}
                sx={{
                  minHeight: 44,
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    minHeight: 44,
                    py: 1.25,
                    color: isDarkMode ? "#9CA3AF" : "#64748B",
                    gap: 1,
                  },
                  "& .Mui-selected": {
                    color: isDarkMode ? "#F9FAFB" : "#0f172a",
                  },
                  "& .MuiTabs-indicator": {
                    height: 3,
                    borderRadius: "3px 3px 0 0",
                    bgcolor: isDarkMode ? "#E89F17" : "#0B4DA6",
                  },
                }}
              >
                <Tab
                  value="details"
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <User size={16} strokeWidth={2} />
                      User details
                    </Box>
                  }
                />
                <Tab
                  value="forms"
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <FileText size={16} strokeWidth={2} />
                      Submitted forms
                      {!detailSubmissionsLoading && (
                        <Chip
                          size="small"
                          label={detailSubmissions.length}
                          sx={{
                            height: 20,
                            minWidth: 24,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            bgcolor:
                              detailTab === "forms"
                                ? isDarkMode
                                  ? "rgba(232,159,23,0.2)"
                                  : "rgba(11,77,166,0.12)"
                                : isDarkMode
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(15,23,42,0.06)",
                            color:
                              detailTab === "forms"
                                ? isDarkMode
                                  ? "#F5C15C"
                                  : "#0B4DA6"
                                : isDarkMode
                                  ? "#9CA3AF"
                                  : "#64748B",
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              </Tabs>
            </Box>

            <DialogContent
              sx={{
                px: 3,
                pt: 2.5,
                pb: 2.5,
                bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
                minHeight: 280,
              }}
            >
              {detailTab === "details" ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box
                      sx={{
                        borderRadius: 2.5,
                        height: "100%",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        border: isDarkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(15,23,42,0.08)",
                        boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.2)" : "0 4px 20px rgba(15,23,42,0.05)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          px: 2.25,
                          py: 1.75,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
                          bgcolor: isDarkMode ? "rgba(0,0,0,0.15)" : "rgba(248,250,252,0.9)",
                        }}
                      >
                        <Mail size={18} color={isDarkMode ? "#E89F17" : "#0B4DA6"} strokeWidth={2} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDarkMode ? "#E5E7EB" : "#334155" }}>
                          Contact
                        </Typography>
                      </Box>
                      <Box sx={{ px: 2.25, py: 0.5 }}>
                        {[
                          { icon: <Mail size={17} />, label: "Email", value: detailUser.email },
                          { icon: <Phone size={17} />, label: "Phone", value: detailUser.mobile },
                          { icon: <Building2 size={17} />, label: "Site / company", value: detailUser.companyname },
                        ].map((row, i, arr) => (
                          <Box
                            key={row.label}
                            sx={{
                              display: "flex",
                              gap: 1.5,
                              py: 1.35,
                              borderBottom:
                                i < arr.length - 1
                                  ? isDarkMode
                                    ? "1px dashed rgba(255,255,255,0.06)"
                                    : "1px dashed rgba(15,23,42,0.08)"
                                  : "none",
                            }}
                          >
                            <Box sx={{ color: isDarkMode ? "#64748B" : "#94A3B8", pt: 0.35, flexShrink: 0 }}>
                              {row.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" sx={{ display: "block", color: isDarkMode ? "#64748B" : "#64748B", fontWeight: 600, letterSpacing: "0.02em" }}>
                                {row.label}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? "#F1F5F9" : "#0f172a", wordBreak: "break-word" }}>
                                {row.value || "—"}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box
                      sx={{
                        borderRadius: 2.5,
                        height: "100%",
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                        border: isDarkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(15,23,42,0.08)",
                        boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.2)" : "0 4px 20px rgba(15,23,42,0.05)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          px: 2.25,
                          py: 1.75,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
                          bgcolor: isDarkMode ? "rgba(0,0,0,0.15)" : "rgba(248,250,252,0.9)",
                        }}
                      >
                        <Clock size={18} color={isDarkMode ? "#E89F17" : "#0B4DA6"} strokeWidth={2} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDarkMode ? "#E5E7EB" : "#334155" }}>
                          Sign-in & activity
                        </Typography>
                      </Box>
                      <Box sx={{ px: 2.25, py: 2 }}>
                        <Typography variant="caption" sx={{ display: "block", color: isDarkMode ? "#64748B" : "#64748B", fontWeight: 600 }}>
                          Last sign-in
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: isDarkMode ? "#F1F5F9" : "#0f172a", mt: 0.25 }}>
                          {formatLastSignIn(detailUser.lastLoginAt, detailUser.lastSeenAt)}
                        </Typography>
                        <Box
                          sx={{
                            mt: 2,
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: isDarkMode ? "rgba(232,159,23,0.08)" : "rgba(232,159,23,0.1)",
                            border: isDarkMode ? "1px solid rgba(232,159,23,0.2)" : "1px solid rgba(232,159,23,0.25)",
                          }}
                        >
                          <Typography variant="caption" sx={{ color: isDarkMode ? "#CBD5E1" : "#475569", lineHeight: 1.6, display: "block" }}>
                            <strong style={{ color: isDarkMode ? "#E89F17" : "#B45309" }}>Online</strong> means we recorded activity within the last{" "}
                            {Math.round(ONLINE_WINDOW_MS / 60000)} minutes (e.g. while using the app).
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                <Box
                  sx={{
                    borderRadius: 2.5,
                    bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
                    border: isDarkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(15,23,42,0.08)",
                    boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.2)" : "0 4px 20px rgba(15,23,42,0.05)",
                    overflow: "hidden",
                  }}
                >
                  {detailSubmissionsLoading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, gap: 1.5 }}>
                      <CircularProgress size={32} sx={{ color: isDarkMode ? "#E89F17" : "#0B4DA6" }} />
                      <Typography variant="body2" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
                        Loading submitted forms…
                      </Typography>
                    </Box>
                  ) : detailSubmissions.length === 0 ? (
                    <Box sx={{ px: 3, py: 6, textAlign: "center" }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          mx: "auto",
                          mb: 1.5,
                          bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                        }}
                      >
                        <FileText size={28} color={isDarkMode ? "#4B5563" : "#CBD5E1"} />
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: isDarkMode ? "#E5E7EB" : "#334155", mb: 0.5 }}>
                        No forms yet
                      </Typography>
                      <Typography variant="body2" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B", maxWidth: 320, mx: "auto" }}>
                        Forms this user submits will appear here with view and download actions.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", bgcolor: isDarkMode ? "#111827" : "#F8FAFC", color: isDarkMode ? "#9CA3AF" : "#64748B", borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)" }}>
                              Form
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", width: 120, bgcolor: isDarkMode ? "#111827" : "#F8FAFC", color: isDarkMode ? "#9CA3AF" : "#64748B", borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)" }}>
                              Category
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", width: 110, bgcolor: isDarkMode ? "#111827" : "#F8FAFC", color: isDarkMode ? "#9CA3AF" : "#64748B", borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)" }}>
                              Submitted
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", width: 220, bgcolor: isDarkMode ? "#111827" : "#F8FAFC", color: isDarkMode ? "#9CA3AF" : "#64748B", borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)" }}>
                              Actions
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailSubmissions.map((row) => (
                            <TableRow
                              key={row.id}
                              hover
                              sx={{
                                "&:last-child td": { borderBottom: 0 },
                                "& td": {
                                  borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(15,23,42,0.06)",
                                  py: 1.25,
                                },
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? "#F1F5F9" : "#0f172a", lineHeight: 1.35 }}>
                                  {row.title}
                                </Typography>
                                {row.formTitle && row.formTitle !== row.title ? (
                                  <Typography variant="caption" sx={{ color: isDarkMode ? "#64748B" : "#94A3B8" }}>
                                    {row.formTitle}
                                  </Typography>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: 500 }}>
                                  {row.category}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ color: isDarkMode ? "#94A3B8" : "#64748B", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  {formatSubmissionDate(row.createdAt)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Eye size={14} />}
                                    onClick={() => openSubmissionPreview(row)}
                                    sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", borderRadius: 1.5, minWidth: 0, px: 1.25, borderColor: isDarkMode ? "#374151" : "#E2E8F0", color: isDarkMode ? "#E5E7EB" : "#334155" }}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Download size={14} />}
                                    onClick={() => downloadSubmission(row, "pdf")}
                                    sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", borderRadius: 1.5, minWidth: 0, px: 1.25, borderColor: isDarkMode ? "#374151" : "#E2E8F0", color: isDarkMode ? "#E5E7EB" : "#334155" }}
                                  >
                                    PDF
                                  </Button>
                                  {isCustomBuilderSubmission(row) ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<FileText size={14} />}
                                      onClick={() => downloadSubmission(row, "word")}
                                      sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", borderRadius: 1.5, minWidth: 0, px: 1.25, borderColor: isDarkMode ? "#374151" : "#E2E8F0", color: isDarkMode ? "#E5E7EB" : "#334155" }}
                                    >
                                      Word
                                    </Button>
                                  ) : null}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </DialogContent>

            <DialogActions
              sx={{
                px: 3,
                py: 2,
                bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
                borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="contained"
                onClick={closeDetails}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: "none",
                  fontWeight: 700,
                  boxShadow: "none",
                  bgcolor: isDarkMode ? "#E89F17" : "#0B4DA6",
                  "&:hover": { boxShadow: "none", bgcolor: isDarkMode ? "#D97706" : "#083D86" },
                }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Submission preview — view form in modal */}
      <Dialog
        open={submissionPreviewOpen}
        onClose={closeSubmissionPreview}
        fullWidth
        maxWidth="lg"
        slotProps={{ backdrop: { sx: { backdropFilter: "blur(4px)" } } }}
        PaperProps={{
          sx: {
            height: "min(90vh, 900px)",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            pr: 1,
            borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)",
            color: isDarkMode ? "#F9FAFB" : "#0f172a",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {submissionPreviewTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#64748B", mt: 0.25 }}>
              Read-only preview
            </Typography>
          </Box>
          {submissionPreviewRow ? (
            <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={16} />}
                onClick={() => downloadSubmission(submissionPreviewRow, "pdf")}
                sx={{ textTransform: "none", fontWeight: 600, borderColor: isDarkMode ? "#374151" : "#E2E8F0", color: isDarkMode ? "#E5E7EB" : "#334155" }}
              >
                PDF
              </Button>
              {isCustomBuilderSubmission(submissionPreviewRow) ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileText size={16} />}
                  onClick={() => downloadSubmission(submissionPreviewRow, "word")}
                  sx={{ textTransform: "none", fontWeight: 600, borderColor: isDarkMode ? "#374151" : "#E2E8F0", color: isDarkMode ? "#E5E7EB" : "#334155" }}
                >
                  Word
                </Button>
              ) : null}
            </Box>
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, overflow: "hidden", bgcolor: isDarkMode ? "#0B1220" : "#F8FAFC" }}>
          {submissionPreviewUrl ? (
            <iframe
              src={submissionPreviewUrl}
              title={submissionPreviewTitle || "Form preview"}
              style={{ border: "none", width: "100%", height: "100%" }}
            />
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)",
            bgcolor: isDarkMode ? "#111827" : "#FAFAF9",
          }}
        >
          <Button onClick={closeSubmissionPreview} sx={{ textTransform: "none", fontWeight: 600, color: isDarkMode ? "#9CA3AF" : "#64748B" }}>
            Close
          </Button>
          {submissionPreviewRow ? (
            <Button
              variant="contained"
              startIcon={<Download size={16} />}
              onClick={() => downloadSubmission(submissionPreviewRow, "pdf")}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                boxShadow: "none",
                bgcolor: isDarkMode ? "#E89F17" : "#0B4DA6",
                "&:hover": { boxShadow: "none", bgcolor: isDarkMode ? "#D97706" : "#083D86" },
              }}
            >
              Download PDF
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onClose={() => setAccessDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: isDarkMode ? "1px solid #374151" : "none" }}>Manage Access</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1, mb: 2, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
            Set role and optionally restrict this user to view-only access on selected pages.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {assignableRoles.map((role) => (
              <Paper
                key={role}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  borderRadius: 3,
                  transition: "all 0.2s",
                  borderColor: selectedRole === role ? (isDarkMode ? '#60A5FA' : '#0B4DA6') : (isDarkMode ? '#374151' : '#E5E7EB'),
                  bgcolor: selectedRole === role ? (isDarkMode ? 'rgba(96,165,250,0.1)' : 'rgba(11,77,166,0.04)') : 'transparent',
                  "&:hover": {
                    bgcolor: selectedRole === role ? (isDarkMode ? 'rgba(96,165,250,0.15)' : 'rgba(11,77,166,0.06)') : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#FAFAFA')
                  }
                }}
                onClick={() => setSelectedRole(role)}
              >
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid', borderColor: selectedRole === role ? (isDarkMode ? '#60A5FA' : '#0B4DA6') : (isDarkMode ? '#4B5563' : '#D1D5DB'), display: 'grid', placeItems: 'center' }}>
                  {selectedRole === role && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: isDarkMode ? '#60A5FA' : '#0B4DA6' }} />}
                </Box>
                <Typography sx={{ fontWeight: 600, textTransform: 'capitalize', color: selectedRole === role ? (isDarkMode ? "#F9FAFB" : "#111827") : (isDarkMode ? "#9CA3AF" : "#4B5563") }}>{role.replace('_', ' ')}</Typography>
              </Paper>
            ))}
          </Box>
          <UserPageAccessFields
            viewOnly={accessViewOnly}
            onViewOnlyChange={setAccessViewOnly}
            selectedPages={accessPages}
            onTogglePage={toggleAccessPage}
            pageCatalog={pageCatalog}
            isDarkMode={isDarkMode}
            disabled={accessUser?.role === "superadmin"}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: isDarkMode ? "1px solid #374151" : "none" }}>
          <Button onClick={() => setAccessDialogOpen(false)} sx={{ borderRadius: 50, px: 3, textTransform: "none", color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccess} disabled={accessSaving} sx={{ borderRadius: 50, px: 3, textTransform: "none", bgcolor: isDarkMode ? "#3B82F6" : "#0B4DA6", boxShadow: "none", "&:hover": { bgcolor: isDarkMode ? "#2563EB" : "#083D86", boxShadow: "none" } }}>
            {accessSaving ? "Saving..." : "Update Access"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleteInFlight && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete User</DialogTitle>
        <DialogContent><Typography sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Are you sure you want to delete <b style={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>{deleteUser?.firstName}</b>?</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteInFlight} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteInFlight} sx={{ borderRadius: 50, px: 3 }}>
            {deleteInFlight ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog (superadmin) */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => !bulkDeleteInFlight && setBulkDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Selected Users</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
            Are you sure you want to delete <b style={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>{selectedIds.length}</b> selected user{selectedIds.length === 1 ? "" : "s"}? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkDeleteDialogOpen(false)} disabled={bulkDeleteInFlight} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleBulkDelete} disabled={bulkDeleteInFlight} sx={{ borderRadius: 50, px: 3 }}>
            {bulkDeleteInFlight ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
        PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #F3F4F6" }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(11,77,166,0.1)', display: 'grid', placeItems: 'center' }}>
              <PersonAddIcon sx={{ color: '#0B4DA6', fontSize: 20 }} />
            </Box>
            Invite New User
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 4.5, pb: 1 }}>
          {(() => {
            // Shared field style — keeps code DRY
            const fieldSx = {
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor: isDarkMode ? '#1B212C' : '#F9FAFB',
                '& fieldset': { borderColor: isDarkMode ? '#374151' : '#E5E7EB' },
                '&:hover fieldset': { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                '&.Mui-focused fieldset': { borderColor: '#0B4DA6', borderWidth: 1.5 },
                '&.Mui-error fieldset': { borderColor: '#EF4444' },
                '& .MuiInputBase-input': { color: isDarkMode ? '#F9FAFB' : '#111827', fontSize: '0.9rem' },
              },
              '& .MuiInputLabel-root': { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: '0.9rem' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#0B4DA6' },
              '& .MuiInputLabel-root.Mui-error': { color: '#EF4444' },
              '& .MuiFormHelperText-root': { fontSize: '0.78rem', mx: 0.5, mt: 0.25, mb: 0 },
              '& .MuiFormHelperText-root.Mui-error': { color: '#EF4444' },
            };

            return (
              <Box
                component="form"
                id="invite-user-form"
                autoComplete="on"
                onSubmit={(e) => e.preventDefault()}
                sx={{ display: 'grid', gap: 1.5 }}
              >
                {/* Name row */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="First Name"
                      fullWidth size="small"
                      name="invite-given-name"
                      autoComplete="given-name"
                      value={inviteForm.firstName}
                      onChange={e => {
                        setInviteForm(f => ({ ...f, firstName: e.target.value }));
                        if (inviteErrors.firstName) setInviteErrors(e => ({ ...e, firstName: undefined }));
                      }}
                      error={!!inviteErrors.firstName}
                      helperText={inviteErrors.firstName}
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Last Name"
                      fullWidth size="small"
                      name="invite-family-name"
                      autoComplete="family-name"
                      value={inviteForm.lastName}
                      onChange={e => {
                        setInviteForm(f => ({ ...f, lastName: e.target.value }));
                        if (inviteErrors.lastName) setInviteErrors(e => ({ ...e, lastName: undefined }));
                      }}
                      error={!!inviteErrors.lastName}
                      helperText={inviteErrors.lastName}
                      sx={fieldSx}
                    />
                  </Grid>
                </Grid>

                {/* Email */}
                <TextField
                  label="Email Address"
                  type="email"
                  fullWidth size="small"
                  name="invite-email"
                  autoComplete="email"
                  value={inviteForm.email}
                  onChange={e => {
                    setInviteForm(f => ({ ...f, email: e.target.value }));
                    if (inviteErrors.email) setInviteErrors(e => ({ ...e, email: undefined }));
                  }}
                  error={!!inviteErrors.email}
                  helperText={inviteErrors.email}
                  sx={fieldSx}
                />

                <TextField
                  label="Mobile Number"
                  fullWidth size="small"
                  name="invite-tel"
                  autoComplete="tel"
                  placeholder="+447700900123"
                  value={inviteForm.mobile}
                  onChange={e => setInviteForm(f => ({ ...f, mobile: e.target.value }))}
                  sx={fieldSx}
                />

                {/* Company — fixed for company admin; dropdown for super admin */}
                {isCompanyAdminAccount && !isSuperAdminAccount && (
                  <TextField
                    label="Company"
                    fullWidth
                    size="small"
                    value={currentUser?.companyname || inviteForm.companyname || ""}
                    InputProps={{ readOnly: true }}
                    disabled
                    helperText="New users are added to your organisation"
                    sx={{
                      ...fieldSx,
                      "& .MuiInputBase-input.Mui-disabled": {
                        WebkitTextFillColor: isDarkMode ? "#F9FAFB" : "#111827",
                        color: isDarkMode ? "#F9FAFB" : "#111827",
                      },
                    }}
                  />
                )}
                {isSuperAdminAccount && (
                  <TextField
                    select
                    label="Select Company"
                    fullWidth size="small"
                    value={inviteForm.clientId || ""}
                    onChange={e => {
                      const selectedClient = clientsList.find(c => (c.id || c._id) === e.target.value);
                      setInviteForm(f => ({ ...f, clientId: e.target.value, companyname: selectedClient ? selectedClient.name : "" }));
                      if (inviteErrors.clientId) setInviteErrors((er) => ({ ...er, clientId: undefined }));
                    }}
                    error={!!inviteErrors.clientId}
                    helperText={inviteErrors.clientId}
                    sx={{
                      ...fieldSx,
                      "& .MuiSelect-select": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                      "& .MuiSelect-icon": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                    }}
                  >
                    <MenuItem value="" sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                      <em>None</em>
                    </MenuItem>
                    {clientsList.map(client => (
                      <MenuItem key={client.id || client._id} value={client.id || client._id}>
                        {client.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {/* Password */}
                <TextField
                  label="Password"
                  type={inviteShowPassword ? 'text' : 'password'}
                  fullWidth size="small"
                  name="invite-new-password"
                  autoComplete="new-password"
                  value={inviteForm.password}
                  onChange={e => {
                    setInviteForm(f => ({ ...f, password: e.target.value }));
                    if (inviteErrors.password) setInviteErrors(e => ({ ...e, password: undefined }));
                  }}
                  error={!!inviteErrors.password}
                  helperText={inviteErrors.password || 'User can change this after first login'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setInviteShowPassword(s => !s)}
                          edge="end"
                          sx={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                        >
                          {inviteShowPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={fieldSx}
                />

                {/* Role Picker */}
                <Box>
                  <Typography variant="caption" sx={{
                    color: isDarkMode ? '#9CA3AF' : '#6B7280',
                    mb: 1, display: 'block', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.72rem'
                  }}>
                    Assign Role
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {assignableRoles.map((r) => (
                      <Paper
                        key={r}
                        variant="outlined"
                        onClick={() => setInviteForm(f => ({ ...f, role: r }))}
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          cursor: 'pointer',
                          borderRadius: 3,
                          transition: 'all 0.18s',
                          borderColor: inviteForm.role === r
                            ? (isDarkMode ? '#60A5FA' : '#0B4DA6')
                            : (isDarkMode ? '#374151' : '#E5E7EB'),
                          bgcolor: inviteForm.role === r
                            ? (isDarkMode ? 'rgba(96,165,250,0.1)' : 'rgba(11,77,166,0.05)')
                            : (isDarkMode ? 'transparent' : '#FAFAFA'),
                          '&:hover': {
                            borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                            bgcolor: inviteForm.role === r
                              ? undefined
                              : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#F3F4F6'),
                          },
                        }}
                      >
                        {/* Radio dot */}
                        <Box sx={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: '2px solid',
                          borderColor: inviteForm.role === r
                            ? (isDarkMode ? '#60A5FA' : '#0B4DA6')
                            : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}>
                          {inviteForm.role === r && (
                            <Box sx={{
                              width: 10, height: 10, borderRadius: '50%',
                              bgcolor: isDarkMode ? '#60A5FA' : '#0B4DA6'
                            }} />
                          )}
                        </Box>
                        <Box>
                          <Typography sx={{
                            fontWeight: 600, fontSize: '0.875rem',
                            textTransform: 'capitalize',
                            color: inviteForm.role === r
                              ? (isDarkMode ? '#F9FAFB' : '#111827')
                              : (isDarkMode ? '#D1D5DB' : '#374151'),
                          }}>
                            {r.replace(/_/g, ' ')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: isDarkMode ? '#6B7280' : '#9CA3AF' }}>
                            {r === 'worker'        ? 'Can submit forms' :
                             r === 'supervisor'    ? 'Can submit forms & run inspections' :
                             r === 'site_manager'  ? 'Manages sites, forms & users' :
                             r === 'company_admin' ? 'Full company access' :
                                                    'Full system access'}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: isDarkMode ? '1px solid #374151' : '1px solid #F3F4F6' }}>
          <Button
            onClick={() => setInviteDialogOpen(false)}
            sx={{ borderRadius: 50, px: 3, textTransform: 'none', color: isDarkMode ? '#9CA3AF' : 'inherit' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={inviteLoading}
            onClick={async () => {
              // Validate
              const errs = {};
              const inviteFn = plainNameError(inviteForm.firstName, "First name");
              const inviteLn = plainNameError(inviteForm.lastName, "Last name");
              if (inviteFn) errs.firstName = inviteFn;
              if (inviteLn) errs.lastName = inviteLn;
              if (!inviteForm.email.trim()) errs.email = 'Required';
              else if (!/^\S+@\S+\.\S+$/.test(inviteForm.email)) errs.email = 'Invalid email';
              if (!inviteForm.password) errs.password = 'Required';
              else {
                const pwErr = newPasswordError(inviteForm.password);
                if (pwErr) errs.password = pwErr;
              }
              if (isSuperAdminAccount && !inviteForm.clientId?.trim()) {
                errs.clientId = "Select a company";
              }
              if (Object.keys(errs).length) { setInviteErrors(errs); return; }

              setInviteLoading(true);
              try {
                const cid =
                  typeof currentUser?.clientId === "string"
                    ? currentUser.clientId
                    : currentUser?.clientId?.id ?? "";
                const payload = {
                  ...inviteForm,
                  ...(isSuperAdminAccount
                    ? {}
                    : {
                        clientId: cid,
                        companyname: currentUser?.companyname || inviteForm.companyname || "",
                      }),
                };
                const res = await api.post('/users/invite', payload, { timeout: LIST_FETCH_TIMEOUT_MS });
                if (res?.data?.success) {
                  setSnack({
                    open: true,
                    msg: "User invited",
                    severity: "success",
                  });
                  setInviteDialogOpen(false);
                  const created = res.data.user;
                  if (created?.id) {
                    setUsers((prev) => [
                      normalizeUserActivityFields({
                        ...created,
                        _id: created.id,
                        id: created.id,
                        mobile: inviteForm.mobile,
                        clientId: inviteForm.clientId || created.clientId,
                      }),
                      ...prev,
                    ]);
                  } else {
                    fetchUsers({ silent: true });
                  }
                } else {
                  throw new Error(res?.data?.message || 'Failed to invite user');
                }
              } catch (err) {
                const msg = err?.response?.data?.message || err.message || 'Failed to invite user';
                setSnack({ open: true, msg, severity: 'error' });
              } finally {
                setInviteLoading(false);
              }
            }}
            sx={{ borderRadius: 50, px: 3, textTransform: 'none', bgcolor: '#0B4DA6', boxShadow: 'none', '&:hover': { bgcolor: '#083D86', boxShadow: 'none' } }}
          >
            {inviteLoading ? 'Inviting...' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: "top", horizontal: "right" }} sx={{ mt: 8, mr: 2 }}>
        <Alert severity={snack.severity || "info"} sx={{ width: "100%", borderRadius: "12px" }}>{snack.msg}</Alert>
      </Snackbar>
    </Layout >
  );
}
