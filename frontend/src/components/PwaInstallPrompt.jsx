import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Typography,
} from "@mui/material";
import { Download, Share, X } from "lucide-react";
import {
  canShowInstallUi,
  clearDeferredInstallPrompt,
  getPwaInstallPlatform,
  isInStandaloneMode,
  markInstallPromptDismissed,
  openPwaInstallPrompt,
  registerInstallDialogOpener,
  setDeferredInstallPrompt,
  triggerChromiumInstall,
  wasInstallPromptDismissedRecently,
} from "../utils/pwaInstall";

function IosShareGlyph() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        mx: 0.5,
        verticalAlign: "middle",
      }}
      aria-hidden
    >
      <Share size={16} />
    </Box>
  );
}

function InstallInstructions({ platform }) {
  if (platform === "ios") {
    return (
      <Box component="ol" sx={{ pl: 2.5, m: 0, "& li": { mb: 1.5 } }}>
        <li>
          <Typography variant="body2">
            Tap <IosShareGlyph /> <strong>Share</strong> in Safari&apos;s toolbar
            (bottom on iPhone, top on iPad).
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            Scroll the menu and tap <strong>Add to Home Screen</strong>.
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            Tap <strong>Add</strong> — Site Mate opens like a native app and works offline.
          </Typography>
        </li>
      </Box>
    );
  }

  if (platform === "macos") {
    return (
      <Box component="ol" sx={{ pl: 2.5, m: 0, "& li": { mb: 1.5 } }}>
        <li>
          <Typography variant="body2">
            In Safari, open the menu bar: <strong>File → Add to Dock</strong>
            (macOS Sonoma or later).
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            Or click <IosShareGlyph /> <strong>Share</strong> in the toolbar, then choose{" "}
            <strong>Add to Dock</strong>.
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            Launch Site Mate from your Dock for fullscreen, offline-capable access.
          </Typography>
        </li>
      </Box>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      Install Site Mate for quick access, offline forms, and automatic updates.
    </Typography>
  );
}

/**
 * Install prompt for Safari (manual steps) and Chromium (native install).
 * Safari never fires beforeinstallprompt — users must use Share → Add to Home Screen.
 */
export default function PwaInstallPrompt() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [installing, setInstalling] = useState(false);

  const refreshPlatform = useCallback(() => {
    setPlatform(getPwaInstallPlatform());
  }, []);

  useEffect(() => {
    registerInstallDialogOpener(() => {
      refreshPlatform();
      setDialogOpen(true);
    });
    return () => registerInstallDialogOpener(null);
  }, [refreshPlatform]);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    refreshPlatform();

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setHasNativePrompt(true);
      setPlatform("chromium");
      if (!wasInstallPromptDismissedRecently() && !isInStandaloneMode()) {
        window.setTimeout(() => setSnackOpen(true), 2500);
      }
    };

    const onInstalled = () => {
      clearDeferredInstallPrompt();
      setHasNativePrompt(false);
      setSnackOpen(false);
      setDialogOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Safari iOS: gentle nudge after login (no native install event).
    if (
      getPwaInstallPlatform() === "ios" &&
      !wasInstallPromptDismissedRecently() &&
      !isInStandaloneMode()
    ) {
      const t = window.setTimeout(() => setSnackOpen(true), 4000);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [refreshPlatform]);

  const handleDismissSnack = () => {
    setSnackOpen(false);
    markInstallPromptDismissed();
  };

  const handleOpenDialog = () => {
    setSnackOpen(false);
    refreshPlatform();
    setDialogOpen(true);
  };

  const handleNativeInstall = async () => {
    setInstalling(true);
    try {
      const result = await triggerChromiumInstall();
      if (result?.outcome === "accepted") {
        setDialogOpen(false);
      }
    } finally {
      setInstalling(false);
    }
  };

  if (!canShowInstallUi() && !dialogOpen) return null;

  const showNativeButton =
    hasNativePrompt || platform === "chromium" || platform === "chromium-capable";

  return (
    <>
      <Snackbar
        open={snackOpen && canShowInstallUi()}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 80, sm: 24 } }}
      >
        <Alert
          severity="info"
          variant="filled"
          icon={<Download size={20} />}
          sx={{
            alignItems: "center",
            bgcolor: "#1A202C",
            color: "#F9FAFB",
            maxWidth: 420,
            "& .MuiAlert-action": { pt: 0 },
          }}
          action={
            <>
              <Button
                color="inherit"
                size="small"
                onClick={handleOpenDialog}
                sx={{ textTransform: "none", fontWeight: 700, color: "#E89F17", mr: 0.5 }}
              >
                Install
              </Button>
              <IconButton size="small" color="inherit" onClick={handleDismissSnack} aria-label="Dismiss">
                <X size={16} />
              </IconButton>
            </>
          }
        >
          {platform === "ios"
            ? "Install Site Mate on your home screen for offline access"
            : platform === "macos"
              ? "Add Site Mate to your Dock"
              : "Install Site Mate for offline access"}
        </Alert>
      </Snackbar>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 6 }}>
          <Download size={22} />
          Install Site Mate
          <IconButton
            onClick={() => setDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
            aria-label="Close"
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <InstallInstructions platform={platform} />
          {platform === "ios" && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Tip: Use Safari — Chrome on iPhone cannot install home screen apps with offline support.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>
            Not now
          </Button>
          {showNativeButton && hasNativePrompt ? (
            <Button
              variant="contained"
              onClick={handleNativeInstall}
              disabled={installing}
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#E89F17", "&:hover": { bgcolor: "#D97706" } }}
            >
              {installing ? "Installing…" : "Install"}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => {
                markInstallPromptDismissed();
                setDialogOpen(false);
              }}
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#E89F17", "&:hover": { bgcolor: "#D97706" } }}
            >
              Got it
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

// Re-export for TopNav menu
export { openPwaInstallPrompt };
