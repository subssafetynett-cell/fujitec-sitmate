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
import { useNavigate, Link as RouterLink } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [values, setValues] = useState({
    email: "",
    password: "",
    remember: true,
    showPassword: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const handleChange = (prop) => (e) => {
    setValues((v) => ({
      ...v,
      [prop]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
    setError("");
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

    try {
      const payload = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      };

      // DEBUG: inspect baseURL so we know final URL
      // (keep this while debugging, remove later)
      console.log("api.baseURL:", api.defaults.baseURL);

      // This should request: {api.baseURL}/auth/login  (e.g. http://localhost:4000/api/auth/login)
      const res = await api.post("/auth/login", payload);

      console.log("login response:", res?.data, "requested URL:", res?.config?.url ?? res?.config);

      // expected response: { success: true, token, user }
      // OR { success: true, requireOtp: true }
      // OR { success: true, setup2Fa: true, token, ... }

      if (res?.data?.success) {
        if (res.data.token) {
          // store token and user
          const user = res.data.user;
          if (values.remember) localStorage.setItem('token', res.data.token);
          else sessionStorage.setItem('token', res.data.token);

          if (user) localStorage.setItem('user', JSON.stringify(user));

          // Sync AuthContext immediately
          refreshUser();

          // redirect by role
          if (
            user?.role === "superadmin" ||
            user?.companyname?.trim()?.toLowerCase() === "safetynett"
          ) {
            navigate("/clients");
          } else {
            navigate("/company");
          }
        }
      }

    } catch (err) {
      console.error("Login error:", err);
      console.error("Requested URL:", err.config?.baseURL ? `${err.config.baseURL}${err.config.url}` : err.config?.url);
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401 || status === 403) setError(data?.message || "Invalid credentials");
      else if (!err?.response) setError("No response from server — check backend");
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
              <Box component="img" src="/logo.png" alt="logo" sx={{ height: 36, width: "auto" }} />
            </Box>

            <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1.5, lineHeight: 1.04 }}>
              Holla, <br /> Welcome Back
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Hey, welcome back to Safetynett
            </Typography>

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
