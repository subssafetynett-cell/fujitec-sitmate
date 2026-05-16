// src/components/RoleGuard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveEffectiveRole } from "../utils/resolveEffectiveRole";

/**
 * Wraps a route and allows only users whose effective role is in `allowedRoles`.
 * `matchStoredRoleOnly` uses the same effective role as the API (DB + Safetynett company_admin).
 */
export default function RoleGuard({ allowedRoles = [], children, matchStoredRoleOnly = false }) {
  const { currentUser, hasRole } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effective = resolveEffectiveRole(currentUser);
  const allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((r) =>
    String(r).toLowerCase()
  );

  const permitted =
    allowed.length === 0 ||
    (matchStoredRoleOnly ? allowed.includes(effective) : hasRole(allowedRoles));

  if (permitted) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}
