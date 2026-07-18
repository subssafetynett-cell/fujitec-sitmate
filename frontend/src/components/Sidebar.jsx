import React, { useState, useEffect, useCallback } from "react";
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
import { Link as RouterLink, useLocation, useSearchParams } from "react-router-dom";
import { MONITORING_SECTIONS } from "../constants/monitoringSections";

const SIDEBAR_LOGO_SRC = "/sitemate-logo-white-yellow.svg";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const ALL_ROLES = ["superadmin", "company_admin", "site_manager", "supervisor", "worker"];
const COMPANY_ADMINS = ["superadmin", "company_admin"];
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

const MENU_GROUPS = [
  {
    id: "dashboard",
    pageKey: "dashboard",
    heading: "Dashboard",
    icon: LayoutDashboard,
    to: "/dashboard",
    exact: true,
    roles: ALL_ROLES,
  },
  {
    id: "kpi",
    heading: "KPI",
    icon: BarChart3,
    roles: ALL_ROLES,
    items: PERFORMANCE_MONITORING_ITEMS,
  },
  {
    id: "users",
    pageKey: "users",
    heading: "Users",
    icon: Users,
    to: "/users",
    roles: COMPANY_ADMINS,
  },
  {
    id: "clients",
    pageKey: "clients",
    heading: "Clients",
    icon: Users,
    to: "/clients",
    roles: ["superadmin"],
  },
  {
    id: "user-view-access",
    pageKey: "user-view-access",
    heading: "View Access",
    icon: UserCog,
    to: "/user-view-access",
    roles: COMPANY_ADMINS,
  },
  {
    id: "form-build",
    pageKey: "forms",
    heading: "Form Builder",
    icon: FileText,
    to: "/forms",
    roles: SUPERVISOR_PLUS,
  },
  {
    id: "general-forms",
    pageKey: "general-forms",
    heading: "Templates",
    icon: FileText,
    to: "/general-forms",
    roles: ALL_ROLES,
  },
  {
    id: "saved-signatures",
    pageKey: "saved-signatures",
    heading: "Saved Signatures",
    icon: PenLine,
    to: "/saved-signatures",
    roles: ALL_ROLES,
  },
  {
    id: "reporting-concerns",
    heading: "Reporting Concerns",
    icon: MessageSquareWarning,
    roles: ALL_ROLES,
    items: REPORTING_CONCERNS_ITEMS,
  },
  {
    id: "sites",
    heading: "Sites",
    icon: Building2,
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
    icon: TrendingUp,
    roles: ALL_ROLES,
    items: PERFORMANCE_MONITORING_NAV_ITEMS,
  },
  {
    id: "sheq-forms",
    heading: "SHEQ Forms",
    icon: ClipboardList,
    roles: ALL_ROLES,
    items: SHEQ_FORMS_ITEMS,
  },
  {
    id: "action-tracker",
    pageKey: "action-tracker",
    heading: "Nonconformance",
    icon: ListChecks,
    to: "/nonconformance",
    roles: ALL_ROLES,
  },
];

function isMenuLink(item) {
  return Boolean(item?.to);
}

function isMenuEntryActive(item, isActive, canSeeItem = () => true) {
  if (isMenuLink(item)) return isActive(item.to, item.exact);
  return item.items?.some((sub) => canSeeItem(sub) && isActive(sub.to, sub.exact)) ?? false;
}

export default function Sidebar({ className = "", style }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [openGroup, setOpenGroup] = useState(null);
  const [openSubGroups, setOpenSubGroups] = useState(() => new Set());
  const { role, currentUser, isViewOnly, canAccessPage } = useAuth();

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

  const isActive = useCallback(
    (to, exact = false) => {
      const path = location.pathname || "";
      const hasMonitoringContext = Boolean(searchParams.get("monitoringSection"));
      const hasListPathContext = Boolean(searchParams.get("listPath"));
      const hasEmbeddedFill = searchParams.get("embedded") === "true";
      const hasSitepackContext =
        Boolean(searchParams.get("siteId")) &&
        (searchParams.get("category") === "Friday Pack Forms" ||
          path.startsWith("/general-forms/"));

      // Contextual fills (monitoring, site-pack, concerns, SHEQ) use form routes but are not Templates.
      if (
        to === "/general-forms" &&
        (hasMonitoringContext || hasSitepackContext || hasListPathContext || hasEmbeddedFill)
      ) {
        return false;
      }
      if (to === "/sitepack-management" && hasSitepackContext && !hasMonitoringContext) {
        return true;
      }

      if (exact) {
        return path === to || (to === "/dashboard" && path === "/concern-reports");
      }
      return path === to || path.startsWith(`${to}/`);
    },
    [location.pathname, searchParams]
  );

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

  const getInitials = () =>
    currentUser?.firstName
      ? (currentUser.firstName[0] + (currentUser.lastName?.[0] || "")).toUpperCase()
      : "JD";

  const name = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName || ""}`
    : "John Doe";

  useEffect(() => {
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
  }, [location.pathname, location.search, canSeeItem, isActive]);

  const navItemClass = (active) =>
    cn(
      "mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
      active
        ? "bg-[#E89F17] text-[#1B212C] shadow-sm"
        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
    );

  const subLinkClass = (active) =>
    cn(
      "mb-0.5 flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
      active
        ? "bg-[#E89F17]/20 font-semibold text-[#E89F17]"
        : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
    );

  return (
    <nav
      className={cn(
        "flex h-full w-[280px] flex-col border-r border-white/5 bg-[#1B212C] text-slate-300",
        className
      )}
      style={style}
    >
      <div className="mb-1 flex shrink-0 items-center px-4 pb-2 pt-4">
        <RouterLink to="/dashboard" className="flex w-full items-center no-underline">
          <img
            src={SIDEBAR_LOGO_SRC}
            alt="Sitemate"
            className="block h-16 w-auto max-w-full object-contain"
          />
        </RouterLink>
      </div>

      <div className="flex-1 overflow-y-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MENU_GROUPS.filter(canSeeGroup).map((group) => {
          const expanded = openGroup === group.id;
          const Icon = group.icon;

          if (!group.items) {
            const active = isActive(group.to, group.exact);
            return (
              <RouterLink key={group.id} to={group.to} className={navItemClass(active)}>
                <Icon size={20} className="shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1">{group.heading}</span>
              </RouterLink>
            );
          }

          const isGroupActive = group.items.some((item) =>
            isMenuEntryActive(item, isActive, canSeeItem)
          );

          const renderMenuLink = (item) => {
            const active = isActive(item.to, item.exact);
            return (
              <RouterLink key={item.id} to={item.to} className={subLinkClass(active)}>
                {item.label}
              </RouterLink>
            );
          };

          return (
            <div key={group.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={navItemClass(isGroupActive)}
              >
                <Icon size={20} className="shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1">{group.heading}</span>
                <ChevronDown
                  size={18}
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </button>

              {expanded ? (
                <div className="ml-3 border-l border-slate-600/60 pl-2">
                  {group.items.filter(canSeeMenuEntry).map((item) => {
                    if (item.items) {
                      const visibleChildren = item.items.filter(canSeeItem);
                      const subExpanded = openSubGroups.has(item.id);
                      const subActive = visibleChildren.some((sub) =>
                        isActive(sub.to, sub.exact)
                      );

                      return (
                        <div key={item.id} className="mb-0.5">
                          <button
                            type="button"
                            onClick={() => toggleSubGroup(item.id)}
                            className={cn(
                              "mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors",
                              subActive
                                ? "text-[#E89F17]"
                                : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                            )}
                          >
                            <span className="min-w-0 flex-1">{item.label}</span>
                            <ChevronDown
                              size={16}
                              className={cn(
                                "shrink-0 transition-transform duration-200",
                                subExpanded && "rotate-180"
                              )}
                            />
                          </button>
                          {subExpanded ? (
                            <div className="ml-2 border-l border-slate-600/60 pl-2">
                              {visibleChildren.map((sub) => renderMenuLink(sub))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return renderMenuLink(item);
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#27303E] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {getInitials()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="truncate text-xs capitalize text-slate-400">
              {(role || "user").replace(/_/g, " ")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#27303E] p-1">
          <div className="flex gap-1 rounded-full bg-[#111827] p-1">
            <button
              type="button"
              onClick={() => isDarkMode && toggleTheme()}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors",
                !isDarkMode
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <Sun size={14} />
              Light
            </button>
            <button
              type="button"
              onClick={() => !isDarkMode && toggleTheme()}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors",
                isDarkMode
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <Moon size={14} />
              Dark
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
