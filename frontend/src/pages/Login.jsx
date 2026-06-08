// src/pages/LoginPage.jsx
import React, { useState } from "react";
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Snackbar,
  Alert,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate, Link as RouterLink, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getPostAuthPath } from "../utils/postAuthRedirect";
import { setStoredToken, scheduleTokenExpiryLogout } from "../utils/authSession";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const sessionExpired = Boolean(location.state?.sessionExpired);
  const signupPending = Boolean(location.state?.signupPending);
  const [values, setValues] = useState({
    email: location.state?.verifyEmail || "",
    password: "",
    remember: true,
    showPassword: false,
  });
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const handleChange = (prop) => (e) => {
    setValues((v) => ({
      ...v,
      [prop]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
    setError("");
    setNeedsVerification(false);
  };

  const handleResendVerification = async () => {
    const email = values.email.trim().toLowerCase();
    if (!email) {
      setError("Enter your email address, then resend verification.");
      return;
    }
    setResendLoading(true);
    try {
      const res = await api.post("/auth/resend-verification", { email });
      setSnack({
        open: true,
        msg: res.data?.message || "If an unverified account exists, a new link was sent.",
        severity: "success",
      });
    } catch (err) {
      setSnack({
        open: true,
        msg: err.response?.data?.message || "Could not resend verification email.",
        severity: "error",
      });
    } finally {
      setResendLoading(false);
    }
  };

  const toggleShow = () =>
    setValues((v) => ({ ...v, showPassword: !v.showPassword }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.email || !values.password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setNeedsVerification(false);

    try {
      const payload = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      };

      const res = await api.post("/auth/login", payload);

      // expected response: { success: true, token, user }
      // OR { success: true, requireOtp: true }
      // OR { success: true, setup2Fa: true, token, ... }

      if (res?.data?.success) {
        if (res.data.token) {
          const user = res.data.user;
          setStoredToken(res.data.token, { remember: values.remember });
          if (user) localStorage.setItem("user", JSON.stringify(user));
          scheduleTokenExpiryLogout(res.data.token);
          refreshUser();

          navigate(getPostAuthPath());
        }
      }

    } catch (err) {
      console.error("Login error:", err);
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError(data?.message || "Please verify your email before signing in.");
      } else if (status === 401 || status === 403) setError(data?.message || "Invalid credentials");
      else if (!err?.response)
        setError(
          "Cannot reach the API. Docker: `docker compose up --build -d` then http://localhost:8080. Local dev: backend on port 4000 plus `npm run dev` (Vite proxies /api)."
        );
      else setError(data?.message || `Sign in failed (status ${status})`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 2, sm: 4, md: 8, lg: 12 } }}>
      <Grid container alignItems="center" justifyContent="center" sx={{ flexGrow: 1, maxWidth: "1600px" }}>
        {/* LEFT: Form */}
        <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column", justifyContent: "center", px: { xs: 2, sm: 4, md: 6 }, py: { xs: 4, md: 0 } }}>
          <Box sx={{ width: "100%", maxWidth: 500, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
              <Box component="img" src="/sitemate-logo.svg" alt="logo" sx={{ height: 36, width: "auto" }} />
            </Box>

            <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1.5, lineHeight: 1.04 }}>
              Holla, <br /> Welcome Back
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Hey, welcome back to Safetynett
            </Typography>

            {sessionExpired && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Your session has expired. Please sign in again.
              </Alert>
            )}

            {signupPending && (
              <Alert severity="info" sx={{ mb: 2 }}>
                We sent a verification link to your email. Open it to verify your address, then sign in below.
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField label="Email address" type="email" value={values.email} onChange={handleChange("email")} fullWidth margin="normal" required InputProps={{ sx: { borderRadius: 2 } }} />

              <TextField
                label="Password"
                type={values.showPassword ? "text" : "password"}
                value={values.password}
                onChange={handleChange("password")}
                fullWidth
                margin="normal"
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={toggleShow} aria-label="toggle password visibility">
                        {values.showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                <FormControlLabel control={<Checkbox checked={values.remember} onChange={handleChange("remember")} />} label="Remember me" sx={{ ml: 0 }} />
                <MuiLink component={RouterLink} to="/forgot-password" underline="hover" sx={{ color: "text.secondary" }}>
                  Forgot Password?
                </MuiLink>
              </Box>

              {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

              {needsVerification && (
                <Button
                  type="button"
                  variant="outlined"
                  fullWidth
                  disabled={resendLoading}
                  onClick={handleResendVerification}
                  sx={{ mt: 2, py: 1.1, borderRadius: 2, textTransform: "none" }}
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </Button>
              )}

              <Button type="submit" variant="contained" fullWidth sx={{ mt: 4, mb: 1, py: 1.25, borderRadius: 2, bgcolor: "#013a63", ":hover": { bgcolor: "#2a6f97" } }}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
                Don’t have an account?{" "}
                <MuiLink component={RouterLink} to="/signup" sx={{ fontWeight: 700 }}>
                  Sign Up
                </MuiLink>
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* RIGHT: Illustration */}
        <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 2, sm: 4, md: 6 }, py: { xs: 4, md: 0 } }}>
          <Box component="img" src="/loginimage.svg" alt="Login illustration" sx={{ width: "100%", maxWidth: 2000, height: "auto", objectFit: "contain" }} />
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
