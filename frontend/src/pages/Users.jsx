import React, { useEffect, useState } from "react";
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
  TableSortLabel,
  TextField,
  Grid,
  Autocomplete,
  TablePagination,
  Divider,
  InputAdornment,
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
  Trash2
} from "lucide-react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth, ASSIGNABLE_ROLES } from "../context/AuthContext";

/* Helper to compute avatar/url */
const computeAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  const host = import.meta.env.VITE_BACKEND_URL || "https://api.site-mateai.co.uk";
  return `${host.replace(/\/$/, "")}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
};

function descendingComparator(a, b, orderBy) {
  // Handle nested properties or fallbacks
  let valA = a[orderBy];
  let valB = b[orderBy];

  if (orderBy === 'name') {
    valA = a.firstName || a.username || "";
    valB = b.firstName || b.username || "";
  } else if (orderBy === 'site') {
    valA = a.companyname || a.company || "";
    valB = b.companyname || b.company || "";
  }

  if (typeof valA === 'string') valA = valA.toLowerCase();
  if (typeof valB === 'string') valB = valB.toLowerCase();

  if (valB < valA) return -1;
  if (valB > valA) return 1;
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const headCells = [
  { id: 'name', label: 'Name', sortable: true },
  { id: 'email', label: 'Email', sortable: true },
  { id: 'site', label: 'Site', sortable: true }, // Mapped from companyname
  { id: 'role', label: 'Role', sortable: true },
  { id: 'active', label: 'Status', sortable: true },
  { id: 'actions', label: 'Action', sortable: false },
];

export default function UsersPage() {
  const { isDarkMode } = useTheme();
  const { id } = useParams(); // optional client id
  const location = useLocation();
  const clientName = location.state?.clientName;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSafetynettUser, setIsSafetynettUser] = useState(false);

  // Auth context for role-based UI
  const { role: currentRole, isSafetyNett, isCompanyAdmin } = useAuth();
  const canInvite = isCompanyAdmin || isSafetyNett;

  // Sorting State
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('createdAt');

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";

  // Search State
  const [searchName, setSearchName] = useState(searchQuery);
  const [searchCompany, setSearchCompany] = useState("");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchRole, setSearchRole] = useState("all");

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sync searchName with URL search query
  useEffect(() => {
    setSearchName(searchQuery);
  }, [searchQuery]);

  const [anchorEl, setAnchorEl] = useState(null);

  // ... (existing state)

  // Derived filtered list
  const filteredUsers = users.filter((u) => {
    // 1. Name/Email Filter
    const query = searchName.toLowerCase();
    const fullName = `${u.firstName || ""} ${u.lastName || ""} ${u.username || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const matchesName = !query || fullName.includes(query) || email.includes(query);

    // 2. Company Filter
    const companyQuery = searchCompany ? searchCompany.toLowerCase() : "";
    const company = (u.companyname || u.company || "").toLowerCase();
    const matchesCompany = !companyQuery || company.includes(companyQuery);

    // 3. Status Filter
    let matchesStatus = true;
    if (searchStatus === "active") matchesStatus = u.active === true;
    if (searchStatus === "inactive") matchesStatus = u.active === false;

    // 4. Role Filter
    const matchesRole = searchRole === "all" || (u.role && u.role === searchRole);

    return matchesName && matchesCompany && matchesStatus && matchesRole;
  });

  const paginatedUsers = stableSort(filteredUsers, getComparator(order, orderBy)).slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Get unique companies for dropdown
  const uniqueCompanies = Array.from(new Set(users.map(u => u.companyname || u.company).filter(Boolean))).sort();

  // Modify render to use filteredUsers instead of users

  const [menuUser, setMenuUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  // Edit User State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Access Management State
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessUser, setAccessUser] = useState(null);
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

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });

  // get current user
  const getCurrentUser = async () => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try { return JSON.parse(raw); } catch { }
    }
    try {
      const res = await api.get("/auth/me");
      return res?.data?.user ?? null;
    } catch {
      return null;
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const current = await getCurrentUser();
      const isSuper = current?.role === "superadmin";
      // Check if Safetynett
      const isSafetynett = (current?.companyname || current?.company || "")
        .toString().trim().toLowerCase() === "safetynett";
      setIsSafetynettUser(isSafetynett);

      if (current?.role === "worker" && !isSafetynett) {
        setUsers([]);
        setLoading(false);
        return;
      }

      let res;
      if (id) {
        res = await api.get(`/clients/${id}/users`);
      } else {
        res = await api.get("/users");
      }

      let list = res?.data?.users ?? res?.data ?? [];

      // FILTERS: If NOT SuperAdmin AND NOT Safetynett => Filter by my company
      if (!isSuper && !isSafetynett) {
        const myCompany = (current?.companyname || current?.company || "").trim().toLowerCase();
        list = list.filter(u => {
          const uCompany = (u.companyname || u.company || "").trim().toLowerCase();
          return uCompany === myCompany;
        });
      }

      // Default sort by createdAt initially to keep consistent ID order if needed, 
      // but UI sort state controls display
      setUsers(list);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setSnack({ open: true, msg: "Failed to load users", severity: "error" });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, [id]);

  const [clientsList, setClientsList] = useState([]);
  useEffect(() => {
    if (currentRole === 'superadmin') {
      api.get("/clients").then(res => {
        if (res?.data?.clients) setClientsList(res.data.clients);
        else if (Array.isArray(res?.data)) setClientsList(res.data);
      }).catch(err => console.error("Failed to fetch clients for dropdown", err));
    }
  }, [currentRole]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

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
    try {
      const newActive = !user.active;
      const res = await api.put(`/users/${user._id ?? user.id}/status`, { active: newActive });
      if (res?.data?.success) {
        setUsers((prev) => prev.map((u) => ((u._id ?? u.id) === (user._id ?? user.id) ? { ...u, active: newActive } : u)));
        setSnack({ open: true, msg: newActive ? "User activated" : "User deactivated", severity: "success" });
      } else {
        throw new Error(res?.data?.message || "Failed to update");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      setSnack({ open: true, msg: "Failed to update user status", severity: "error" });
    } finally {
      closeMenu();
    }
  };

  // VIEW User
  const handleView = async (user) => {
    try {
      const id = user._id ?? user.id;
      const res = await api.get(`/users/${id}`);
      const fullUser = res?.data?.user ?? user;
      setDetailUser(fullUser);
    } catch (err) {
      console.warn("Could not fetch full user, using local copy", err);
      setDetailUser(user);
    }
    setDetailOpen(true);
    closeMenu();
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailUser(null);
  };

  // EDIT User
  const handleEdit = (user) => {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      mobile: user.mobile || "",
      jobTitle: user.jobTitle || "",
      companyname: user.companyname || user.company || ""
    });
    setEditDialogOpen(true);
    closeMenu();
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      const id = editUser._id ?? editUser.id;
      const res = await api.put(`/users/${id}`, editForm);
      if (res?.data?.success) {
        setUsers(prev => prev.map(u => (u._id ?? u.id) === id ? { ...u, ...editForm } : u));
        setSnack({ open: true, msg: "User updated successfully", severity: "success" });
        setEditDialogOpen(false);
        setEditUser(null);
      } else {
        throw new Error(res?.data?.message || "Failed to update user");
      }
    } catch (err) {
      console.error("Update user error:", err);
      setSnack({ open: true, msg: "Failed to update user", severity: "error" });
    }
  };

  // RESEND INVITE
  const handleResendInvite = async (user) => {
    // Mock logic for now
    setSnack({ open: true, msg: `Invitation sent to ${user.email}`, severity: "success" });
    closeMenu();
  };

  // ACCESS
  const handleManageAccess = (user) => {
    setAccessUser(user);
    setSelectedRole(user.role || "user");
    setAccessDialogOpen(true);
    closeMenu();
  };

  const handleSaveAccess = async () => {
    if (!accessUser) return;
    try {
      const res = await api.put(`/users/${accessUser._id ?? accessUser.id}`, { role: selectedRole });
      if (res?.data?.success) {
        setSnack({ open: true, msg: "User role updated", severity: "success" });
        setUsers(prev => prev.map(u => (u._id ?? u.id) === (accessUser._id ?? accessUser.id) ? { ...u, role: selectedRole } : u));
        setAccessDialogOpen(false);
        setAccessUser(null);
      } else {
        throw new Error(res?.data?.message || "Failed");
      }
    } catch (err) {
      console.error("Update role error:", err);
      setSnack({ open: true, msg: "Failed to update role", severity: "error" });
    }
  };

  // DELETE
  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const res = await api.delete(`/users/${deleteUser._id ?? deleteUser.id}`);
      if (res?.data?.success) {
        setUsers((prev) => prev.filter((u) => (u._id ?? u.id) !== (deleteUser._id ?? deleteUser.id)));
        setSnack({ open: true, msg: "User deleted successfully", severity: "success" });
      } else {
        throw new Error(res?.data?.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      setSnack({ open: true, msg: "Failed to delete user", severity: "error" });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteUser(null);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", }}>
            {clientName ? `Users - ${clientName}` : "All Users"}
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
            Manage user accounts and permissions
          </Typography>
          <Typography sx={{ mt: 1, display: "inline-block", px: 1.5, py: 0.5, fontSize: "0.7rem", fontWeight: 500, color: "#0B4DA6", backgroundColor: "rgba(11, 77, 166, 0.1)", borderRadius: "12px" }}>
            {filteredUsers.length} members
          </Typography>
        </Box>

        {/* Invite User button — company_admin and above */}
        {canInvite && (
          <Button
            id="invite-user-btn"
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setInviteForm({ firstName: "", lastName: "", email: "", mobile: "", role: "worker", password: "", companyname: "", clientId: "" });
              setInviteErrors({});
              setInviteDialogOpen(true);
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

      {/* Search Filters */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* Search row */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or email..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
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

        {/* Dropdowns row */}
        {isSafetynettUser && (
          <Grid item xs={12} md={4}>
          <Autocomplete
            fullWidth
            freeSolo
            options={uniqueCompanies}
            value={searchCompany}
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
            <MenuItem value="superadmin" sx={{ borderRadius: 4, mx: 0.5, my: 0.2, fontSize: "0.85rem", "&:hover, &.Mui-selected, &.Mui-selected:hover": { bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important", color: isDarkMode ? "#60A5FA !important" : "#A16207 !important" } }}>Super Admin</MenuItem>
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
        loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 10 }} >
            <CircularProgress />
          </Box >
        ) : (
          <Box>
            <TableContainer component={Paper} elevation={0} sx={{ border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", borderRadius: 4, overflow: "hidden", bgcolor: isDarkMode ? "#111827" : "#FFFFFF" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB" }}>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>SL No</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Email</TableCell>
                    {isSafetynettUser && <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Company</TableCell>}
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", textTransform: "none", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paginatedUsers.map((user, idx) => {
                    const slNo = page * rowsPerPage + idx + 1;
                    return (
                      <TableRow key={user._id ?? user.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ color: isDarkMode ? "#F9FAFB" : "#111827", fontWeight: 500, borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>{slNo}</TableCell>

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Typography sx={{ fontWeight: 400, color: isDarkMode ? "#F9FAFB" : "#111827", fontSize: "0.95rem" }}>
                            {user.firstName ? `${user.firstName} ${user.lastName ?? ""}` : user.username ?? "(no name)"}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                          <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", fontWeight: 400, fontSize: "0.95rem" }}>{user.email ?? "-"}</Typography>
                        </TableCell>

                        {isSafetynettUser && (
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
                      <TableCell colSpan={isSafetynettUser ? 7 : 6} align="center" sx={{ py: 4, color: isDarkMode ? "#9CA3AF" : "inherit", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                Showing {filteredUsers.length === 0 ? 0 : page * rowsPerPage + 1} to {Math.min(page * rowsPerPage + rowsPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </Typography>
              <TablePagination
                component="div"
                count={filteredUsers.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10]}
                labelRowsPerPage=""
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

        <MenuItem
          onClick={() => { if (!menuUser) return; handleManageAccess(menuUser); }}
          sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
        >
          <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1.5, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Manage access
        </MenuItem>

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
            <TextField
              label="Site (Company)"
              fullWidth
              size="small"
              value={editForm.companyname}
              onChange={e => setEditForm({ ...editForm, companyname: e.target.value })}
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: isDarkMode ? "1px solid #374151" : "none" }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ borderRadius: 50, px: 3, textTransform: "none", color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} sx={{ borderRadius: 50, px: 3, textTransform: "none", bgcolor: isDarkMode ? "#3B82F6" : "#0B4DA6", boxShadow: "none", "&:hover": { bgcolor: isDarkMode ? "#2563EB" : "#083D86", boxShadow: "none" } }}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={detailOpen} onClose={closeDetails} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: isDarkMode ? "#1B212C" : "#f5f6f8", px: 3, py: 1.5, borderBottom: isDarkMode ? "1px solid #374151" : "none" }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>User details</Typography>
          <IconButton onClick={closeDetails} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></IconButton>
        </Box>
        <DialogContent p={3}>
          {detailUser && (
            <Box sx={{ display: "grid", gap: 3, py: 2 }}>
              <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                <Avatar sx={{ width: 96, height: 96, fontSize: '2rem', bgcolor: isDarkMode ? "#1B212C" : "#F3F4F6", color: isDarkMode ? "#F9FAFB" : "#111827" }}>{(detailUser.firstName || detailUser.username || "?").charAt(0).toUpperCase()}</Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: isDarkMode ? "#F9FAFB" : "inherit" }}>{detailUser.firstName} {detailUser.lastName}</Typography>
                  <Chip label={detailUser.active ? "active" : "inactive"} size="small" sx={{ mt: 1, borderRadius: 50, fontWeight: 600, bgcolor: detailUser.active ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.06)", color: detailUser.active ? "rgb(22,163,74)" : "rgb(220,38,38)" }} />
                  <Typography sx={{ mt: 1, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>{detailUser.jobTitle}</Typography>
                </Box>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 3, bgcolor: isDarkMode ? "#1B212C" : "transparent", borderColor: isDarkMode ? "#374151" : "#E5E7EB" }} variant="outlined">
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>Contact Information</Typography>
                    <Box sx={{ display: "grid", gap: 1 }}>
                      <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>Email: <b style={{ color: isDarkMode ? "#F9FAFB" : "#111827" }}>{detailUser.email}</b></Typography>
                      <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>Phone: <b style={{ color: isDarkMode ? "#F9FAFB" : "#111827" }}>{detailUser.mobile}</b></Typography>
                      <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>Site: <b style={{ color: isDarkMode ? "#F9FAFB" : "#111827" }}>{detailUser.companyname}</b></Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onClose={() => setAccessDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: isDarkMode ? "1px solid #374151" : "none" }}>Manage Access</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, mt: 1 }}>
            {["superadmin", "company_admin", "site_manager", "supervisor", "worker"].map((role) => (
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
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: isDarkMode ? "1px solid #374151" : "none" }}>
          <Button onClick={() => setAccessDialogOpen(false)} sx={{ borderRadius: 50, px: 3, textTransform: "none", color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccess} sx={{ borderRadius: 50, px: 3, textTransform: "none", bgcolor: isDarkMode ? "#3B82F6" : "#0B4DA6", boxShadow: "none", "&:hover": { bgcolor: isDarkMode ? "#2563EB" : "#083D86", boxShadow: "none" } }}>Update Access</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? "#111827" : "#FFFFFF", color: isDarkMode ? "#F9FAFB" : "inherit" } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete User</DialogTitle>
        <DialogContent><Typography sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Are you sure you want to delete <b style={{ color: isDarkMode ? "#F9FAFB" : "inherit" }}>{deleteUser?.firstName}</b>?</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ borderRadius: 50, px: 3 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
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
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {/* Name row */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="First Name"
                      fullWidth size="small"
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
                  placeholder="+447700900123"
                  value={inviteForm.mobile}
                  onChange={e => setInviteForm(f => ({ ...f, mobile: e.target.value }))}
                  sx={fieldSx}
                />

                {/* Company Dropdown (only for superadmin) */}
                {currentRole === 'superadmin' && (
                  <TextField
                    select
                    label="Select Company"
                    fullWidth size="small"
                    value={inviteForm.clientId || ""}
                    onChange={e => {
                      const selectedClient = clientsList.find(c => (c.id || c._id) === e.target.value);
                      setInviteForm(f => ({ ...f, clientId: e.target.value, companyname: selectedClient ? selectedClient.name : "" }));
                    }}
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
                    {(ASSIGNABLE_ROLES[currentRole] || ['worker', 'supervisor', 'site_manager']).map((r) => (
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
              if (!inviteForm.firstName.trim()) errs.firstName = 'Required';
              if (!inviteForm.lastName.trim()) errs.lastName = 'Required';
              if (!inviteForm.email.trim()) errs.email = 'Required';
              else if (!/^\S+@\S+\.\S+$/.test(inviteForm.email)) errs.email = 'Invalid email';
              if (!inviteForm.password) errs.password = 'Required';
              else if (inviteForm.password.length < 6) errs.password = 'Minimum 6 characters';
              if (Object.keys(errs).length) { setInviteErrors(errs); return; }

              setInviteLoading(true);
              try {
                const res = await api.post('/users/invite', inviteForm);
                if (res?.data?.success) {
                  setSnack({ open: true, msg: `${inviteForm.firstName} has been invited successfully`, severity: 'success' });
                  setInviteDialogOpen(false);
                  fetchUsers(); // refresh list
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
