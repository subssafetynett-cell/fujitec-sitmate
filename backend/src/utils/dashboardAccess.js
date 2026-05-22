const { isGlobalSiteAccess, buildSiteListWhere } = require("./siteAccess");

/**
 * Site IDs assigned to this site manager (managerId = user id).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} managerUserId
 * @returns {Promise<string[]>}
 */
async function getManagedSiteIds(prisma, managerUserId) {
  if (!managerUserId) return [];
  const [legacySites, assignments] = await Promise.all([
    prisma.site.findMany({
      where: { managerId: managerUserId },
      select: { id: true },
    }),
    prisma.siteManager.findMany({
      where: { userId: managerUserId },
      select: { siteId: true },
    }),
  ]);
  return [
    ...new Set([
      ...legacySites.map((s) => s.id),
      ...assignments.map((a) => a.siteId),
    ]),
  ];
}

function canShowDashboardUsers(actor) {
  if (!actor) return false;
  const role = actor.role || "worker";
  return role === "superadmin" || role === "company_admin";
}

function buildDashboardUserCountWhere(actor, actingClientId = null) {
  if (!canShowDashboardUsers(actor)) return null;
  if (actingClientId) return { clientId: actingClientId };
  if (isGlobalSiteAccess(actor)) return {};
  if (actor.role === "company_admin" && actor.clientId) {
    return { clientId: actor.clientId };
  }
  return null;
}

function getDashboardScopeMeta(actor, actingClient = null) {
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
  const showUsers = canShowDashboardUsers(actor);

  if (actingClient?.id) {
    return {
      label: actingClient.name,
      role,
      actingClientId: actingClient.id,
      capabilities: {
        showSites: true,
        showUsers,
        showCompliance: true,
        showFormsByCompany: false,
      },
    };
  }

  const global = isGlobalSiteAccess(actor);

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
  const rows = await prisma.$queryRaw`
    SELECT
      c.id AS "clientId",
      c.name AS "companyName",
      COALESCE(counts."count", 0)::int AS "count"
    FROM "Client" c
    LEFT JOIN (
      SELECT u."clientId", COUNT(fr.id)::int AS "count"
      FROM "User" u
      INNER JOIN "FormResponse" fr ON fr."submittedById" = u.id
      GROUP BY u."clientId"
    ) counts ON counts."clientId" = c.id
    ORDER BY "count" DESC, c.name ASC
  `;

  return rows.map((row) => ({
    clientId: row.clientId,
    companyName: row.companyName,
    count: Number(row.count) || 0,
  }));
}

/**
 * Prisma `where` for form responses visible on the dashboard.
 * Site managers: submissions tied to their assigned sites (answers.siteId),
 * plus their own submissions without a site context.
 */
async function buildDashboardResponseWhere(prisma, actor, actingClientId = null) {
  if (!actor?.id) return { id: { in: [] } };

  if (actingClientId) {
    return { submittedBy: { clientId: actingClientId } };
  }

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

  if (role === "supervisor") {
    return { submittedById: actor.id };
  }

  return { submittedById: actor.id };
}

const TIMELINE_MONTHS = 24;

function timelineSinceDate() {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (TIMELINE_MONTHS - 1));
  return since;
}

/**
 * Monthly submission counts (SQL aggregation) — avoids loading every createdAt row.
 */
async function fetchMonthlySubmissionCounts(prisma, responseWhere) {
  const since = timelineSinceDate();

  if (responseWhere?.OR) {
    const rows = await prisma.formResponse.findMany({
      where: { AND: [responseWhere, { createdAt: { gte: since } }] },
      select: { createdAt: true },
    });
    const byMonth = new Map();
    for (const row of rows) {
      const d = new Date(row.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) || 0) + 1);
    }
    return Array.from(byMonth.entries()).map(([monthKey, count]) => {
      const [yearStr, monthStr] = monthKey.split("-");
      return { year: Number(yearStr), month: Number(monthStr), count };
    });
  }

  const submittedById = responseWhere?.submittedById;
  const clientId = responseWhere?.submittedBy?.clientId;

  let rows;
  if (submittedById) {
    rows = await prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS count
      FROM "FormResponse"
      WHERE "submittedById" = ${submittedById}
        AND "createdAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1, 2`;
  } else if (clientId) {
    rows = await prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM fr."createdAt")::int AS year,
        EXTRACT(MONTH FROM fr."createdAt")::int AS month,
        COUNT(*)::int AS count
      FROM "FormResponse" fr
      INNER JOIN "User" u ON u.id = fr."submittedById"
      WHERE u."clientId" = ${clientId}
        AND fr."createdAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1, 2`;
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS count
      FROM "FormResponse"
      WHERE "createdAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1, 2`;
  }

  return rows.map((row) => ({
    year: Number(row.year),
    month: Number(row.month),
    count: Number(row.count) || 0,
  }));
}

module.exports = {
  buildDashboardResponseWhere,
  buildDashboardUserCountWhere,
  buildSiteListWhere,
  getDashboardScopeMeta,
  getManagedSiteIds,
  canShowDashboardUsers,
  buildFormsByCompany,
  fetchMonthlySubmissionCounts,
};
