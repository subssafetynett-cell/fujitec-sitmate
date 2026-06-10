const prisma = require("../prismaClient");
const { reqUserDbId, resolveTokenRole } = require("./userAuthorization");
const { canViewFormResponse } = require("./generalFormVisibility");
const { getActingClientId, getScopedUser } = require("./actingClientScope");
const { isGlobalSiteAccess } = require("./siteAccess");

/** Legacy: only own submissions (used where company sharing does not apply). */
function buildOwnFormResponseWhere(userId) {
  if (!userId) return { id: { in: [] } };
  return { submittedById: userId };
}

/** All submissions for an organisation (superadmin acting as company). */
function buildActingClientFormResponseWhere(actingClientId) {
  if (!actingClientId) return { id: { in: [] } };
  return { submittedBy: { clientId: actingClientId } };
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

  const dbRole = user.role || "worker";
  if (dbRole === "company_admin" && user.clientId) {
    return { globalAccess: false, companyWideRead: true };
  }

  return { globalAccess: false, companyWideRead: false };
}

/** @deprecated prefer getFormResponseReadScope */
function hasCompanyWideFormRead(user, actingClientId = null) {
  const scope = getFormResponseReadScope(user, actingClientId);
  return scope.globalAccess || scope.companyWideRead;
}

/** List query — own submissions for field roles; company-wide for company_admin / acting superadmin. */
function buildCompanyFormResponseWhere(
  userId,
  clientId,
  actingClientId = null,
  readScope = {}
) {
  const { globalAccess = false, companyWideRead = false } = readScope;
  if (!userId) return { id: { in: [] } };
  if (actingClientId && companyWideRead) {
    return {
      OR: [
        buildActingClientFormResponseWhere(actingClientId),
        {
          submittedBy: { clientId: actingClientId },
          answers: { contains: { visibility: "public" } },
        },
      ],
    };
  }
  if (globalAccess) return {};
  if (companyWideRead) {
    if (!clientId) return {};
    return {
      OR: [
        { submittedBy: { clientId } },
        {
          submittedBy: { clientId },
          answers: { contains: { visibility: "public" } },
        },
      ],
    };
  }
  if (!clientId) return { submittedById: userId };
  return {
    OR: [
      { submittedById: userId },
      {
        submittedBy: { clientId },
        answers: { contains: { visibility: "public" } },
      },
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
      answers: true,
      category: true,
      submittedBy: { select: { id: true, clientId: true } },
    },
  });

  if (!row) {
    return { ok: false, status: 404, message: "Response not found" };
  }

  if (write) {
    if (row.submittedById !== userId) {
      return {
        ok: false,
        status: 403,
        message: "You can only update or delete your own submissions",
      };
    }
    return { ok: true, row };
  }

  const actingClientId = getActingClientId(req);
  const scoped = getScopedUser(req);
  const clientId = actingClientId || scoped?.clientId || req.user?.clientId;
  const readScope = getFormResponseReadScope(req.user, actingClientId);
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
  buildActingClientFormResponseWhere,
  buildCompanyFormResponseWhere,
  getFormResponseReadScope,
  hasCompanyWideFormRead,
  assertFormResponseAccess,
  assertOwnFormResponse,
  canViewFormResponse,
};
