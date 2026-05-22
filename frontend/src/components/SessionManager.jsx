import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getStoredToken,
  isTokenExpired,
  registerSessionExpiredHandler,
  scheduleTokenExpiryLogout,
  clearExpiryTimer,
  handleSessionExpired,
} from "../utils/authSession";

/**
 * Wires JWT expiry → logout + redirect. Mount once inside BrowserRouter.
 */
export default function SessionManager() {
  const navigate = useNavigate();
  const { clearUser, refreshUser, refreshUserFromServer } = useAuth();

  useEffect(() => {
    registerSessionExpiredHandler((reason) => {
      clearUser();
      navigate("/login", {
        replace: true,
        state: { sessionExpired: reason === "expired" || reason === "unauthorized" },
      });
    });

    return () => {
      registerSessionExpiredHandler(null);
      clearExpiryTimer();
    };
  }, [clearUser, navigate]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      clearExpiryTimer();
      return undefined;
    }

    if (isTokenExpired(token)) {
      handleSessionExpired("expired");
      return undefined;
    }

    refreshUser();
    return scheduleTokenExpiryLogout(token);
  }, [refreshUser]);

  useEffect(() => {
    const syncProfile = () => {
      const token = getStoredToken();
      if (!token) return;
      if (isTokenExpired(token)) {
        handleSessionExpired("expired");
        return;
      }
      scheduleTokenExpiryLogout(token);
      refreshUserFromServer();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncProfile();
    };

    syncProfile();
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") syncProfile();
    }, 90_000);

    window.addEventListener("focus", syncProfile);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", syncProfile);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshUserFromServer]);

  return null;
}
