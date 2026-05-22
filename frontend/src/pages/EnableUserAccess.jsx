// src/pages/EnableUserAccess.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Box,
    Grid,
    Paper,
    Typography,
    TextField,
    MenuItem,
    Button,
    Snackbar,
    Alert,
    CircularProgress,
    Autocomplete
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Layout from "../components/Layout";
import api from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { isSafetynettCompanyName } from "../utils/resolveEffectiveRole";
import { useAuth } from "../context/AuthContext";

const PERMISSION_LEVELS = [
    { id: 4, title: "Superadmin (Level 4)", desc: "The highest level of access. The user will be able to view dashboards, send messages, view reports, conduct audit inspections, edit and delete sections of the report and delete the whole report. The user can also manage the entire table of users, details, and activity logs.", color: "rgba(34,197,94,0.06)", role: "superadmin" },
    { id: 3, title: "Company Admin (Level 3)", desc: "High-level access for company management. The user can view dashboards, reports, and conduct inspections. They can manage company users and view activity logs but may have restricted access to global system settings.", color: "rgba(34,197,94,0.06)", role: "company_admin" },
    { id: 2, title: "Site Manager (Level 2)", desc: "Management access for specific sites. The user can view dashboards, reports, and conduct audit inspections. They can edit sections of reports but cannot delete entire reports or manage user lists.", color: "rgba(250,204,21,0.06)", role: "site_manager" },
    { id: 1, title: "Supervisor (Level 1)", desc: "Supervisory access. The user can view dashboards and download reports but cannot edit report sections or conduct inspections.", color: "rgba(99,102,241,0.06)", role: "supervisor" },
    { id: 0, title: "Worker (Level 0)", desc: "The lowest level of permissions. The user can log in, view dashboards, and send messages but cannot view reports or conduct inspections.", color: "rgba(59,130,246,0.06)", role: "worker" },
];

export default function EnableUserAccessPage() {
    const { isDarkMode } = useTheme();
    const { isSuperAdmin } = useAuth();
    const [form, setForm] = useState({
        email: "",
        companyId: "",
        permission: 0,
    });

    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // User validation state
    const [checkingUser, setCheckingUser] = useState(false);
    const [userExists, setUserExists] = useState(null); // null = unknown, true = exists, false = doesn't exist
    const [userCheckMsg, setUserCheckMsg] = useState("");

    const [errors, setErrors] = useState({});
    const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const res = await api.get("/clients");
            if (res.data?.success) {
                setCompanies(res.data.clients || []);
            }
        } catch (err) {
            console.error("Failed to load companies", err);
        } finally {
            setLoadingCompanies(false);
        }
    };

    const handleChange = (key) => (ev) => {
        const value = ev?.target ? ev.target.value : ev;
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => ({ ...e, [key]: undefined }));

        // Reset user check if email or company changes
        if (key === "email" || key === "companyId") {
            setUserExists(null);
            setUserCheckMsg("");
        }
    };

    const selectedCompany = useMemo(
        () => companies.find((c) => c.id === form.companyId),
        [companies, form.companyId]
    );

    const permissionLevels = useMemo(() => {
        let levels = PERMISSION_LEVELS;
        if (!isSuperAdmin) {
            levels = levels.filter((p) => p.role !== "superadmin");
        }
        if (isSafetynettCompanyName(selectedCompany?.name)) {
            levels = levels.filter((p) => p.role !== "superadmin");
        }
        return levels;
    }, [selectedCompany?.name, isSuperAdmin]);

    const selectedLevel = useMemo(
        () =>
            permissionLevels.find((p) => p.id === Number(form.permission)) ??
            permissionLevels[0],
        [permissionLevels, form.permission]
    );

    // Keep permission in sync when company change hides superadmin (e.g. permission still 4).
    useEffect(() => {
        if (permissionLevels.some((p) => p.id === Number(form.permission))) return;
        const fallbackId = permissionLevels[0]?.id ?? 0;
        setForm((f) => (f.permission === fallbackId ? f : { ...f, permission: fallbackId }));
    }, [permissionLevels, form.permission]);

    const handleCompanyChange = (event, newValue) => {
        const companyId = newValue?.id || "";
        setForm((f) => {
            const next = { ...f, companyId };
            if (isSafetynettCompanyName(newValue?.name) && f.permission === 4) {
                next.permission = 3;
            }
            return next;
        });
        setUserExists(null);
        setUserCheckMsg("");
    };

    
    const checkUser = async () => {
        if (!form.email || !form.companyId) return;

        setCheckingUser(true);
        try {
            const res = await api.post("/users/check-user", {
                email: form.email,
                companyId: form.companyId
            });

            if (res.data?.exists) {
                setUserExists(true);
                setUserCheckMsg("");
                // Optionally auto-set role if returned
            } else {
                setUserExists(false);
                setUserCheckMsg(res.data?.message || "User does not exist in this company.");
            }
        } catch (err) {
            console.error(err);
            setUserExists(false); // Assume failure means not verifiable or error
            setUserCheckMsg("Error checking user.");
        } finally {
            setCheckingUser(false);
        }
    };

    const validate = () => {
        const e = {};
        if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
        if (!form.companyId) e.companyId = "Select a company";
        if (!Number.isInteger(Number(form.permission))) e.permission = "Select permission level";
        else if (!permissionLevels.some((p) => p.id === Number(form.permission))) {
            e.permission = "Select permission level";
        }

        if (userExists === false) e.email = "User does not exist in the selected company.";

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev?.preventDefault();

        // Trigger check if not done
        if (userExists === null) {
            await checkUser();
            // Re-validate after check (handled by next click or if implemented async wait properly)
            // Ideally we wait for checkUser() but state updates are async. 
            // Simplified: If userExists is false/null, stop.
            if (userExists === false) return;
        }

        if (!validate()) return;
        if (userExists === false) return;

        setSubmitting(true);
        try {
            const level = selectedLevel;
            if (!level?.role) {
                setSnack({
                    open: true,
                    msg: "Select a valid permission level for this company.",
                    severity: "error",
                });
                return;
            }

            const checkRes = await api.post("/users/check-user", { email: form.email, companyId: form.companyId });
            if (!checkRes.data?.exists) {
                setSnack({ open: true, msg: "User not found.", severity: "error" });
                return;
            }
            const userId = checkRes.data.user.id;

            const payload = {
                role: level.role,
            };

            const res = await api.put(`/users/${userId}`, payload);
            if (res?.data?.success) {
                setSnack({ open: true, msg: "User role updated successfully", severity: "success" });
                setForm({ email: "", companyId: "", permission: 1 });
                setUserExists(null);
            } else {
                throw new Error(res?.data?.message || "Failed");
            }
        } catch (err) {
            console.error("Update role error:", err);
            const msg = err?.response?.data?.message || err.message || "Failed to update role";
            setSnack({ open: true, msg, severity: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout>
            <Box sx={{ flex: 1, overflow: "auto", }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: isDarkMode ? "#F9FAFB" : "#111827" }}>Enable user access</Typography>
                <Typography variant="body2" sx={{ mb: 4, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>Assign permissions to existing users.</Typography>

                <Grid container spacing={4}>
                    <Grid item xs={12} md={7}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 5,
                                bgcolor: isDarkMode ? "#1B212C" : "#FBFBFA",
                                border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
                                borderRadius: 6,
                            }}
                        >
                            <form onSubmit={handleSubmit}>
                             
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: isDarkMode ? "#F9FAFB" : "#374151" }}>User email</Typography>
                                <TextField
                                    value={form.email}
                                    onChange={handleChange("email")}
                                    onBlur={checkUser}
                                    placeholder="user@example.com"
                                    fullWidth
                                    error={!!errors.email || userExists === false}
                                    helperText={errors.email || userCheckMsg}
                                    sx={{
                                        mb: 3,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 4,
                                            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                            "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                                            "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                                            "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                                        },
                                        "& .MuiInputBase-input": { py: 1.8, px: 2 }
                                    }}
                                />

                               
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: isDarkMode ? "#F9FAFB" : "#374151" }}>Company</Typography>
                                <Autocomplete
                                    options={companies}
                                    getOptionLabel={(option) => option.name}
                                    onChange={handleCompanyChange}
                                    onBlur={checkUser}
                                    loading={loadingCompanies}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Select Company"
                                            error={!!errors.companyId}
                                            helperText={errors.companyId}
                                        />
                                    )}
                                  
                                    slotProps={{
                                        paper: {
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
                                    }}
                                    renderOption={(props, option) => (
                                        <Box
                                            component="li"
                                            {...props}
                                            key={option.id}
                                            sx={{
                                                borderRadius: 50, // Pill shape
                                                mx: 0.5,
                                                my: 0.2,
                                                px: 2,
                                                py: 1,
                                                fontSize: "0.85rem",
                                                color: isDarkMode ? "#9CA3AF" : "#4B5563",
                                                transition: "all 0.2s",
                                               
                                                "&.Mui-focused, &:hover": {
                                                    bgcolor: isDarkMode ? "rgba(255,255,255,0.05) !important" : "#FEF7EC !important",
                                                    color: isDarkMode ? "#F9FAFB !important" : "#A16207 !important",
                                                },
                                                "&[aria-selected='true']": {
                                                    bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important",
                                                    color: isDarkMode ? "#60A5FA !important" : "#A16207 !important",
                                                }
                                            }}
                                        >
                                            {option.name}
                                        </Box>
                                    )}
                                    sx={{
                                        mb: 3,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 4,
                                            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                            "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                                            "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                                            p: "4px 12px",
                                            "& .MuiInputBase-input": { color: isDarkMode ? "#F9FAFB" : "inherit" }
                                        }
                                    }}
                                />

                                {checkingUser && <Typography variant="caption" sx={{ display: 'block', mb: 2, color: "#6B7280" }}>Checking user...</Typography>}

                            
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: isDarkMode ? "#F9FAFB" : "#374151" }}>Permission level</Typography>
                                <TextField
                                    select
                                    fullWidth
                                    value={form.permission}
                                    onChange={handleChange("permission")}
                                    error={!!errors.permission}
                                    helperText={errors.permission}
                                    SelectProps={{
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
                                        mb: 4,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 4,
                                            bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
                                            "& fieldset": { borderColor: isDarkMode ? "#374151" : "#E5E7EB" },
                                            "&.Mui-focused fieldset": { borderColor: "#0B4DA6", borderWidth: 1.5 },
                                            "& .MuiSelect-select": { color: isDarkMode ? "#F9FAFB" : "inherit" },
                                            "& .MuiSelect-icon": { color: isDarkMode ? "#9CA3AF" : "inherit" }
                                        },
                                        "& .MuiInputBase-input": { py: 1.8, px: 2 }
                                    }}
                                >
                                    {permissionLevels.map((p) => (
                                        <MenuItem
                                            key={p.id}
                                            value={p.id}
                                            sx={{
                                                borderRadius: 50,
                                                mx: 0.5,
                                                my: 0.2,
                                                px: 2,
                                                py: 1,
                                                fontSize: "0.85rem",
                                                color: isDarkMode ? "#9CA3AF" : "#4B5563",
                                                transition: "all 0.2s",
                                                "&:hover, &.Mui-selected, &.Mui-selected:hover": {
                                                    bgcolor: isDarkMode ? "rgba(11, 77, 166, 0.2) !important" : "#FEF7EC !important",
                                                    color: isDarkMode ? "#60A5FA !important" : "#A16207 !important",
                                                }
                                            }}
                                        >
                                            {p.title}
                                        </MenuItem>
                                    ))}
                                </TextField>

                              
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 2.5,
                                        p: 3,
                                        borderRadius: 4,
                                        border: isDarkMode ? "1px solid rgba(209, 233, 255, 0.15)" : "1px solid #D1E9FF",
                                        bgcolor: isDarkMode ? "#111827" : "#FEF7EC", // Light beige background
                                        mb: 4
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: "50%",
                                            bgcolor: "#DBEAFE",
                                            display: "grid",
                                            placeItems: "center",
                                            color: "#1D4ED8",
                                            flexShrink: 0
                                        }}
                                    >
                                        <InfoOutlinedIcon fontSize="medium" />
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, color: isDarkMode ? "#60A5FA" : "#1D4ED8", mb: 0.5, fontSize: "1rem" }}>
                                            {selectedLevel.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", lineHeight: 1.6 }}>
                                            {selectedLevel.desc}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ mt: 2 }}>
                                    <Button
                                        variant="contained"
                                        type="submit"
                                        disabled={submitting || checkingUser || userExists === false}
                                        sx={{
                                            textTransform: "uppercase",
                                            borderRadius: 50,
                                            px: 4,
                                            py: 1.6,
                                            bgcolor: "#0B57D0",
                                            fontWeight: 700,
                                            boxShadow: "none",
                                            "&:hover": {
                                                bgcolor: "#0842A0",
                                                boxShadow: "none"
                                            }
                                        }}
                                    >
                                        {submitting ? "Saving..." : "Update Access"}
                                    </Button>
                                </Box>
                            </form>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: isDarkMode ? "#F9FAFB" : "#111827" }}>Permission levels overview</Typography>
                        <Box sx={{ display: "grid", gap: 2.5 }}>
                            {permissionLevels.map((p) => (
                                <Paper
                                    elevation={0}
                                    key={p.id}
                                    sx={{
                                        p: 2.5,
                                        display: "flex",
                                        gap: 2,
                                        alignItems: "start",
                                        borderRadius: 4,
                                        bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : p.color,
                                        border: isDarkMode ? "1px solid #374151" : "1px solid rgba(0,0,0,0.03)"
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: "50%",
                                            bgcolor: isDarkMode ? "#1B212C" : "white",
                                            display: "grid",
                                            placeItems: "center",
                                            fontWeight: 700,
                                            flexShrink: 0,
                                            fontSize: "0.9rem",
                                            color: isDarkMode ? "#F9FAFB" : "inherit",
                                            boxShadow: isDarkMode ? "none" : "0 2px 4px rgba(0,0,0,0.05)"
                                        }}
                                    >
                                        {p.id}
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "#111827", mb: 0.5 }}>{p.title}</Typography>
                                        <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", lineHeight: 1.5 }}>{p.desc}</Typography>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity}>{snack.msg}</Alert>
            </Snackbar>
        </Layout>
    );
}
