/** Roles that may list or read client records (scoped to own org for company_admin). */
const CLIENT_READ_ROLES = ["superadmin", "company_admin"];

/** Roles that may create or delete client organisations. */
const CLIENT_MANAGE_ROLES = ["superadmin"];

function canReadClients(role) {
  return CLIENT_READ_ROLES.includes(role);
}

function canManageAllClients(role) {
  return role === "superadmin";
}

/**
 * Prisma where clause for listing clients for the current user.
 * @returns {{ where: object } | { forbidden: true }}
 */
function buildClientListWhere(req) {
  const role = req.user?.role;
  if (!canReadClients(role)) {
    return { forbidden: true };
  }
  if (role === "superadmin") {
    return { where: {} };
  }
  if (role === "company_admin") {
    if (!req.user.clientId) {
      return { forbidden: true };
    }
    return { where: { id: req.user.clientId } };
  }
  return { forbidden: true };
}

/**
 * Whether the user may read a single client by id.
 */
function canAccessClientById(req, clientId) {
  const role = req.user?.role;
  if (!canReadClients(role)) return false;
  if (role === "superadmin") return true;
  if (role === "company_admin") {
    return Boolean(req.user.clientId && req.user.clientId === clientId);
  }
  return false;
}

module.exports = {
  CLIENT_READ_ROLES,
  CLIENT_MANAGE_ROLES,
  canReadClients,
  canManageAllClients,
  buildClientListWhere,
  canAccessClientById,
};
