const { Prisma } = require("@prisma/client");
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
 * Only returns companies with at least one submission (top N by count).
 */
async function buildFormsByCompany(prisma, { limit = 40 } = {}) {
  const take = Math.min(100, Math.max(1, Number(limit) || 40));
  const rows = await prisma.$queryRaw`
    SELECT
      c.id AS "clientId",
      c.name AS "companyName",
      counts."count"::int AS "count"
    FROM (
      SELECT COALESCE(fr."clientId", u."clientId") AS "clientId", COUNT(fr.id)::int AS "count"
      FROM "FormResponse" fr
      LEFT JOIN "User" u ON u.id = fr."submittedById"
      WHERE COALESCE(fr."clientId", u."clientId") IS NOT NULL
      GROUP BY COALESCE(fr."clientId", u."clientId")
      HAVING COUNT(fr.id) > 0
      ORDER BY COUNT(fr.id) DESC
      LIMIT ${take}
    ) counts
    INNER JOIN "Client" c ON c.id = counts."clientId"
    ORDER BY counts."count" DESC, c.name ASC
  `;

  return rows.map((row) => ({
    clientId: row.clientId,
    companyName: row.companyName,
    count: Number(row.count) || 0,
  }));
}

/**
 * Prisma `where` for form responses visible on the dashboard.
 * Site managers: prefer indexed FormResponse.siteId (backfilled from answers.siteId).
 */
async function buildDashboardResponseWhere(prisma, actor, actingClientId = null) {
  if (!actor?.id) return { id: { in: [] } };

  if (actingClientId) {
    return {
      OR: [
        { clientId: actingClientId },
        { AND: [{ clientId: null }, { submittedBy: { clientId: actingClientId } }] },
      ],
    };
  }

  if (isGlobalSiteAccess(actor)) {
    return {};
  }

  const role = actor.role || "worker";

  if (role === "company_admin" && actor.clientId) {
    return {
      OR: [
        { clientId: actor.clientId },
        { AND: [{ clientId: null }, { submittedBy: { clientId: actor.clientId } }] },
      ],
    };
  }

  if (role === "site_manager") {
    const siteIds = await getManagedSiteIds(prisma, actor.id);
    if (siteIds.length === 0) {
      return { submittedById: actor.id };
    }

    return {
      OR: [{ submittedById: actor.id }, { siteId: { in: siteIds } }],
    };
  }

  if (role === "supervisor") {
    return { submittedById: actor.id };
  }

  return { submittedById: actor.id };
}

/** Extract site-manager scope parts from a dashboard response where clause. */
function extractSiteManagerScope(responseWhere) {
  if (!responseWhere?.OR) return { actorId: null, siteIds: [] };

  const actorId =
    responseWhere.OR.find((clause) => clause.submittedById)?.submittedById ?? null;
  const siteIds = [];

  for (const clause of responseWhere.OR) {
    if (Array.isArray(clause.siteId?.in)) {
      for (const id of clause.siteId.in) {
        if (typeof id === "string" && id.trim()) siteIds.push(id);
      }
    }
    if (typeof clause.answers?.equals === "string" && clause.answers.equals.trim()) {
      siteIds.push(clause.answers.equals);
    }
  }

  return { actorId, siteIds: [...new Set(siteIds)] };
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
    const { actorId, siteIds } = extractSiteManagerScope(responseWhere);

    if (actorId && siteIds.length > 0) {
      const rows = await prisma.$queryRaw`
        SELECT
          EXTRACT(YEAR FROM fr."createdAt")::int AS year,
          EXTRACT(MONTH FROM fr."createdAt")::int AS month,
          COUNT(*)::int AS count
        FROM "FormResponse" fr
        WHERE fr."createdAt" >= ${since}
          AND (
            fr."submittedById" = ${actorId}
            OR fr."siteId" IN (${Prisma.join(siteIds)})
          )
        GROUP BY 1, 2
        ORDER BY 1, 2`;
      return rows.map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count) || 0,
      }));
    }

    if (actorId) {
      const rows = await prisma.$queryRaw`
        SELECT
          EXTRACT(YEAR FROM "createdAt")::int AS year,
          EXTRACT(MONTH FROM "createdAt")::int AS month,
          COUNT(*)::int AS count
        FROM "FormResponse"
        WHERE "submittedById" = ${actorId}
          AND "createdAt" >= ${since}
        GROUP BY 1, 2
        ORDER BY 1, 2`;
      return rows.map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count) || 0,
      }));
    }
  }

  const submittedById = responseWhere?.submittedById;
  const clientId =
    responseWhere?.clientId ||
    responseWhere?.submittedBy?.clientId ||
    responseWhere?.OR?.find((clause) => clause.clientId)?.clientId ||
    responseWhere?.OR?.find((clause) => clause.AND)?.AND?.find((c) => c.submittedBy?.clientId)
      ?.submittedBy?.clientId;

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
      LEFT JOIN "User" u ON u.id = fr."submittedById"
      WHERE (
          fr."clientId" = ${clientId}
          OR (fr."clientId" IS NULL AND u."clientId" = ${clientId})
        )
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
  extractSiteManagerScope,
};
