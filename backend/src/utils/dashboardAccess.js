const { isGlobalSiteAccess, buildSiteListWhere } = require("./siteAccess");

/**
 * Site IDs assigned to this site manager (managerId = user id).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} managerUserId
 * @returns {Promise<string[]>}
 */
async function getManagedSiteIds(prisma, managerUserId) {
  if (!managerUserId) return [];
  const sites = await prisma.site.findMany({
    where: { managerId: managerUserId },
    select: { id: true },
  });
  return sites.map((s) => s.id);
}

function canShowDashboardUsers(actor) {
  if (!actor) return false;
  const role = actor.role || "worker";
  return role === "superadmin" || role === "company_admin";
}

function buildDashboardUserCountWhere(actor) {
  if (!canShowDashboardUsers(actor)) return null;
  if (isGlobalSiteAccess(actor)) return {};
  if (actor.role === "company_admin" && actor.clientId) {
    return { clientId: actor.clientId };
  }
  return null;
}

function getDashboardScopeMeta(actor) {
  if (!actor) {
    return {
      label: "Not signed in",
      role: "worker",
      capabilities: {
        showSites: false,
        showUsers: false,
        showCompliance: false,
        showFormsByCompany: false,
      },
    };
  }

  const role = actor.role || "worker";
  const global = isGlobalSiteAccess(actor);
  const showUsers = canShowDashboardUsers(actor);

  if (global) {
    return {
      label: "All organisations",
      role,
      capabilities: {
        showSites: true,
        showUsers,
        showCompliance: true,
        showFormsByCompany: true,
      },
    };
  }

  if (role === "company_admin") {
    return {
      label: actor.companyname || "Your company",
      role,
      capabilities: {
        showSites: true,
        showUsers,
        showCompliance: true,
        showFormsByCompany: false,
      },
    };
  }

  if (role === "site_manager") {
    return {
      label: actor.companyname ? `${actor.companyname} · your sites` : "Your sites",
      role,
      capabilities: {
        showSites: true,
        showUsers: false,
        showCompliance: true,
        showFormsByCompany: false,
      },
    };
  }

  if (role === "supervisor") {
    return {
      label: actor.companyname || "Your organisation",
      role,
      capabilities: {
        showSites: false,
        showUsers: false,
        showCompliance: true,
        showFormsByCompany: false,
      },
    };
  }

  return {
    label: "Your submissions",
    role,
    capabilities: {
      showSites: false,
      showUsers: false,
      showCompliance: true,
      showFormsByCompany: false,
    },
  };
}

/**
 * Form submission counts per company (Client), for superadmin dashboard.
 */
async function buildFormsByCompany(prisma) {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      users: {
        select: {
          _count: { select: { submittedResponses: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return clients
    .map((client) => ({
      clientId: client.id,
      companyName: client.name,
      count: client.users.reduce(
        (sum, user) => sum + user._count.submittedResponses,
        0
      ),
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.companyName.localeCompare(b.companyName)
    );
}

/**
 * Prisma `where` for form responses visible on the dashboard.
 * Site managers: submissions tied to their assigned sites (answers.siteId),
 * plus their own submissions without a site context.
 */
async function buildDashboardResponseWhere(prisma, actor) {
  if (!actor?.id) return { id: { in: [] } };

  if (isGlobalSiteAccess(actor)) {
    return {};
  }

  const role = actor.role || "worker";

  if (role === "company_admin" && actor.clientId) {
    return { submittedBy: { clientId: actor.clientId } };
  }

  if (role === "site_manager") {
    const siteIds = await getManagedSiteIds(prisma, actor.id);
    const orClauses = [{ submittedById: actor.id }];

    for (const siteId of siteIds) {
      orClauses.push({
        answers: {
          path: ["siteId"],
          equals: siteId,
        },
      });
    }

    if (orClauses.length === 1 && siteIds.length === 0) {
      return { submittedById: actor.id };
    }

    return { OR: orClauses };
  }

  if (role === "supervisor" && actor.clientId) {
    return { submittedBy: { clientId: actor.clientId } };
  }

  return { submittedById: actor.id };
}

module.exports = {
  buildDashboardResponseWhere,
  buildDashboardUserCountWhere,
  buildSiteListWhere,
  getDashboardScopeMeta,
  getManagedSiteIds,
  canShowDashboardUsers,
  buildFormsByCompany,
};
