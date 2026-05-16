const prisma = require("../prismaClient");
const { reqUserDbId } = require("./userAuthorization");

/** Only submissions created by this user (all roles, including admins). */
function buildOwnFormResponseWhere(userId) {
  if (!userId) return { id: { in: [] } };
  return { submittedById: userId };
}

/**
 * @returns {Promise<{ ok: true, row } | { ok: false, status: number, message: string }>}
 */
async function assertOwnFormResponse(req, responseId) {
  const userId = reqUserDbId(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const row = await prisma.formResponse.findUnique({
    where: { id: responseId },
    select: { id: true, submittedById: true, answers: true, category: true },
  });

  if (!row) {
    return { ok: false, status: 404, message: "Response not found" };
  }

  if (row.submittedById !== userId) {
    return { ok: false, status: 403, message: "You can only access your own submissions" };
  }

  return { ok: true, row };
}

module.exports = {
  buildOwnFormResponseWhere,
  assertOwnFormResponse,
};
