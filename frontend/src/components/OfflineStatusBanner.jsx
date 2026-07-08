import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Collapse, Snackbar } from "@mui/material";
import {
  countOfflineQueue,
  subscribeOfflineQueue,
} from "../utils/offlineStore";
import { flushOfflineQueue } from "../utils/offlineSync";

/**
 * Shows when the device is offline and/or pending writes are waiting to sync.
 */
export default function OfflineStatusBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncedSnack, setSyncedSnack] = useState(false);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await countOfflineQueue());
    } catch {
      setPending(0);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refreshPending();
    const unsub = subscribeOfflineQueue(refreshPending);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, [refreshPending]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await flushOfflineQueue();
      await refreshPending();
      if (result.flushed > 0) setSyncedSnack(true);
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const showBanner = !online || pending > 0;

  return (
    <>
      <Collapse in={showBanner}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: (t) => t.zIndex.snackbar,
            px: { xs: 1, sm: 2 },
            pt: 1,
          }}
        >
          <Alert
            severity={online ? "info" : "warning"}
            variant="filled"
            sx={{
              alignItems: "center",
              bgcolor: online ? "#1A365D" : "#744210",
              "& .MuiAlert-action": { pt: 0, alignItems: "center" },
            }}
            action={
              online && pending > 0 ? (
                <Button
                  color="inherit"
                  size="small"
                  disabled={syncing}
                  onClick={handleSyncNow}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              ) : null
            }
          >
            {!online
              ? pending > 0
                ? `You're offline. ${pending} change${pending === 1 ? "" : "s"} will sync when you're back online. Browsed data stays available from cache.`
                : "You're offline. You can still browse recently loaded Site Pack data. Form saves and uploads queue until you're online."
              : `${pending} change${pending === 1 ? "" : "s"} waiting to sync.`}
          </Alert>
        </Box>
      </Collapse>

      <Snackbar
        open={syncedSnack}
        autoHideDuration={4000}
        onClose={() => setSyncedSnack(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSyncedSnack(false)}
        >
          Offline changes synced
        </Alert>
      </Snackbar>
    </>
  );
}
