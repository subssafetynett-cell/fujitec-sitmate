const prisma = require("../prismaClient");
const { isSafetynettCompanyName } = require("./company");
const { resolveTokenRole } = require("./userAuthorization");

const ACTING_CLIENT_HEADER = "x-acting-client-id";

/**
 * When superadmin sends X-Acting-Client-Id, scope lists to that organisation.
 * Sets req.actingClient, req.scopedUser (JWT user + acting clientId/companyname).
 */
async function attachActingClient(req) {
  req.actingClient = null;
  req.scopedUser = req.user || null;
  if (!req.user) return;

  const role = resolveTokenRole(req.user);
  if (role !== "superadmin") return;

  const raw = req.headers[ACTING_CLIENT_HEADER];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!client || isSafetynettCompanyName(client.name)) return;

  req.actingClient = client;
  req.scopedUser = {
    ...req.user,
    clientId: client.id,
    companyname: client.name,
    company: client.name,
  };
}

function getActingClientId(req) {
  return req.actingClient?.id || null;
}

function getScopedUser(req) {
  return req.scopedUser || req.user;
}

module.exports = {
  ACTING_CLIENT_HEADER,
  attachActingClient,
  getActingClientId,
  getScopedUser,
};
