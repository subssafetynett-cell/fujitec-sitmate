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
import { validateSignupForm } from "../utils/signupFormValidation";
import { getPostAuthPath } from "../utils/postAuthRedirect";
import { setStoredToken, scheduleTokenExpiryLogout } from "../utils/authSession";

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
    const e = validateSignupForm(form);
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
        employer: form.employer.trim(),
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
          setStoredToken(res.data.token, { remember: true });
          scheduleTokenExpiryLogout(res.data.token);
        }

        setSnack({ open: true, text: message });

        const user = res?.data?.user;
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          refreshUser();
        }

        // redirect after short delay so user sees success toast
        setTimeout(() => {
          navigate(getPostAuthPath());
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
        const msg = data?.message || "Validation failed";
        setServerMsg({ type: "error", text: msg });

        if (data?.errors) {
          setErrors(data.errors);
        } else if (data?.code === "COMPANY_NOT_FOUND" || msg.toLowerCase().includes("company")) {
          setErrors((prev) => ({ ...prev, employer: msg }));
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
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "100vh",
        height: { md: "100vh" },
        overflow: "hidden",
      }}
    >
      {/* Illustration — public/signup.svg; root path matches Vite/nginx; visible on all breakpoints */}
      <Box
        sx={{
          width: { xs: "100%", md: "45%" },
          minWidth: { md: "300px" },
          minHeight: { xs: 180, md: 0 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#1B42BA",
          p: { xs: 2, md: 3 },
          flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src="/signup.svg"
          alt="Signup illustration"
          sx={{
            width: "100%",
            maxWidth: { xs: 360, md: 500 },
            height: "auto",
            maxHeight: { xs: 200, md: "none" },
            objectFit: "contain",
          }}
        />
      </Box>

      {/* Form */}
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

          <Box
            component="form"
            noValidate
            onSubmit={handleSubmit}
            sx={{
              "& .MuiFormHelperText-root.Mui-error": {
                color: "error.main",
                fontWeight: 500,
              },
            }}
          >
            <TextField
              label="Username"
              fullWidth
              margin="dense"
              size="small"
              value={form.username}
              onChange={handleChange("username")}
              error={!!errors.username}
              helperText={errors.username}
              inputProps={{ maxLength: 30, autoComplete: "username" }}
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
                  inputProps={{ maxLength: 50, autoComplete: "given-name" }}
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
                  inputProps={{ maxLength: 50, autoComplete: "family-name" }}
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
              inputProps={{ maxLength: 254, autoComplete: "email" }}
            />

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Job title"
                  fullWidth
                  size="small"
                  value={form.jobTitle}
                  onChange={handleChange("jobTitle")}
                  error={!!errors.jobTitle}
                  helperText={errors.jobTitle}
                  inputProps={{ maxLength: 120 }}
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
                  helperText={
                    errors.employer ||
                    "Enter the exact company name you were given (must already be registered)."
                  }
                  inputProps={{ maxLength: 200 }}
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
              inputProps={{ inputMode: "tel", autoComplete: "tel" }}
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
              inputProps={{ maxLength: 128, autoComplete: "new-password" }}
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
              inputProps={{ maxLength: 128, autoComplete: "new-password" }}
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
