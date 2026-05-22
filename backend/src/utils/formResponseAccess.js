const prisma = require("../prismaClient");
const { reqUserDbId } = require("./userAuthorization");
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

/** Candidates for list endpoints — filtered in memory for public/private rules. */
function buildCompanyFormResponseWhere(userId, clientId, actingClientId = null) {
  if (!userId) return { id: { in: [] } };
  if (actingClientId) return buildActingClientFormResponseWhere(actingClientId);
  if (!clientId) return { submittedById: userId };
  return {
    OR: [{ submittedById: userId }, { submittedBy: { clientId } }],
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
  const clientId = actingClientId || scoped?.clientId;
  const globalAccess = isGlobalSiteAccess(req.user, actingClientId);
  if (!canViewFormResponse(row, userId, clientId, { globalAccess })) {
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
  assertFormResponseAccess,
  assertOwnFormResponse,
  canViewFormResponse,
};
