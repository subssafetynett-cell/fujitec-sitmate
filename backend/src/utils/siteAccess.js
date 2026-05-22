const { isSafetynettCompanyName } = require("./company");

function isGlobalSiteAccess(user, actingClientId = null) {
  if (!user) return false;
  if (actingClientId) return false;
  if (isSafetynettCompanyName(user.companyname || user.company)) return true;
  return user.role === "superadmin";
}

function buildAssignedSiteWhere(userId) {
  return {
    OR: [
      { managerId: userId },
      { siteManagers: { some: { userId } } },
    ],
  };
}

/** Prisma `where` fragment for listing sites for the current user. */
function buildSiteListWhere(user, actingClientId = null) {
  if (actingClientId) {
    return { clientId: actingClientId };
  }

  if (isGlobalSiteAccess(user)) {
    return {};
  }

  if (user.role === "company_admin" && user.clientId) {
    return { clientId: user.clientId };
  }

  // Any user explicitly assigned as a site manager (any role).
  return buildAssignedSiteWhere(user.id);
}

function mergeSiteSearchWhere(accessWhere, search) {
  const term = (search || "").trim();
  if (!term) return accessWhere;

  const searchClause = {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { address: { contains: term, mode: "insensitive" } },
    ],
  };

  if (!accessWhere || Object.keys(accessWhere).length === 0) {
    return searchClause;
  }

  return { AND: [accessWhere, searchClause] };
}

function resolveSiteClientId(req, managerClientId) {
  if (managerClientId) return managerClientId;
  if (req.user?.clientId) return req.user.clientId;
  return null;
}

async function userCanAccessSite(prisma, user, siteId, actingClientId = null) {
  if (!siteId || !user) return false;
  if (isGlobalSiteAccess(user, actingClientId)) return true;

  if (actingClientId) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        clientId: true,
        manager: { select: { clientId: true } },
      },
    });
    if (!site) return false;
    const siteClientId = site.clientId || site.manager?.clientId || null;
    return siteClientId === actingClientId;
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      clientId: true,
      managerId: true,
      manager: { select: { clientId: true } },
    },
  });

  if (!site) return false;

  const siteClientId = site.clientId || site.manager?.clientId || null;

  if (user.role === "company_admin" && user.clientId) {
    return siteClientId === user.clientId;
  }

  if (site.managerId === user.id) return true;

  const assignment = await prisma.siteManager.findFirst({
    where: { siteId, userId: user.id },
    select: { siteId: true },
  });
  return Boolean(assignment);
}

module.exports = {
  isGlobalSiteAccess,
  buildSiteListWhere,
  buildAssignedSiteWhere,
  mergeSiteSearchWhere,
  resolveSiteClientId,
  userCanAccessSite,
};
