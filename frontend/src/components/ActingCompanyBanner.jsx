import React from "react";
import { Alert, Button, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getActingClient, restorePlatformSuperadminSession } from "../utils/actingClient";

export default function ActingCompanyBanner() {
  const { isSuperAdmin, refreshUser, currentUser } = useAuth();
  const navigate = useNavigate();
  const acting = getActingClient();

  if (!isSuperAdmin || !acting?.name) return null;

  const handleClear = () => {
    restorePlatformSuperadminSession();
    refreshUser();
    navigate("/clients");
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity="info"
        sx={{
          borderRadius: 2,
          bgcolor: "rgba(232, 159, 23, 0.12)",
          color: "inherit",
          "& .MuiAlert-icon": { color: "#E89F17" },
        }}
        action={
          <Button color="inherit" size="small" onClick={handleClear} sx={{ textTransform: "none" }}>
            Change company
          </Button>
        }
      >
        Viewing as <strong>{acting.name}</strong>
        {currentUser?.companyname && currentUser.companyname !== acting.name
          ? ` — data is scoped to this organisation`
          : " — users, sites, and forms are scoped to this organisation"}
      </Alert>
    </Box>
  );
}
