// src/components/RoleGuard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a route and allows only users whose role is in `allowedRoles`.
 * Safetynett users always pass through.
 *
 * Usage:
 *  <RoleGuard allowedRoles={["superadmin", "company_admin"]}>
 *    <SomePage />
 *  </RoleGuard>
 */
export default function RoleGuard({ allowedRoles = [], children }) {
  const { currentUser, hasRole, isSafetyNett } = useAuth();
  const location = useLocation();

  // Not logged in → send to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Safetynett bypass or role matches → allow through
  if (isSafetyNett || allowedRoles.length === 0 || hasRole(allowedRoles)) {
    return children;
  }

  // Insufficient role → redirect to 403 page
  return <Navigate to="/unauthorized" state={{ from: location }} replace />;
}
