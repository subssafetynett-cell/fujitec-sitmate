// src/pages/SignupPage.jsx
import React, { useState } from "react";
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
  Link as MuiLink,
  Snackbar,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    employer: "",
    mobile: "",
    password: "",
    passwordConfirm: "",
    showPassword: false,
    showPasswordConfirm: false,
  });

  const [errors, setErrors] = useState({});
  const [serverMsg, setServerMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // snackbar for success
  const [snack, setSnack] = useState({ open: false, text: "" });

  const handleChange = (key) => (e) => {
    setForm((s) => ({ ...s, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerMsg(null);
  };

  const toggleShow = (which) => () =>
    setForm((s) => ({ ...s, [which]: !s[which] }));

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Username is required";
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.mobile.trim()) e.mobile = "Mobile number is required";
    else if (!/^\+?\d{7,15}$/.test(form.mobile.replace(/\s+/g, "")))
      e.mobile = "Enter a valid phone number (7–15 digits)";

    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Use at least 6 characters";

    if (!form.passwordConfirm) e.passwordConfirm = "Please confirm password";
    else if (form.password !== form.passwordConfirm)
      e.passwordConfirm = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerMsg(null);

    try {
      const payload = {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        jobTitle: form.jobTitle?.trim() || null,
        employer: form.employer?.trim() || null,
        mobile: form.mobile.trim(),
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      };

      // POST to /signup — ensure your axios instance `api` has baseURL set appropriately
      const res = await api.post("/auth/signup", payload);

      // success response shape: { success: true, message, user, token } (adjust to your backend)
      // success response shape: { success: true, message, user, token }
      if (res?.data?.success) {
        const message = res.data.message || "Account created";
        setServerMsg({ type: "success", text: message });
        setErrors({});
        setForm((s) => ({ ...s, password: "", passwordConfirm: "" }));

        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
        }

        // show snackbar then redirect
        setSnack({ open: true, text: message });

        // store user info for later checks
        const user = res?.data?.user;
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          refreshUser(); // sync AuthContext
        }

        // redirect after short delay so user sees success toast
        setTimeout(() => {
          const role = user?.role?.toLowerCase();

          // company field may be employer or companyname depending on backend
          const company =
            user?.companyname ||
            user?.employer ||
            user?.company ||
            "";

          const normalizedCompany = company.trim().toLowerCase();

          const isSuperAdmin = role === "superadmin";
          const isSafetyNettCompany = normalizedCompany === "safetynett";

          if (isSuperAdmin || isSafetyNettCompany) {
            navigate("/clients");
          } else {
            // Non-Safetynett accounts go straight to the dashboard
            navigate("/concern-reports");
          }
        }, 900);

      }
      else {
        setServerMsg({ type: "error", text: res.data?.message || "Signup failed" });
      }
    } catch (err) {
      console.error("Signup error — full:", err);

      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 400) {
        // Validation error from backend
        const msg = data?.message || "Validation failed";
        setServerMsg({ type: "error", text: msg });

        // If backend returns field-specific errors (e.g. { errors: { email: '...' } })
        if (data?.errors) {
          setErrors(data.errors);
        } else {
          // If we suspect it's the company/employer field based on message
          if (msg.toLowerCase().includes("company")) {
            setErrors((prev) => ({ ...prev, employer: msg }));
          }
        }
      } else if (status === 409) {
        setServerMsg({ type: "error", text: data?.message || "Conflict" });
      } else if (err.request && !err.response) {
        setServerMsg({ type: "error", text: "No response from server — check backend or network" });
      } else {
        setServerMsg({ type: "error", text: data?.message || err.message || "Signup failed. Try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* LEFT SIDE — Image (30% width) */}
      <Box
        sx={{
          width: "45%",
          minWidth: "300px",
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#1B42BA",
          p: 3,
        }}
      >
        <Box
          component="img"
          src="signup.svg"
          alt="Signup illustration"
          sx={{
            width: "100%",
            maxWidth: "500px",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </Box>

      {/* RIGHT SIDE — Signup Form (70% width) */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 3, sm: 4, md: 6 },
          overflowY: "auto",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 500, py: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Create your account
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 2.5, fontSize: "0.95rem" }}>
            Sign up to start managing safety, incidents, and compliance.
          </Typography>

          {serverMsg && (
            <Alert severity={serverMsg.type} sx={{ mb: 2 }}>
              {serverMsg.text}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={handleSubmit}>
            <TextField
              label="Username"
              fullWidth
              margin="dense"
              size="small"
              value={form.username}
              onChange={handleChange("username")}
              error={!!errors.username}
              helperText={errors.username}
            />

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First name"
                  fullWidth
                  size="small"
                  value={form.firstName}
                  onChange={handleChange("firstName")}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last name"
                  fullWidth
                  size="small"
                  value={form.lastName}
                  onChange={handleChange("lastName")}
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                />
              </Grid>
            </Grid>

            <TextField
              label="Email address"
              fullWidth
              margin="dense"
              size="small"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              error={!!errors.email}
              helperText={errors.email}
            />

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Job title"
                  fullWidth
                  size="small"
                  value={form.jobTitle}
                  onChange={handleChange("jobTitle")}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company name"
                  fullWidth
                  size="small"
                  value={form.employer}
                  onChange={handleChange("employer")}
                  error={!!errors.employer}
                  helperText={errors.employer}
                />
              </Grid>
            </Grid>

            <TextField
              label="Mobile number"
              fullWidth
              margin="dense"
              size="small"
              placeholder="+919876543210"
              value={form.mobile}
              onChange={handleChange("mobile")}
              error={!!errors.mobile}
              helperText={errors.mobile}
            />

            <TextField
              label="Password"
              fullWidth
              margin="dense"
              size="small"
              type={form.showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange("password")}
              error={!!errors.password}
              helperText={errors.password}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={toggleShow("showPassword")} edge="end" size="small">
                      {form.showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirm Password"
              fullWidth
              margin="dense"
              size="small"
              type={form.showPasswordConfirm ? "text" : "password"}
              value={form.passwordConfirm}
              onChange={handleChange("passwordConfirm")}
              error={!!errors.passwordConfirm}
              helperText={errors.passwordConfirm}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={toggleShow("showPasswordConfirm")}
                      edge="end"
                      size="small"
                    >
                      {form.showPasswordConfirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 2.5,
                mb: 1.5,
                py: 1.1,
                borderRadius: 2,
                bgcolor: "#013a63",
                textTransform: "none",
                fontSize: "1rem",
                "&:hover": { bgcolor: "#075692" },
              }}
            >
              {loading ? "Creating..." : "Create account"}
            </Button>

            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 1.5 }}
            >
              Already have an account?{" "}
              <MuiLink
                href="/login"
                sx={{
                  fontWeight: 600,
                  color: "#013a63",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Login
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack({ open: false, text: "" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack({ open: false, text: "" })} severity="success" sx={{ width: "100%" }}>
          {snack.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}
