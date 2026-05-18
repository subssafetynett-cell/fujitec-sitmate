import React, { useState, useEffect } from "react";
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
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Switch,
    MenuItem,
    InputAdornment,
    CircularProgress,
    Tooltip,
    TablePagination,
    Menu,
    Divider,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { formatUserDisplayName, formatUserDisplayNameWithEmail } from "../utils/plainName";
import AddIcon from "@mui/icons-material/Add";
import { Eye, Pencil, Trash2, UserX, UserCheck, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { canCreateSites } from "../utils/siteAccess";
import {
    fetchSites,
    createSite,
    updateSite,
    deleteSite,
    fetchSiteManagers,
} from "../services/api";

export default function CreateSitesPage() {
    const { isDarkMode } = useTheme();
    const { role } = useAuth();
    const allowCreateSites = canCreateSites(role);
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get("search") || "";

    useEffect(() => {
        setSearch(searchQuery);
    }, [searchQuery]);

    // Pagination State
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dialog State
    const [openDialog, setOpenDialog] = useState(false);
    const [managers, setManagers] = useState([]);
    const [newSite, setNewSite] = useState({
        name: "",
        address: "",
        managerId: "",
    });
    const [dialogMode, setDialogMode] = useState("create"); // create, edit, view
    const [selectedSiteId, setSelectedSiteId] = useState(null);
    const [creating, setCreating] = useState(false);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [siteToDelete, setSiteToDelete] = useState(null);

    // Action Menu State
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuSite, setMenuSite] = useState(null);

    const openMenu = (event, site) => {
        setAnchorEl(event.currentTarget);
        setMenuSite(site);
    };

    const closeMenu = () => {
        setAnchorEl(null);
        setMenuSite(null);
    };

    useEffect(() => {
        loadSites();
        setPage(0);
    }, [search]); // Reload when search changes (debouncing could be added)

    const loadSites = async () => {
        setLoading(true);
        try {
            const data = await fetchSites(search);
            setSites(data);
        } catch (error) {
            console.error("Failed to load sites", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchManagersIfNeeded = async () => {
        if (managers.length === 0) {
            try {
                const mgrs = await fetchSiteManagers();
                setManagers(mgrs);
            } catch (error) {
                console.error("Failed to load managers", error);
            }
        }
    };

    const handleOpenCreate = async () => {
        if (!allowCreateSites) return;
        setDialogMode("create");
        setNewSite({ name: "", address: "", managerId: "" });
        setOpenDialog(true);
        fetchManagersIfNeeded();
    };

    const handleOpenEdit = async (site) => {
        setDialogMode("edit");
        setSelectedSiteId(site.id);
        setNewSite({
            name: site.name,
            address: site.address,
            managerId: site.managerId || "",
        });
        setOpenDialog(true);
        fetchManagersIfNeeded();
    };

    const handleOpenView = async (site) => {
        setDialogMode("view");
        setNewSite({
            name: site.name,
            address: site.address,
            managerId: site.managerId || "",
        });
        setOpenDialog(true);
        fetchManagersIfNeeded();
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setNewSite({ name: "", address: "", managerId: "" });
        setSelectedSiteId(null);
    };

    const handleSubmit = async () => {
        if (dialogMode === "view") {
            handleCloseDialog();
            return;
        }

        if (!newSite.name || !newSite.address) {
            alert("Please fill out the Site Name and Address fields.");
            return;
        }
        setCreating(true);
        try {
            const payload = { ...newSite };
            if (!payload.managerId) {
                delete payload.managerId;
            }
            if (dialogMode === "create") {
                if (!allowCreateSites) {
                    alert("Only Super Admin or Company Admin can create sites.");
                    return;
                }
                await createSite(payload);
            } else if (dialogMode === "edit") {
                await updateSite(selectedSiteId, payload);
            }
            handleCloseDialog();
            loadSites();
        } catch (error) {
            console.error("Failed to save site", error);
            alert("Failed to save site");
        } finally {
            setCreating(false);
        }
    };

    const handleToggleActive = async (site) => {
        try {
            await updateSite(site.id, { isActive: !site.isActive });
            loadSites(); // Refresh list to reflect changes
        } catch (error) {
            console.error("Failed to update site status", error);
            alert("Failed to update site status");
        }
    };

    const handleDelete = async () => {
        if (!siteToDelete) return;
        try {
            await deleteSite(siteToDelete.id);
            setDeleteConfirmOpen(false);
            setSiteToDelete(null);
            loadSites();
        } catch (error) {
            console.error("Failed to delete site", error);
            alert("Failed to delete site");
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Layout>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4, alignItems: "center" }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827" }}>
                        All Sites
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                        manage and create your sites
                    </Typography>
                </Box>
                {allowCreateSites && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreate}
                        sx={{
                            textTransform: "none",
                            borderRadius: 3,
                            boxShadow: "none",
                            bgcolor: "hsl(38, 70%, 55%)",
                            "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" },
                        }}
                    >
                        Create New Site
                    </Button>
                )}
            </Box>

            {/* Removed search bar from here as requested */}

            <Paper sx={{ width: "100%", mb: 2, borderRadius: 4, overflow: "hidden", border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB", bgcolor: isDarkMode ? "#111827" : "inherit" }} elevation={0}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: isDarkMode ? "#1B212C" : "#F9FAFB" }}>
                                <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#9CA3AF" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Sl No</TableCell>
                                <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Site Name</TableCell>
                                <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Address</TableCell>
                                <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Manager</TableCell>
                                <TableCell sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 500, color: isDarkMode ? "#F9FAFB" : "#6B7280", fontSize: "0.85rem", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : (sites || []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: isDarkMode ? "#9CA3AF" : "inherit", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                                        No sites found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (sites || [])
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((site, index) => (
                                        <TableRow key={site.id}>
                                            <TableCell sx={{ fontSize: "0.85rem", color: isDarkMode ? "#9CA3AF" : "#6B7280", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>{page * rowsPerPage + index + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 500, fontSize: "0.9rem", color: isDarkMode ? "#F9FAFB" : "#111827", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>{site.name}</TableCell>
                                            <TableCell sx={{ fontSize: "0.85rem", color: isDarkMode ? "#9CA3AF" : "#4B5563", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>{site.address}</TableCell>
                                            <TableCell sx={{ fontSize: "0.85rem", color: isDarkMode ? "#9CA3AF" : "#4B5563", borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                                                {site.manager
                                                    ? formatUserDisplayName(site.manager)
                                                    : "N/A"}
                                            </TableCell>
                                            <TableCell sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                                                <Box
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: '9999px',
                                                        bgcolor: site.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        color: site.isActive ? '#22C55E' : '#EF4444',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 400,
                                                        textTransform: 'capitalize'
                                                    }}
                                                >
                                                    {site.isActive ? "Active" : "Inactive"}
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right" sx={{ borderColor: isDarkMode ? "#374151" : "rgba(224, 224, 224, 1)" }}>
                                                <IconButton size="small" onClick={(e) => openMenu(e, site)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                                                    <MoreHorizIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                        Showing {sites.length === 0 ? 0 : page * rowsPerPage + 1} to {Math.min(page * rowsPerPage + rowsPerPage, sites.length)} of {sites.length} sites
                    </Typography>
                    <TablePagination
                        component="div"
                        count={sites.length}
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
            </Paper>

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
                    onClick={() => { if (!menuSite) return; handleOpenView(menuSite); closeMenu(); }}
                    sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
                >
                    <Eye size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> View Details
                </MenuItem>

                <MenuItem
                    onClick={() => { if (!menuSite) return; handleOpenEdit(menuSite); closeMenu(); }}
                    sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
                >
                    <Pencil size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Edit Site
                </MenuItem>

                <MenuItem
                    onClick={() => { if (!menuSite) return; handleToggleActive(menuSite); closeMenu(); }}
                    sx={{ borderRadius: 2, mb: 0.5, py: 1, fontSize: "0.95rem", color: isDarkMode ? "#F9FAFB" : "#1F2937", "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" } }}
                >
                    {menuSite?.isActive ? (
                        <><UserX size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Make Inactive</>
                    ) : (
                        <><UserCheck size={18} style={{ marginRight: 12, color: isDarkMode ? "#9CA3AF" : "#374151" }} /> Make Active</>
                    )}
                </MenuItem>

                <Divider sx={{ my: 1, borderColor: isDarkMode ? "#374151" : "#F3F4F6" }} />

                <MenuItem
                    onClick={() => { if (!menuSite) return; setSiteToDelete(menuSite); setDeleteConfirmOpen(true); closeMenu(); }}
                    sx={{ borderRadius: 2, py: 1, color: "#EF4444", fontSize: "0.95rem", "&:hover": { bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.05)" } }}
                >
                    <Trash2 size={18} style={{ marginRight: 12, color: "#EF4444" }} /> Delete Site
                </MenuItem>
            </Menu >

            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 6,
                        bgcolor: isDarkMode ? "#111827" : "#F4F3F1",
                        p: 1.5,
                        px: 2,
                        position: "relative",
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <IconButton
                    onClick={handleCloseDialog}
                    sx={{ position: "absolute", top: 16, right: 16, color: "text.secondary" }}
                >
                    <X size={20} />
                </IconButton>

                <DialogContent sx={{ p: 1 }}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#1e293b", lineHeight: 1.2 }}>
                            {dialogMode === "create" && "Create New Site"}
                            {dialogMode === "edit" && "Edit Site"}
                            {dialogMode === "view" && "Site Details"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#64748b" }}>
                            {dialogMode === "create" ? "Enter the details to add new site." : "Modify the site details below."}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5, color: isDarkMode ? "#E5E7EB" : "#1e293b" }}>
                                Site Name
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="Enter site name"
                                required
                                disabled={dialogMode === "view"}
                                value={newSite.name}
                                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 50,
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                                        px: 1,
                                        color: isDarkMode ? "#F9FAFB" : "inherit",
                                        "& fieldset": { borderColor: isDarkMode ? "#374151" : "rgba(0,0,0,0.1)" },
                                        "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 2 },
                                    },
                                    "& .MuiInputBase-input": { py: 1.5, px: 2 },
                                    "& .MuiInputBase-input::placeholder": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                                }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5, color: isDarkMode ? "#E5E7EB" : "#1e293b" }}>
                                Site Address
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="Enter site address"
                                required
                                multiline
                                rows={2}
                                disabled={dialogMode === "view"}
                                value={newSite.address}
                                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 4,
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                                        px: 1,
                                        color: isDarkMode ? "#F9FAFB" : "inherit",
                                        "& fieldset": { borderColor: isDarkMode ? "#374151" : "rgba(0,0,0,0.1)" },
                                        "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 2 },
                                    },
                                    "& .MuiInputBase-input": { py: 1.5, px: 2 },
                                    "& .MuiInputBase-input::placeholder": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                                }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5, color: isDarkMode ? "#E5E7EB" : "#1e293b" }}>
                                Site Manager
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                disabled={dialogMode === "view"}
                                value={newSite.managerId || ""}
                                onChange={(e) => setNewSite({ ...newSite, managerId: e.target.value })}
                                SelectProps={{
                                    renderValue: (selected) => {
                                        if (!selected) {
                                            return <em>None</em>;
                                        }
                                        const mgr = managers.find((m) => m.id === selected);
                                        return mgr
                                            ? formatUserDisplayNameWithEmail(mgr)
                                            : selected;
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 50,
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                                        px: 1,
                                        color: isDarkMode ? "#F9FAFB" : "inherit",
                                        "& fieldset": { borderColor: isDarkMode ? "#374151" : "rgba(0,0,0,0.1)" },
                                        "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 2 },
                                    },
                                    "& .MuiInputBase-input": { py: 1.5, px: 2 },
                                }}
                            >
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {managers.map((mgr) => (
                                    <MenuItem key={mgr.id} value={mgr.id}>
                                        <Box sx={{ display: "flex", flexDirection: "column", py: 0.25 }}>
                                            <Typography
                                                component="span"
                                                variant="body2"
                                                sx={{ fontWeight: 500, lineHeight: 1.35 }}
                                            >
                                                {formatUserDisplayName(mgr)}
                                            </Typography>
                                            {mgr.email ? (
                                                <Typography
                                                    component="span"
                                                    variant="caption"
                                                    sx={{
                                                        color: isDarkMode ? "#9CA3AF" : "#64748b",
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {mgr.email}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 4 }}>
                        <Button
                            onClick={handleCloseDialog}
                            sx={{
                                textTransform: "none",
                                borderRadius: 4,
                                px: 4,
                                py: 1.2,
                                color: isDarkMode ? "#F9FAFB" : "#1e293b",
                                fontWeight: 600,
                                bgcolor: isDarkMode ? "#1B212C" : "white",
                                border: isDarkMode ? "1px solid #374151" : "1px solid rgba(0,0,0,0.1)",
                                "&:hover": { bgcolor: isDarkMode ? "#374151" : "#f8fafc" }
                            }}
                        >
                            {dialogMode === "view" ? "Close" : "Cancel"}
                        </Button>
                        {dialogMode !== "view" && (
                            <Button
                                onClick={handleSubmit}
                                variant="contained"
                                disabled={creating}
                                sx={{
                                    textTransform: "none",
                                    borderRadius: 4,
                                    px: 4,
                                    py: 1.2,
                                    bgcolor: "hsl(38, 70%, 55%)",
                                    color: "white",
                                    fontWeight: 600,
                                    boxShadow: "none",
                                    "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" }
                                }}
                            >
                                {creating ? "Saving..." : (dialogMode === "create" ? "Create Site" : "Update Site")}
                            </Button>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 6,
                        bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                        p: 1.5,
                        px: 2,
                        color: isDarkMode ? "#F9FAFB" : "inherit"
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>Delete Site</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: isDarkMode ? "#9CA3AF" : "inherit" }}>
                        Are you sure you want to delete this site? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: isDarkMode ? "#9CA3AF" : "inherit", borderRadius: 50 }}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained" sx={{ borderRadius: 50, textTransform: "none" }}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Layout >
    );
}
