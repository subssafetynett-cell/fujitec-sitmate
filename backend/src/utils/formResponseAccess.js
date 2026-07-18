const prisma = require("../prismaClient");
const { reqUserDbId, resolveTokenRole } = require("./userAuthorization");
const {
  canViewFormResponse,
} = require("./generalFormVisibility");
const { getActingClientId, getScopedUser } = require("./actingClientScope");
const { isGlobalSiteAccess } = require("./siteAccess");

/** Legacy: only own submissions (used where company sharing does not apply). */
function buildOwnFormResponseWhere(userId) {
  if (!userId) return { id: { in: [] } };
  return { submittedById: userId };
}

/**
 * Company scope uses FormResponse.clientId (company at submit time), with a
 * legacy fallback to submittedBy.clientId for rows not yet backfilled.
 */
function buildCompanyClientFormResponseWhere(clientId) {
  if (!clientId) return { id: { in: [] } };
  return {
    OR: [
      { clientId },
      { AND: [{ clientId: null }, { submittedBy: { clientId } }] },
    ],
  };
}

/** All submissions for an organisation (superadmin acting as company). */
function buildActingClientFormResponseWhere(actingClientId) {
  return buildCompanyClientFormResponseWhere(actingClientId);
}

/**
 * Read scope for form response lists and detail views.
 * - globalAccess: Safetynett / platform superadmin (all orgs when not acting as a client)
 * - companyWideRead: company_admin (own org), or superadmin while "View as company"
 */
function getFormResponseReadScope(user, actingClientId = null) {
  if (!user) return { globalAccess: false, companyWideRead: false };

  if (isGlobalSiteAccess(user, actingClientId)) {
    return { globalAccess: true, companyWideRead: false };
  }

  if (actingClientId && resolveTokenRole(user) === "superadmin") {
    return { globalAccess: false, companyWideRead: true };
  }

  const effectiveRole = resolveTokenRole(user);
  if (effectiveRole === "company_admin" && user.clientId) {
    return { globalAccess: false, companyWideRead: true };
  }

  return { globalAccess: false, companyWideRead: false };
}

/** @deprecated prefer getFormResponseReadScope */
function hasCompanyWideFormRead(user, actingClientId = null) {
  const scope = getFormResponseReadScope(user, actingClientId);
  return scope.globalAccess || scope.companyWideRead;
}

/**
 * List query — own submissions for field roles; company-wide for company_admin / acting superadmin.
 *
 * Never filter with `answers: { contains: ... }` here. That forces Postgres/Prisma to scan the
 * full JSON blob (often with large base64 images) and intermittently 500s for tenant companies.
 * Public/private visibility is enforced after fetch via canViewFormResponse().
 */
function buildCompanyFormResponseWhere(
  userId,
  clientId,
  actingClientId = null,
  readScope = {}
) {
  const { globalAccess = false, companyWideRead = false } = readScope;
  if (!userId) return { id: { in: [] } };
  if (actingClientId && companyWideRead) {
    return buildActingClientFormResponseWhere(actingClientId);
  }
  if (globalAccess) return {};
  if (companyWideRead) {
    if (!clientId) return {};
    return buildCompanyClientFormResponseWhere(clientId);
  }
  // Field roles: own rows + same-company rows (public/private filtered in canViewFormResponse).
  // Site-pack fills stay submitter-only at the visibility layer.
  if (!clientId) return { submittedById: userId };
  return {
    OR: [
      { submittedById: userId },
      { clientId },
      { AND: [{ clientId: null }, { submittedBy: { clientId } }] },
    ],
  };
}

/**
 * @returns {Promise<{ ok: true, row } | { ok: false, status: number, message: string }>}
 */
async function assertFormResponseAccess(req, responseId, { write = false } = {}) {
  const userId = reqUserDbId(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const row = await prisma.formResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      submittedById: true,
      clientId: true,
      answers: true,
      category: true,
      form: { select: { title: true } },
      submittedBy: { select: { id: true, clientId: true } },
    },
  });

  if (!row) {
    return { ok: false, status: 404, message: "Response not found" };
  }

  if (write) {
    if (row.submittedById === userId) {
      return { ok: true, row };
    }

    const actingClientId = getActingClientId(req);
    const scoped = getScopedUser(req);
    const clientId = actingClientId || scoped?.clientId || req.user?.clientId;
    const readScope = {
      ...getFormResponseReadScope(req.user, actingClientId),
      userEmail: req.user?.email,
      userDisplayName: [req.user?.firstName, req.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
    };

    // Update/delete must match view/download — do not grant broader write than read
    // (e.g. platform superadmin cannot edit private general forms they cannot view).
    if (canViewFormResponse(row, userId, clientId, readScope)) {
      return { ok: true, row };
    }

    return {
      ok: false,
      status: 403,
      message: "You can only update or delete your own submissions",
    };
  }

  const actingClientId = getActingClientId(req);
  const scoped = getScopedUser(req);
  const clientId = actingClientId || scoped?.clientId || req.user?.clientId;
  const readScope = {
    ...getFormResponseReadScope(req.user, actingClientId),
    userEmail: req.user?.email,
    userDisplayName: [req.user?.firstName, req.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
  if (!canViewFormResponse(row, userId, clientId, readScope)) {
    return { ok: false, status: 403, message: "You do not have access to this submission" };
  }

  return { ok: true, row };
}

/** @deprecated use assertFormResponseAccess */
async function assertOwnFormResponse(req, responseId) {
  return assertFormResponseAccess(req, responseId, { write: false });
}

module.exports = {
  buildOwnFormResponseWhere,
  buildCompanyClientFormResponseWhere,
  buildActingClientFormResponseWhere,
  buildCompanyFormResponseWhere,
  getFormResponseReadScope,
  hasCompanyWideFormRead,
  assertFormResponseAccess,
  assertOwnFormResponse,
  canViewFormResponse,
};
