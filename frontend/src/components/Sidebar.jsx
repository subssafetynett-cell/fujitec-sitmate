import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Collapse,
  Avatar,
  Button,
} from "@mui/material";

import {
  Users,
  UserCog,
  FileText,
  Building2,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  Sun,
  Moon,
  PenLine,
  BarChart3,
  MessageSquareWarning,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

import { Link as RouterLink, useLocation, useSearchParams } from "react-router-dom";
import { MONITORING_SECTIONS } from "../constants/monitoringSections";

/* === COLORS === */
const ACTIVE_COLOR = "#1B212C";
const ACTIVE_BG = "hsl(38, 70%, 55%)";
const TEXT_COLOR = "#9CA3AF";
const BG_COLOR = "#1B212C";
const SIDEBAR_LOGO_SRC = "/logo.png";

/* === ROLE CONSTANTS (Prisma roles only) === */
const ALL_ROLES = ["superadmin", "company_admin", "site_manager", "supervisor", "worker"];
const COMPANY_ADMINS = ["superadmin", "company_admin"];
const MANAGER_PLUS = ["superadmin", "company_admin", "site_manager"];
const SUPERVISOR_PLUS = ["superadmin", "company_admin", "site_manager", "supervisor"];

const PERFORMANCE_MONITORING_ITEMS = [
  {
    id: "ohs-kpis",
    pageKey: "dashboard",
    label: "Occupational Health and Safety KPIs",
    to: MONITORING_SECTIONS.ohs.dashboardPath,
  },
  {
    id: "environmental-kpis",
    pageKey: "dashboard",
    label: "Environmental Management KPIs",
    to: MONITORING_SECTIONS.environmental.dashboardPath,
  },
  {
    id: "quality-kpis",
    pageKey: "dashboard",
    label: "Quality Management KPIs",
    to: MONITORING_SECTIONS.quality.dashboardPath,
  },
  {
    id: "lift-kpis",
    pageKey: "dashboard",
    label: "Lift Regulations Management KPIs",
    to: MONITORING_SECTIONS.lift.dashboardPath,
  },
];

const PERFORMANCE_MONITORING_NAV_ITEMS = [
  {
    id: "pm-ohs",
    pageKey: "dashboard",
    label: "Occupational Health and Safety Management",
    to: MONITORING_SECTIONS.ohs.basePath,
  },
  {
    id: "pm-environmental",
    pageKey: "dashboard",
    label: "Environmental Management",
    to: MONITORING_SECTIONS.environmental.basePath,
  },
  {
    id: "pm-quality",
    pageKey: "dashboard",
    label: "Quality Management",
    to: MONITORING_SECTIONS.quality.basePath,
  },
];

const SHEQ_FORMS_ITEMS = [
  {
    id: "sheq-service",
    pageKey: "sheq",
    label: "SHEQ Service",
    to: "/sheq-inspection",
  },
  {
    id: "sheq-installation",
    pageKey: "shq-installation",
    label: "SHEQ Installation",
    to: "/shq-installation",
  },
];

const REPORTING_CONCERNS_ITEMS = [
  {
    id: "report-ohs",
    pageKey: "report-health-safety",
    label: "Occupational Health and Safety",
    to: "/report-health-safety",
  },
  {
    id: "report-quality",
    pageKey: "report-quality",
    label: "Quality Management",
    to: "/report-quality",
  },
  {
    id: "report-positive",
    pageKey: "report-positive",
    label: "Good Practice",
    to: "/report-positive",
  },
];

const KPI_MENU_ITEMS = PERFORMANCE_MONITORING_ITEMS;

const MENU_GROUPS = [
  {
    id: "dashboard",
    pageKey: "dashboard",
    heading: "Dashboard",
    icon: <LayoutDashboard size={20} />,
    to: "/dashboard",
    exact: true,
    roles: ALL_ROLES,
  },
  {
    id: "kpi",
    heading: "KPI",
    icon: <BarChart3 size={20} />,
    roles: ALL_ROLES,
    items: KPI_MENU_ITEMS,
  },
  {
    id: "users",
    pageKey: "users",
    heading: "Users",
    icon: <Users size={20} />,
    to: "/users",
    roles: COMPANY_ADMINS,
  },
  {
    id: "clients",
    pageKey: "clients",
    heading: "Clients",
    icon: <Users size={20} />,
    to: "/clients",
    roles: ["superadmin"],
  },
  {
    id: "user-view-access",
    pageKey: "user-view-access",
    heading: "View Access",
    icon: <UserCog size={20} />,
    to: "/user-view-access",
    roles: COMPANY_ADMINS,
  },
  {
    id: "form-build",
    pageKey: "forms",
    heading: "Form Builder",
    icon: <FileText size={20} />,
    to: "/forms",
    roles: SUPERVISOR_PLUS,
  },
  {
    id: "general-forms",
    pageKey: "general-forms",
    heading: "Templates",
    icon: <FileText size={20} />,
    to: "/general-forms",
    roles: ALL_ROLES,
  },
  {
    id: "saved-signatures",
    pageKey: "saved-signatures",
    heading: "Saved Signatures",
    icon: <PenLine size={20} />,
    to: "/saved-signatures",
    roles: ALL_ROLES,
  },
  {
    id: "reporting-concerns",
    heading: "Reporting Concerns",
    icon: <MessageSquareWarning size={20} />,
    roles: ALL_ROLES,
    items: REPORTING_CONCERNS_ITEMS,
  },
  {
    id: "sites",
    heading: "Sites",
    icon: <Building2 size={20} />,
    roles: ALL_ROLES,
    items: [
      {
        id: "create-sites",
        pageKey: "create-sites",
        label: "Create Sites",
        to: "/create-sites",
        roles: COMPANY_ADMINS,
      },
      {
        id: "sitepack-management",
        pageKey: "sitepack-management",
        label: "Site Pack Management",
        to: "/sitepack-management",
        roles: ALL_ROLES,
      },
    ],
  },
  {
    id: "performance-monitoring",
    heading: "Performance Monitoring",
    icon: <TrendingUp size={20} />,
    roles: ALL_ROLES,
    items: PERFORMANCE_MONITORING_NAV_ITEMS,
  },
  {
    id: "sheq-forms",
    heading: "SHEQ Forms",
    icon: <ClipboardList size={20} />,
    roles: ALL_ROLES,
    items: SHEQ_FORMS_ITEMS,
  },
  {
    id: "action-tracker",
    pageKey: "action-tracker",
    heading: "Action Tracker",
    icon: <ListChecks size={20} />,
    to: "/action-tracker",
    roles: ALL_ROLES,
  },
];

let globalCachedStats = { userCount: 0, clientCount: 0 };
let globalStatsLastFetch = 0;

function isMenuLink(item) {
  return Boolean(item?.to);
}

function isMenuEntryActive(item, isActive, canSeeItem = () => true) {
  if (isMenuLink(item)) return isActive(item.to, item.exact);
  return (
    item.items?.some((sub) => canSeeItem(sub) && isActive(sub.to, sub.exact)) ?? false
  );
}

export default function Sidebar({ sx = {} }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [openGroup, setOpenGroup] = useState(null);
  const [openSubGroups, setOpenSubGroups] = useState(() => new Set());
  const { role, currentUser, isViewOnly, canAccessPage } = useAuth();
  const [stats, setStats] = useState(globalCachedStats);

  useEffect(() => {
    if (role === "superadmin") {
      const now = Date.now();
      // Cache for 2 minutes to prevent spam from StrictMode and multiple Sidebar instances
      if (now - globalStatsLastFetch > 120000) {
        api.get("/users/stats")
          .then(res => {
            if (res.data.success) {
              globalCachedStats = {
                userCount: res.data.userCount,
                clientCount: res.data.clientCount
              };
              globalStatsLastFetch = Date.now();
              setStats(globalCachedStats);
            }
          })
          .catch(err => console.error("Error fetching stats:", err));
      } else {
        setStats(globalCachedStats);
      }
    }
  }, [role]);

  const toggleGroup = (id) => {
    setOpenGroup((prev) => (prev === id ? null : id));
  };

  const toggleSubGroup = (id) => {
    setOpenSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (to, exact = false) => {
    const path = location.pathname || "";
    const hasSitepackContext =
      Boolean(searchParams.get("siteId")) &&
      (searchParams.get("category") === "Friday Pack Forms" ||
        path.startsWith("/general-forms/"));

    if (to === "/sitepack-management" && hasSitepackContext) {
      return true;
    }
    if (to === "/general-forms" && hasSitepackContext) {
      return false;
    }

    if (exact) {
      return path === to || (to === "/dashboard" && path === "/concern-reports");
    }
    return path === to || path.startsWith(to + "/");
  };

  const canSeeGroup = (group) => {
    if (isViewOnly) {
      if (group.pageKey && canAccessPage(group.pageKey)) return true;
      if (group.items?.some((item) => canSeeMenuEntry(item))) return true;
      return false;
    }
    if (group.id === "users") {
      const stored = (currentUser?.role || "").toString().toLowerCase();
      return stored === "superadmin" || stored === "company_admin";
    }
    if (!group.roles) return true;
    return group.roles.includes(role);
  };

  const canSeeItem = useCallback(
    (item) => {
      if (isViewOnly) {
        return item.pageKey ? canAccessPage(item.pageKey) : true;
      }
      if (!item.roles) return true;
      return item.roles.includes(role);
    },
    [isViewOnly, role, canAccessPage]
  );

  const canSeeMenuEntry = useCallback(
    (item) => {
      if (item.items) return item.items.some((sub) => canSeeItem(sub));
      return canSeeItem(item);
    },
    [canSeeItem]
  );

  const getInitials = () =>
    currentUser?.firstName
      ? (currentUser.firstName[0] + (currentUser.lastName?.[0] || "")).toUpperCase()
      : "JD";

  const name = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName || ""}`
    : "John Doe";


  useEffect(() => {
    const path = location.pathname || "";
    let nextOpenGroup = null;
    const nextSubGroups = new Set();

    for (const group of MENU_GROUPS) {
      if (group.items) {
        for (const item of group.items) {
          if (item.items?.some((sub) => canSeeItem(sub) && isActive(sub.to, sub.exact))) {
            nextOpenGroup = group.id;
            nextSubGroups.add(item.id);
            break;
          }
          if (isMenuLink(item) && canSeeItem(item) && isActive(item.to, item.exact)) {
            nextOpenGroup = group.id;
            break;
          }
        }
        if (nextOpenGroup) break;
      }
      if (group.to && isActive(group.to, group.exact)) {
        nextOpenGroup = group.id;
        break;
      }
    }

    setOpenGroup(nextOpenGroup);
    setOpenSubGroups(nextSubGroups);
  }, [location.pathname, location.search, canSeeItem]);

  return (
    <Box
      component="nav"
      sx={{
        width: 280,
        height: "100%",
        bgcolor: BG_COLOR,
        color: TEXT_COLOR,
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
        // DO NOT make the aside itself the scroll container

        ...sx,
      }}
    >
      {/* LOGO */}
      <Box
        sx={{
          p: 2,
          pb: 1.5,
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <Box
          component={RouterLink}
          to="/dashboard"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            textDecoration: "none",
            width: "100%",
          }}
        >
          <Box
            component="img"
            src={SIDEBAR_LOGO_SRC}
            alt="Sitemate"
            sx={{
              height: 72,
              width: "auto",
              maxWidth: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </Box>
      </Box>

      {/* MENU */}
      <Box sx={{
        flex: 1,
        overflowY: "auto",
        px: 1.5,
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}>


        {/* Menu Groups */}
        {MENU_GROUPS.filter(canSeeGroup).map((group) => {
          const expanded = openGroup === group.id;

          if (!group.items) {
            const active = isActive(group.to, group.exact);
            return (
              <ListItemButton
                key={group.id}
                component={RouterLink}
                to={group.to}
                sx={{
                  mb: 0.5,
                  py: 0.75,
                  px: 1.5,
                  borderRadius: 1.5,
                  bgcolor: active ? ACTIVE_BG : "transparent",
                  color: active ? ACTIVE_COLOR : TEXT_COLOR,
                  "&:hover": {
                    bgcolor: active ? ACTIVE_BG : "rgba(255,255,255,0.05)",
                  },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: 36, '& svg': { fontSize: 20 } }}>{group.icon}</ListItemIcon>
                <ListItemText primary={group.heading} primaryTypographyProps={{ fontSize: '0.875rem' }} />
              </ListItemButton>
            );
          }

          const isGroupActive = group.items.some((item) =>
            isMenuEntryActive(item, isActive, canSeeItem)
          );

          const renderMenuLink = (item, nested = false) => {
            const active = isActive(item.to, item.exact);
            return (
              <ListItemButton
                key={item.id}
                component={RouterLink}
                to={item.to}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  py: 0.5,
                  px: 1.5,
                  bgcolor: "transparent",
                  color: active ? "#E89F17" : TEXT_COLOR,
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.05)",
                  },
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: nested ? "0.8rem" : "0.8125rem" }}
                />
              </ListItemButton>
            );
          };

          return (
            <Box key={group.id}>
              <ListItemButton
                onClick={() => toggleGroup(group.id)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  py: 0.75,
                  px: 1.5,
                  bgcolor: isGroupActive ? ACTIVE_BG : "transparent",
                  color: isGroupActive ? ACTIVE_COLOR : TEXT_COLOR,
                  "&:hover": { bgcolor: isGroupActive ? ACTIVE_BG : "rgba(255,255,255,0.05)" }
                }}
              >
                <ListItemIcon sx={{ color: isGroupActive ? ACTIVE_COLOR : TEXT_COLOR, minWidth: 36, '& svg': { fontSize: 20 } }}>
                  {group.icon}
                </ListItemIcon>
                <ListItemText primary={group.heading} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                <ChevronDown
                  size={20}
                  color={isGroupActive ? ACTIVE_COLOR : TEXT_COLOR}
                  style={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </ListItemButton>

              <Collapse in={expanded}>
                <Box sx={{ ml: 3, pl: 1, borderLeft: "1px solid #4B5563" }}>
                  {group.items.filter(canSeeMenuEntry).map((item) => {
                    if (item.items) {
                      const visibleChildren = item.items.filter(canSeeItem);
                      const subExpanded = openSubGroups.has(item.id);
                      const subActive = visibleChildren.some((sub) =>
                        isActive(sub.to, sub.exact)
                      );

                      return (
                        <Box key={item.id} sx={{ mb: 0.5 }}>
                          <ListItemButton
                            onClick={() => toggleSubGroup(item.id)}
                            sx={{
                              borderRadius: 1.5,
                              py: 0.5,
                              px: 1.5,
                              bgcolor: "transparent",
                              color: subActive ? "#E89F17" : TEXT_COLOR,
                              "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
                            }}
                          >
                            <ListItemText
                              primary={item.label}
                              primaryTypographyProps={{ fontSize: "0.8125rem", fontWeight: 600 }}
                            />
                            <ChevronDown
                              size={16}
                              color={subActive ? "#E89F17" : TEXT_COLOR}
                              style={{
                                transform: subExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                              }}
                            />
                          </ListItemButton>
                          <Collapse in={subExpanded}>
                            <Box sx={{ ml: 1.5, pl: 1, borderLeft: "1px solid #4B5563" }}>
                              {visibleChildren.map((sub) => renderMenuLink(sub, true))}
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    }

                    return renderMenuLink(item);
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* FOOTER */}
      <Box sx={{ p: 1.5 }}>
        {/* Superadmin Stats */}
        {role === "superadmin" && (
          <Box sx={{ 
            bgcolor: "rgba(232, 159, 23, 0.1)", 
            borderRadius: 2, 
            p: 1.5, 
            mb: 1.5,
            border: "1px solid rgba(232, 159, 23, 0.2)"
          }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ color: TEXT_COLOR, fontSize: "0.75rem", fontWeight: 600 }}>Total Clients</Typography>
              <Typography sx={{ color: "#E89F17", fontSize: "0.875rem", fontWeight: 800 }}>{stats.clientCount}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ color: TEXT_COLOR, fontSize: "0.75rem", fontWeight: 600 }}>Total Users</Typography>
              <Typography sx={{ color: "#E89F17", fontSize: "0.875rem", fontWeight: 800 }}>{stats.userCount}</Typography>
            </Box>
          </Box>
        )}

        {/* User Profile Card */}
        <Box sx={{ bgcolor: "#27303E", borderRadius: 2, p: 1.5, mb: 1 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Avatar sx={{ bgcolor: "#E89F17", color: "#111827", width: 36, height: 36, fontSize: '0.875rem' }}>
              {getInitials()}
            </Avatar>
            <Box>
              <Typography color="#FFF" fontWeight={600} fontSize="0.875rem">
                {name}
              </Typography>
              <Typography variant="caption" color={TEXT_COLOR} fontSize="0.75rem" sx={{ textTransform: 'capitalize' }}>
                {(role || "user").replace(/_/g, " ")}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Theme Toggle Card */}
        <Box sx={{ bgcolor: isDarkMode ? "#111827" : "#27303E", borderRadius: 2, p: 0.5 }}>
          <Box sx={{ bgcolor: isDarkMode ? "#1B212C" : "#111827", borderRadius: 10, p: 0.4, display: "flex" }}>
            <Button
              onClick={() => isDarkMode && toggleTheme()}
              startIcon={<Sun size={14} />}
              sx={{
                flex: 1,
                borderRadius: 10,
                bgcolor: !isDarkMode ? "#E89F17" : "transparent",
                color: !isDarkMode ? "#111827" : TEXT_COLOR,
                textTransform: "none",
                fontSize: "0.7rem",
                py: 0.4,
                minHeight: 0,
                "&:hover": { bgcolor: !isDarkMode ? "#cc8b14" : "rgba(255,255,255,0.05)" },
              }}
            >
              Light
            </Button>
            <Button
              onClick={() => !isDarkMode && toggleTheme()}
              startIcon={<Moon size={14} />}
              sx={{
                flex: 1,
                borderRadius: 10,
                bgcolor: isDarkMode ? "#E89F17" : "transparent",
                color: isDarkMode ? "#111827" : TEXT_COLOR,
                textTransform: "none",
                fontSize: "0.7rem",
                py: 0.4,
                minHeight: 0,
                "&:hover": { bgcolor: isDarkMode ? "#cc8b14" : "rgba(255,255,255,0.05)" },
              }}
            >
              Dark
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
