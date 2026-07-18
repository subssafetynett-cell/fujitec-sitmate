import React, { useState } from "react";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Button,
} from "@mui/material";
import { Settings, Menu as MenuIcon, PanelLeft, PanelLeftClose, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { canShowInstallUi, isInStandaloneMode, openPwaInstallPrompt } from "../utils/pwaInstall";

const iconButtonSx = (isDarkMode) => ({
  color: isDarkMode ? "#F9FAFB" : "#111827",
  "&:hover": {
    bgcolor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
});

export default function TopNav({
  pageTitle,
  onMobileMenuClick,
  desktopSidebarOpen = true,
  onDesktopSidebarToggle,
}) {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const { clearUser } = useAuth();
  const {
    unreadCount,
    notifications,
    loadingNotifs,
    refreshUnreadCount,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useNotifications();

  const openNotifications = async (event) => {
    setNotifAnchor(event.currentTarget);
    await loadNotifications();
    await refreshUnreadCount(true);
  };

  const closeNotifications = () => {
    setNotifAnchor(null);
  };

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification);
    closeNotifications();
    await refreshUnreadCount(true);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkReadOnly = async (event, notification) => {
    event.stopPropagation();
    await markNotificationRead(notification);
    await refreshUnreadCount(true);
  };

  const formatNotificationTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const openSettingsMenu = (event) => {
    setSettingsAnchor(event.currentTarget);
  };

  const closeSettingsMenu = () => {
    setSettingsAnchor(null);
  };

  const handleOpenAccountSettings = () => {
    closeSettingsMenu();
    navigate("/account-settings");
  };

  const handleOpenInstall = () => {
    closeSettingsMenu();
    openPwaInstallPrompt();
  };

  const showInstallMenuItem = canShowInstallUi() && !isInStandaloneMode();

  const handleLogout = () => {
    closeSettingsMenu();
    clearUser();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 1, md: 1.5 },
        bgcolor: isDarkMode ? "#111827" : "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 0,
        boxShadow: "none",
        borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="Open navigation menu"
          onClick={onMobileMenuClick}
          sx={{ display: { xs: "flex", md: "none" }, ...iconButtonSx(isDarkMode) }}
        >
          <MenuIcon size={20} />
        </IconButton>
        {onDesktopSidebarToggle ? (
          <IconButton
            edge="start"
            color="inherit"
            aria-label={desktopSidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={onDesktopSidebarToggle}
            sx={{ display: { xs: "none", md: "flex" }, ...iconButtonSx(isDarkMode) }}
          >
            {desktopSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </IconButton>
        ) : null}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, md: 1 } }}>
        <IconButton
          aria-label="Notifications"
          onClick={openNotifications}
          sx={{ ...iconButtonSx(isDarkMode), position: "relative" }}
        >
          <Bell size={20} />
          {unreadCount > 0 ? (
            <Box
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 9,
                height: 9,
                borderRadius: "50%",
                bgcolor: "#EF4444",
                border: `2px solid ${isDarkMode ? "#111827" : "#FFFFFF"}`,
              }}
            />
          ) : null}
        </IconButton>
        <IconButton
          aria-label="Settings"
          onClick={openSettingsMenu}
          sx={iconButtonSx(isDarkMode)}
        >
          <Settings size={20} />
        </IconButton>
      </Box>

      <Menu
        anchorEl={notifAnchor}
        open={Boolean(notifAnchor)}
        onClose={closeNotifications}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 340,
            maxWidth: 400,
            maxHeight: 480,
            display: "flex",
            flexDirection: "column",
            bgcolor: isDarkMode ? "#1F2937" : "#FFFFFF",
            color: isDarkMode ? "#F9FAFB" : "#111827",
            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {unreadCount > 0 ? (
            <Button
              size="small"
              onClick={markAllNotificationsRead}
              sx={{ textTransform: "none", minWidth: 0 }}
            >
              Mark all read
            </Button>
          ) : null}
        </Box>
        <Divider />
        {loadingNotifs ? (
          <MenuItem disabled>
            <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
              Loading…
            </Typography>
          </MenuItem>
        ) : notifications.length === 0 ? (
          <MenuItem disabled sx={{ opacity: 1 }}>
            <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
              No notifications yet
            </Typography>
          </MenuItem>
        ) : (
          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {notifications.map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  alignItems: "flex-start",
                  whiteSpace: "normal",
                  py: 1.25,
                  gap: 1,
                  borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #F3F4F6",
                  bgcolor: notification.read
                    ? "transparent"
                    : isDarkMode
                      ? "rgba(239, 68, 68, 0.08)"
                      : "rgba(239, 68, 68, 0.06)",
                }}
              >
                {!notification.read ? (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      mt: "7px",
                      borderRadius: "50%",
                      bgcolor: "#EF4444",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box sx={{ width: 8, flexShrink: 0 }} />
                )}
                <Box sx={{ width: "100%", minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: notification.read ? 500 : 700 }}>
                    {notification.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7280", display: "block", mt: 0.25 }}>
                    {notification.message}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mt: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: isDarkMode ? "#6B7280" : "#9CA3AF" }}>
                      {formatNotificationTime(notification.createdAt)}
                    </Typography>
                    {!notification.read ? (
                      <Button
                        size="small"
                        onClick={(event) => handleMarkReadOnly(event, notification)}
                        sx={{
                          textTransform: "none",
                          minWidth: 0,
                          p: "0 4px",
                          fontSize: 11,
                          lineHeight: 1.6,
                        }}
                      >
                        Mark as read
                      </Button>
                    ) : null}
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>

      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={closeSettingsMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 190,
            bgcolor: isDarkMode ? "#1F2937" : "#FFFFFF",
            color: isDarkMode ? "#F9FAFB" : "#111827",
            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
          },
        }}
      >
        {showInstallMenuItem ? (
          <MenuItem onClick={handleOpenInstall}>Install App</MenuItem>
        ) : null}
        <MenuItem onClick={handleOpenAccountSettings}>Account Settings</MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: "#EF4444", fontWeight: 600 }}>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
