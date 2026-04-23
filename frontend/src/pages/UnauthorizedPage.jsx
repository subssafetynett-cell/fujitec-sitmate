// src/pages/UnauthorizedPage.jsx
import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();

  const roleLabel = (role || "").replace(/_/g, " ");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        px: 3,
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
          border: "1px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <ShieldX size={44} color="#EF4444" />
      </Box>

      {/* Error code */}
      <Typography
        sx={{
          fontSize: "6rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #EF4444, #F97316)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
          mb: 1,
        }}
      >
        403
      </Typography>

      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: "#F9FAFB", mb: 1.5 }}
      >
        Access Denied
      </Typography>

      <Typography
        sx={{
          color: "#9CA3AF",
          fontSize: "1rem",
          maxWidth: 420,
          mb: 0.75,
        }}
      >
        You don't have permission to view this page.
      </Typography>

      {currentUser && (
        <Box
          sx={{
            mt: 1,
            mb: 3,
            px: 2.5,
            py: 1,
            bgcolor: "rgba(255,255,255,0.05)",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography sx={{ color: "#9CA3AF", fontSize: "0.85rem" }}>
            Signed in as{" "}
            <span style={{ color: "#F9FAFB", fontWeight: 600 }}>
              {currentUser.firstName} {currentUser.lastName}
            </span>{" "}
            &nbsp;·&nbsp; Role:{" "}
            <span
              style={{
                color: "#E89F17",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {roleLabel || "worker"}
            </span>
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          sx={{
            borderColor: "rgba(255,255,255,0.2)",
            color: "#9CA3AF",
            textTransform: "none",
            borderRadius: 2,
            px: 3,
            "&:hover": {
              borderColor: "rgba(255,255,255,0.4)",
              bgcolor: "rgba(255,255,255,0.05)",
            },
          }}
        >
          Go Back
        </Button>

        <Button
          variant="contained"
          onClick={() => navigate("/general-forms")}
          sx={{
            bgcolor: "#E89F17",
            color: "#111827",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            "&:hover": { bgcolor: "#cc8b14" },
          }}
        >
          Go to Forms
        </Button>
      </Box>
    </Box>
  );
}
