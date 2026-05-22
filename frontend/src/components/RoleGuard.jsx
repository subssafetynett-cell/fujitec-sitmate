// src/components/RoleGuard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStoredRole, resolveEffectiveRole } from "../utils/resolveEffectiveRole";

/**
 * Wraps a route and allows only users whose role is in `allowedRoles`.
 * Default: effective role (platform seed admin is superadmin; other Safetynett users are not).
 * `matchStoredRoleOnly`: compare stored JWT role only — use when the literal token role must apply.
 */
export default function RoleGuard({ allowedRoles = [], children, matchStoredRoleOnly = false }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleForCheck = matchStoredRoleOnly
    ? getStoredRole(currentUser)
    : resolveEffectiveRole(currentUser);
  const allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) =>
    String(r).toLowerCase()
  );

  const permitted = allowed.length === 0 || allowed.includes(roleForCheck);

  if (permitted) {
    return children;
  }

  return <Navigate to="/unauthorized" state={{ from: location }} replace />;
}
