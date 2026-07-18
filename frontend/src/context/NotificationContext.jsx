import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import { getStoredToken, isTokenExpired } from "../utils/authSession";

const NotificationContext = createContext(null);

const POLL_MS = 60_000;
const MIN_REFRESH_MS = 15_000;

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const lastUnreadFetchRef = useRef(0);
  const cachedCountRef = useRef(0);
  const unreadInFlightRef = useRef(null);

  const refreshUnreadCount = useCallback(async (force = false) => {
    const token = getStoredToken();
    if (!token || isTokenExpired(token)) {
      setUnreadCount(0);
      return 0;
    }

    const now = Date.now();
    if (!force && now - lastUnreadFetchRef.current < MIN_REFRESH_MS) {
      return cachedCountRef.current;
    }

    if (unreadInFlightRef.current) {
      return unreadInFlightRef.current;
    }

    unreadInFlightRef.current = fetchUnreadNotificationCount()
      .then((res) => {
        const count = res?.count || 0;
        cachedCountRef.current = count;
        setUnreadCount(count);
        lastUnreadFetchRef.current = Date.now();
        return count;
      })
      .catch(() => cachedCountRef.current)
      .finally(() => {
        unreadInFlightRef.current = null;
      });

    return unreadInFlightRef.current;
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetchNotifications(100);
      setNotifications(res?.data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const handleMarkRead = useCallback(async (notification) => {
    if (!notification?.id || notification.read) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((row) => (row.id === notification.id ? { ...row, read: true } : row))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((row) => ({ ...row, read: true })));
      setUnreadCount(0);
      lastUnreadFetchRef.current = Date.now();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount(true);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshUnreadCount();
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  const value = {
    unreadCount,
    notifications,
    loadingNotifs,
    refreshUnreadCount,
    loadNotifications,
    markNotificationRead: handleMarkRead,
    markAllNotificationsRead: handleMarkAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
