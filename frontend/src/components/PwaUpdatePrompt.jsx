import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { registerSW } from "virtual:pwa-register";

/**
 * Registers the service worker and shows a non-intrusive refresh prompt when
 * a new version is waiting (avoids auto-reload mid-form).
 */
export default function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSWRef = useRef(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;

    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Periodically check for updates while the tab stays open
        window.setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      },
    });

    updateSWRef.current = update;
    return undefined;
  }, []);

  const handleRefresh = useCallback(() => {
    setNeedRefresh(false);
    if (typeof updateSWRef.current === "function") {
      updateSWRef.current(true);
    } else {
      window.location.reload();
    }
  }, []);

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: 24, sm: 24 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{
          alignItems: "center",
          bgcolor: "#1A202C",
          color: "#F9FAFB",
          "& .MuiAlert-action": { pt: 0 },
        }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleRefresh}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              color: "#E89F17",
            }}
          >
            Refresh
          </Button>
        }
      >
        New version available — Refresh to update
      </Alert>
    </Snackbar>
  );
}
