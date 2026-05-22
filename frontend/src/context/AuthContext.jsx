import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";
import {
  clearAuthStorage,
  getStoredToken,
  isTokenExpired,
  handleSessionExpired,
  scheduleTokenExpiryLogout,
} from "../utils/authSession";
import { applyActingClientToUser } from "../utils/actingClient";
import { isSafetynettCompanyName, resolveEffectiveRole } from "../utils/resolveEffectiveRole";

// ─── Role helpers ──────────────────────────────────────────────────────────────
export const ROLES = {
  SUPERADMIN:    "superadmin",
  COMPANY_ADMIN: "company_admin",
  SITE_MANAGER:  "site_manager",
  SUPERVISOR:    "supervisor",
  WORKER:        "worker",
};

// Ordered from lowest to highest privilege
const ROLE_HIERARCHY = [
  ROLES.WORKER,
  ROLES.SUPERVISOR,
  ROLES.SITE_MANAGER,
  ROLES.COMPANY_ADMIN,
  ROLES.SUPERADMIN,
];

// Roles a given role is allowed to assign when inviting users
export const ASSIGNABLE_ROLES = {
  [ROLES.SUPERADMIN]:    [ROLES.WORKER, ROLES.SUPERVISOR, ROLES.SITE_MANAGER, ROLES.COMPANY_ADMIN, ROLES.SUPERADMIN],
  [ROLES.COMPANY_ADMIN]: [ROLES.WORKER, ROLES.SUPERVISOR, ROLES.SITE_MANAGER, ROLES.COMPANY_ADMIN],
  [ROLES.SITE_MANAGER]:  [ROLES.WORKER, ROLES.SUPERVISOR],
  [ROLES.SUPERVISOR]:    [],
  [ROLES.WORKER]:        [],
};

// ─── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function readUserFromStorage() {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) {
    if (token) clearAuthStorage();
    return null;
  }
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) return null;
    const withRole = { ...user, role: resolveEffectiveRole(user) };
    if (resolveEffectiveRole(withRole) === ROLES.SUPERADMIN) {
      return applyActingClientToUser(withRole);
    }
    return withRole;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readUserFromStorage());

  /** Call after login/signup to sync context with localStorage */
  const refreshUser = useCallback(() => {
    const user = readUserFromStorage();
    setCurrentUser(user);
    const token = getStoredToken();
    if (token && !isTokenExpired(token)) {
      scheduleTokenExpiryLogout(token);
    }
  }, []);

  /** Pull latest role/profile from server (e.g. after admin changes this user's role). */
  const refreshUserFromServer = useCallback(async () => {
    const token = getStoredToken();
    if (!token || isTokenExpired(token)) {
      clearAuthStorage();
      setCurrentUser(null);
      return null;
    }
    try {
      const res = await api.get("/auth/me");
      if (res.data?.success && res.data.user) {
        const u = res.data.user;
        localStorage.setItem("user", JSON.stringify(u));
        const next = readUserFromStorage();
        setCurrentUser(next);
        scheduleTokenExpiryLogout(token);
        return next;
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleSessionExpired("unauthorized");
      }
    }
    return readUserFromStorage();
  }, []);

  /** Call on logout */
  const clearUser = useCallback(() => {
    clearAuthStorage();
    setCurrentUser(null);
  }, []);


  const isSafetyNett = isSafetynettCompanyName(
    currentUser?.companyname || currentUser?.company || currentUser?.employer
  );

  const role = resolveEffectiveRole(currentUser);

  const hasMinRole = useCallback((minRole) => {
    const userIdx = ROLE_HIERARCHY.indexOf(role);
    const minIdx = ROLE_HIERARCHY.indexOf(minRole);
    return userIdx >= minIdx;
  }, [role]);

  /** Returns true if the current user has one of the allowed roles (uses effective role). */
  const hasRole = useCallback((allowedRoles) => {
    const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) =>
      String(r).toLowerCase()
    );
    return roles.includes(role);
  }, [role]);

  const value = {
    currentUser,
    role,
    isSafetyNett,
    isSuperAdmin: role === ROLES.SUPERADMIN,
    isCompanyAdmin:  hasMinRole(ROLES.COMPANY_ADMIN),
    isSiteManager:   hasMinRole(ROLES.SITE_MANAGER),
    isSupervisor:    hasMinRole(ROLES.SUPERVISOR),
    isWorker:        true, // every authenticated user is at least a worker
    hasRole,
    hasMinRole,
    refreshUser,
    refreshUserFromServer,
    clearUser,
    assignableRoles: ASSIGNABLE_ROLES[role] ?? [],
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export default AuthContext;
