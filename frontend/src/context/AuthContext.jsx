import React, { createContext, useContext, useState, useCallback } from "react";

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
  [ROLES.COMPANY_ADMIN]: [ROLES.WORKER, ROLES.SUPERVISOR, ROLES.SITE_MANAGER],
  [ROLES.SITE_MANAGER]:  [ROLES.WORKER, ROLES.SUPERVISOR],
  [ROLES.SUPERVISOR]:    [],
  [ROLES.WORKER]:        [],
};

// ─── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function readUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readUserFromStorage());

  /** Call after login/signup to sync context with localStorage */
  const refreshUser = useCallback(() => {
    setCurrentUser(readUserFromStorage());
  }, []);

  /** Call on logout */
  const clearUser = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setCurrentUser(null);
  }, []);


  const isSafetyNett = (currentUser?.companyname || currentUser?.company || "")
    .toString().trim().toLowerCase().replace(/\s+/g, "") === "safetynett";

  // Safetynett users are always superadmin regardless of what is stored in DB/token
  const role = isSafetyNett ? ROLES.SUPERADMIN : (currentUser?.role ?? ROLES.WORKER);

  const hasMinRole = useCallback((minRole) => {
    if (isSafetyNett) return true; // Safetynett bypasses role checks
    const userIdx = ROLE_HIERARCHY.indexOf(role);
    const minIdx  = ROLE_HIERARCHY.indexOf(minRole);
    return userIdx >= minIdx;
  }, [role, isSafetyNett]);

  /** Returns true if the current user has one of the allowed roles */
  const hasRole = useCallback((allowedRoles) => {
    if (isSafetyNett) return true;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(role);
  }, [role, isSafetyNett]);

  const value = {
    currentUser,
    role,
    isSafetyNett,
    isSuperAdmin:    role === ROLES.SUPERADMIN || isSafetyNett,
    isCompanyAdmin:  hasMinRole(ROLES.COMPANY_ADMIN),
    isSiteManager:   hasMinRole(ROLES.SITE_MANAGER),
    isSupervisor:    hasMinRole(ROLES.SUPERVISOR),
    isWorker:        true, // every authenticated user is at least a worker
    hasRole,
    hasMinRole,
    refreshUser,
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
