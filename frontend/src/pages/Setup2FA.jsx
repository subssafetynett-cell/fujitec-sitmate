import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Alert,
    CircularProgress
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getPostAuthPath } from "../utils/postAuthRedirect";

export default function Setup2FA() {
    const navigate = useNavigate();
    const [qrCode, setQrCode] = useState(null);
    const [secret, setSecret] = useState(null);
    const [token, setToken] = useState("");
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Determine token: if passed from login (for forced setup), it's in localStorage/sessionStorage handled by api interceptor?
        // Actually, Login saves token before redirecting here.
        async function fetchQR() {
            try {
                const res = await api.post("/auth/setup-2fa");
                if (res.data?.success) {
                    setQrCode(res.data.qrCode);
                    setSecret(res.data.secret);
                }
            } catch (err) {
                console.error(err);
                setMessage({ type: "error", text: "Failed to generate QR code." });
            } finally {
                setLoading(false);
            }
        }
        fetchQR();
    }, []);

    const handleVerify = async () => {
        try {
            const res = await api.post("/auth/verify-2fa", { token });
            if (res.data?.success) {
                setMessage({ type: "success", text: "2FA Enabled Successfully!" });
                setTimeout(() => {
                    let user = null;
                    try {
                        user = JSON.parse(localStorage.getItem("user") || "null");
                    } catch {
                        user = null;
                    }
                    navigate(getPostAuthPath());
                }, 1500);
            }
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Verification failed" });
        }
    };

    if (loading) return <Box sx={{ display: "grid", placeItems: "center", height: "100vh" }}><CircularProgress /></Box>;

    return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#f5f5f5" }}>
            <Paper sx={{ p: 4, maxWidth: 500, width: "100%", textAlign: "center" }}>
                <Typography variant="h5" gutterBottom fontWeight="bold">Set up Two-Factor Authentication</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Scan the QR code below with Google Authenticator or a similar app.
                </Typography>

                {qrCode && (
                    <Box component="img" src={qrCode} alt="QR Code" sx={{ width: 200, height: 200, mb: 3 }} />
                )}

                <TextField
                    label="Enter OTP"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                />

                {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}

                <Button variant="contained" onClick={handleVerify} disabled={!token || token.length < 6} fullWidth>
                    Verify & Enable
                </Button>
            </Paper>
        </Box>
    );
}
