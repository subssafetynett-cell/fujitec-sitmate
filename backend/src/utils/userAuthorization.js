const { isSafetynettCompanyName, isPlatformSuperadminEmail } = require("./company");

const ADMIN_LIST_ROLES = ["superadmin", "company_admin"];

/**
 * Authenticated user id from verified JWT only (never from body/params).
 */
function reqUserDbId(req) {
  const u = req.user;
  if (!u) return null;
  return u.id ?? u.userId ?? u.sub ?? null;
}

/**
 * Role used in JWT / UI. Platform seed admin is always superadmin; other Safetynett users are not.
 */
function resolveTokenRole(user) {
  if (!user) return "worker";
  if (isPlatformSuperadminEmail(user.email)) {
    return "superadmin";
  }
  const dbRole = user.role || "worker";
  if (isSafetynettCompanyName(user.companyname) && dbRole === "superadmin") {
    return "company_admin";
  }
  return dbRole;
}

/**
 * Effective role for server-side admin APIs (always from DB record, not client).
 */
function effectiveAdminRole(actor) {
  if (!actor) return null;
  if (isPlatformSuperadminEmail(actor.email)) {
    return "superadmin";
  }
  const dbRole = actor.role || "worker";
  if (isSafetynettCompanyName(actor.companyname) && dbRole === "superadmin") {
    return "company_admin";
  }
  return dbRole;
}

function isAdminRole(role) {
  return ADMIN_LIST_ROLES.includes(role);
}

/**
 * @returns {{ ok: true, actor } | { ok: false, status: number, message: string }}
 */
async function loadAdminActor(prisma, req) {
  const actorId = reqUserDbId(req);
  if (!actorId) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, clientId: true, companyname: true, email: true },
  });

  if (!actor) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const eff = effectiveAdminRole(actor);
  if (!isAdminRole(eff)) {
    return { ok: false, status: 403, message: "Insufficient permissions" };
  }

  return { ok: true, actor: { ...actor, effectiveRole: eff } };
}

/**
 * Whether actor may manage the target user (read/update/status/delete).
 */
function canManageTargetUser(actor, target, effectiveRole = effectiveAdminRole(actor)) {
  if (!actor || !target) return false;
  if (effectiveRole === "superadmin") return true;
  if (effectiveRole === "company_admin") {
    return Boolean(actor.clientId) && actor.clientId === target.clientId;
  }
  return false;
}

module.exports = {
  ADMIN_LIST_ROLES,
  reqUserDbId,
  resolveTokenRole,
  effectiveAdminRole,
  isAdminRole,
  loadAdminActor,
  canManageTargetUser,
};
