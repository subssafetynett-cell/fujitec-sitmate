const asyncHandler = require("express-async-handler");
const { Prisma } = require("@prisma/client");
const prisma = require("../prismaClient");
const { cacheGet, cacheSet } = require("../services/redisCache");

// Longer TTL: dashboard is aggregate-heavy; FE also keeps a multi-minute staleTime.
const DASHBOARD_CACHE_TTL = Number(process.env.DASHBOARD_CACHE_TTL_SEC || 180);

function dashboardCacheKey(prefix, actor, actingClientId) {
  return `dashboard:${prefix}:${actingClientId || actor.clientId || actor.id}`;
}
const {
  buildDashboardResponseWhere,
  buildSiteListWhere,
  getDashboardScopeMeta,
  buildFormsByCompany,
  fetchMonthlySubmissionCounts,
} = require("../utils/dashboardAccess");
const { isGlobalSiteAccess } = require("../utils/siteAccess");
const { countGroupedCategories } = require("../utils/dashboardCategories");
const { getMonitoringSection } = require("../constants/monitoringSections");

const SHEQ_CATEGORIES = ["SHEQ Installation", "SHEQ Inspection"];
/** Recent SHEQ rows for the forms-by-user list (status summary uses SQL over full scope). */
const SHEQ_LIST_LIMIT = 24;
/** Max form cards shown under each user in the SHEQ widget. */
const SHEQ_FORMS_PER_USER = 5;
const RECENT_ACTIONS_LIMIT = 8;

const SHEQ_STATUS_COLORS = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc143c",
  unset: "#94a3b8",
};

function normalizeSheqProjectStatus(answers) {
  const raw = answers?.formData?.projectStatus;
  if (raw === "green" || raw === "amber" || raw === "red") return raw;
  return "unset";
}

function formatUserName(user) {
  if (!user) return "Unknown user";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "Unknown user";
}

function buildSheqDashboardData(responses, { formsPerUser = SHEQ_FORMS_PER_USER } = {}) {
  const summary = { green: 0, amber: 0, red: 0, unset: 0, total: 0 };
  const byUserMap = new Map();

  for (const resp of responses) {
    const status = normalizeSheqProjectStatus(
      resp.answers && typeof resp.answers === "object" ? resp.answers : {}
    );
    summary[status] += 1;
    summary.total += 1;

    const userId = resp.submittedById || "unknown";
    if (!byUserMap.has(userId)) {
      byUserMap.set(userId, {
        userId,
        userName: formatUserName(resp.submittedBy),
        green: 0,
        amber: 0,
        red: 0,
        unset: 0,
        forms: [],
      });
    }

    const entry = byUserMap.get(userId);
    entry[status] += 1;
    const answers =
      resp.answers && typeof resp.answers === "object" ? resp.answers : {};
    entry.forms.push({
      id: resp.id,
      name: answers.name || resp.category || "SHEQ report",
      category: resp.category || "SHEQ",
      status,
      createdAt: resp.createdAt,
      date: new Date(resp.createdAt).toLocaleDateString("en-GB"),
      client: answers.formData?.client || "",
      siteAddress: answers.formData?.siteAddress || "",
    });
  }

  const pieChartData = [
    { name: "Green", value: summary.green, color: SHEQ_STATUS_COLORS.green },
    { name: "Amber", value: summary.amber, color: SHEQ_STATUS_COLORS.amber },
    { name: "Red", value: summary.red, color: SHEQ_STATUS_COLORS.red },
    { name: "Not set", value: summary.unset, color: SHEQ_STATUS_COLORS.unset },
  ].filter((row) => row.value > 0);

  const byUser = Array.from(byUserMap.values())
    .map((row) => ({
      ...row,
      forms: row.forms
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, formsPerUser),
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName));

  const userBarData = byUser.map((row) => ({
    name: row.userName.length > 20 ? `${row.userName.slice(0, 20)}…` : row.userName,
    fullName: row.userName,
    green: row.green,
    amber: row.amber,
    red: row.red,
    unset: row.unset,
  }));

  return { summary, pieChartData, byUser, userBarData };
}

/**
 * Load SHEQ rows without pulling full answers JSON (photos, etc.) into Node.
 */
async function fetchSlimSheqRows(prismaClient, sheqWhere, limit = SHEQ_LIST_LIMIT) {
  const idRows = await prismaClient.formResponse.findMany({
    where: sheqWhere,
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (idRows.length === 0) return [];

  const ids = idRows.map((r) => r.id);
  const rows = await prismaClient.$queryRaw`
    SELECT
      fr.id,
      fr.category,
      fr."createdAt",
      fr."submittedById",
      fr.answers->>'name' AS name,
      fr.answers->'formData'->>'projectStatus' AS "projectStatus",
      fr.answers->'formData'->>'client' AS client,
      fr.answers->'formData'->>'siteAddress' AS "siteAddress",
      u."firstName" AS "firstName",
      u."lastName" AS "lastName",
      u.email AS email
    FROM "FormResponse" fr
    LEFT JOIN "User" u ON u.id = fr."submittedById"
    WHERE fr.id IN (${Prisma.join(ids)})
    ORDER BY fr."createdAt" DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    createdAt: row.createdAt,
    submittedById: row.submittedById,
    submittedBy: {
      id: row.submittedById,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
    },
    answers: {
      name: row.name,
      formData: {
        projectStatus: row.projectStatus,
        client: row.client,
        siteAddress: row.siteAddress,
      },
    },
  }));
}

async function fetchSlimRecentActions(prismaClient, responseWhere, limit = RECENT_ACTIONS_LIMIT) {
  const idRows = await prismaClient.formResponse.findMany({
    where: responseWhere,
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (idRows.length === 0) return [];

  const ids = idRows.map((r) => r.id);
  const rows = await prismaClient.$queryRaw`
    SELECT
      fr.id,
      fr.category,
      fr."createdAt",
      COALESCE(
        NULLIF(TRIM(fr.answers->>'report_heading'), ''),
        NULLIF(TRIM(fr.answers->>'reportHeading'), ''),
        fr.category,
        'Other'
      ) AS heading
    FROM "FormResponse" fr
    WHERE fr.id IN (${Prisma.join(ids)})
    ORDER BY fr."createdAt" DESC
  `;

  return rows.map((row) => ({
    title: row.heading || "Other",
    subtitle: new Date(row.createdAt).toLocaleDateString("en-GB"),
    status: "Submitted",
    category: row.category || "General",
    id: row.id,
  }));
}

function buildReportsTimeline(monthlyRows) {
  const byMonth = {};

  for (const row of monthlyRows) {
    const year = row.year;
    const month = row.month;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + (row.count || 0);
  }

  const monthlySubmissions = Object.entries(byMonth)
    .map(([monthKey, count]) => {
      const [yearStr, monthStr] = monthKey.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const dt = new Date(year, month - 1, 1);
      return {
        year,
        month,
        monthKey,
        name: dt.toLocaleString("en-GB", { month: "short" }),
        fullName: dt.toLocaleString("en-GB", { month: "long", year: "numeric" }),
        count,
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearsFromData = [...new Set(monthlySubmissions.map((m) => m.year))];
  const availableYears = [...new Set([currentYear, ...yearsFromData])].sort((a, b) => b - a);

  const latestMonth =
    monthlySubmissions.length > 0
      ? monthlySubmissions[monthlySubmissions.length - 1]
      : null;

  const areaChartData = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const match = monthlySubmissions.find((m) => m.monthKey === monthKey);
    areaChartData.push({
      name: dt.toLocaleString("en-GB", { month: "short" }),
      fullName: dt.toLocaleString("en-GB", { month: "long", year: "numeric" }),
      monthKey,
      completed: match?.count || 0,
    });
  }

  return { monthlySubmissions, availableYears, latestMonth, areaChartData };
}

function buildSectionResponseWhere(sectionKey, baseWhere) {
  const section = getMonitoringSection(sectionKey);
  if (!section) return { id: { in: [] } };

  const categoryClauses = [
    { category: section.category },
    { answers: { path: ["monitoringSection"], equals: sectionKey } },
  ];

  for (const cat of section.concernCategories || []) {
    categoryClauses.push({ category: cat });
  }
  for (const cat of section.sheqCategories || []) {
    categoryClauses.push({ category: cat });
  }

  return {
    AND: [baseWhere, { OR: categoryClauses }],
  };
}

function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

exports.getSectionDashboardStats = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!actor?.id) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const sectionKey = String(req.params.section || "").trim();
  const section = getMonitoringSection(sectionKey);
  if (!section) {
    return res.status(400).json({ success: false, message: "Invalid monitoring section" });
  }

  const actingClient = req.actingClient || null;
  const actingClientId = actingClient?.id || null;

  const cacheKey = dashboardCacheKey(`section:${sectionKey}`, actor, actingClientId);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const scope = getDashboardScopeMeta(actor, actingClient);
  const siteWhere = buildSiteListWhere(actor, actingClientId);
  const baseResponseWhere = await buildDashboardResponseWhere(prisma, actor, actingClientId);
  const sectionResponseWhere = buildSectionResponseWhere(sectionKey, baseResponseWhere);

  const monthStart = startOfCurrentMonth();
  const clientId =
    actingClientId ||
    (actor.role === "company_admin" ? actor.clientId : null) ||
    (isGlobalSiteAccess(actor) ? null : actor.clientId);

  const nonconWhere = clientId ? { clientId } : {};

  try {
    const [
      totalSites,
      totalFormsCompleted,
      formsThisMonth,
      sheqForms,
      concernReports,
      categoryGroups,
      monthlyCounts,
      recentRows,
      totalNonconformances,
      pendingNonconformances,
      sentNonconformances,
      myOpenActions,
    ] = await Promise.all([
      prisma.site.count({ where: siteWhere }),
      prisma.formResponse.count({ where: sectionResponseWhere }),
      prisma.formResponse.count({
        where: { AND: [sectionResponseWhere, { createdAt: { gte: monthStart } }] },
      }),
      section.sheqCategories?.length
        ? prisma.formResponse.count({
            where: {
              AND: [
                baseResponseWhere,
                { category: { in: section.sheqCategories } },
              ],
            },
          })
        : Promise.resolve(0),
      section.concernCategories?.length
        ? prisma.formResponse.count({
            where: {
              AND: [
                baseResponseWhere,
                { category: { in: section.concernCategories } },
              ],
            },
          })
        : Promise.resolve(0),
      prisma.formResponse.groupBy({
        by: ["category"],
        where: sectionResponseWhere,
        _count: { _all: true },
      }),
      fetchMonthlySubmissionCounts(prisma, sectionResponseWhere),
      fetchSlimRecentActions(prisma, sectionResponseWhere, 6),
      prisma.nonconformanceAction.count({ where: nonconWhere }),
      prisma.nonconformanceAction.count({
        where: { ...nonconWhere, status: { in: ["pending", "draft"] } },
      }),
      prisma.nonconformanceAction.count({
        where: { ...nonconWhere, status: "sent" },
      }),
      prisma.nonconformanceAction.count({
        where: {
          ...nonconWhere,
          assigneeId: actor.id,
          status: { in: ["pending", "draft"] },
        },
      }),
    ]);

    const categories = {};
    for (const row of categoryGroups) {
      categories[row.category || "Other"] = row._count._all;
    }

    const reportsTimeline = buildReportsTimeline(monthlyCounts);

    const barChartData = Object.keys(categories)
      .map((cat) => ({
        name: cat.length > 22 ? `${cat.substring(0, 22)}…` : cat,
        fullName: cat,
        value: categories[cat],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const recentSubmissions = recentRows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category || "General",
      date: row.subtitle,
    }));

    const sectionPayload = {
      success: true,
      section: sectionKey,
      sectionTitle: section.title,
      scope,
      stats: {
        totalSites,
        totalFormsCompleted,
        formsThisMonth,
        sheqForms,
        concernReports,
        totalNonconformances,
        pendingNonconformances,
        sentNonconformances,
        myOpenActions,
      },
      charts: {
        areaChartData: reportsTimeline.areaChartData,
        barChartData,
        monthlySubmissions: reportsTimeline.monthlySubmissions,
        availableYears: reportsTimeline.availableYears,
      },
      recentSubmissions,
    };

    await cacheSet(cacheKey, sectionPayload, DASHBOARD_CACHE_TTL);
    res.json(sectionPayload);
  } catch (err) {
    console.error("Section dashboard stats error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!actor?.id) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const actingClient = req.actingClient || null;
  const actingClientId = actingClient?.id || null;

  const cacheKey = dashboardCacheKey("main", actor, actingClientId);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const scope = getDashboardScopeMeta(actor, actingClient);
  const siteWhere = buildSiteListWhere(actor, actingClientId);
  const responseWhere = await buildDashboardResponseWhere(prisma, actor, actingClientId);

  try {
    const sheqResponseWhere = {
      AND: [responseWhere, { category: { in: SHEQ_CATEGORIES } }],
    };

    const ncClientId =
      actingClientId ||
      (actor.role === "company_admin" ? actor.clientId : null);
    const canCountAllNc = isGlobalSiteAccess(actor) && !ncClientId;

    const [
      totalSites,
      totalReports,
      sheqForms,
      monthlyCounts,
      categoryGroups,
      recentActions,
      sheqResponses,
      formsByCompany,
      totalNonconformances,
      pendingNonconformances,
    ] = await Promise.all([
      prisma.site.count({ where: siteWhere }),
      prisma.formResponse.count({ where: responseWhere }),
      prisma.formResponse.count({ where: sheqResponseWhere }),
      fetchMonthlySubmissionCounts(prisma, responseWhere),
      prisma.formResponse.groupBy({
        by: ["category"],
        where: responseWhere,
        _count: { _all: true },
      }),
      fetchSlimRecentActions(prisma, responseWhere, RECENT_ACTIONS_LIMIT),
      fetchSlimSheqRows(prisma, sheqResponseWhere, SHEQ_LIST_LIMIT),
      isGlobalSiteAccess(actor, actingClientId)
        ? buildFormsByCompany(prisma, { limit: 40 })
        : Promise.resolve([]),
      ncClientId
        ? prisma.nonconformanceAction.count({ where: { clientId: ncClientId } })
        : canCountAllNc
          ? prisma.nonconformanceAction.count()
          : actor.clientId
            ? prisma.nonconformanceAction.count({ where: { clientId: actor.clientId } })
            : Promise.resolve(0),
      ncClientId
        ? prisma.nonconformanceAction.count({
            where: { clientId: ncClientId, status: { in: ["pending", "draft"] } },
          })
        : canCountAllNc
          ? prisma.nonconformanceAction.count({
              where: { status: { in: ["pending", "draft"] } },
            })
          : actor.clientId
            ? prisma.nonconformanceAction.count({
                where: { clientId: actor.clientId, status: { in: ["pending", "draft"] } },
              })
            : Promise.resolve(0),
    ]);

    const sheq = buildSheqDashboardData(sheqResponses);
    const reportsTimeline = buildReportsTimeline(monthlyCounts);

    const categories = {};
    for (const row of categoryGroups) {
      const cat = row.category || "Other";
      categories[cat] = row._count._all;
    }

    const barChartData = Object.keys(categories)
      .map((cat) => ({
        name: cat.length > 22 ? `${cat.substring(0, 22)}…` : cat,
        fullName: cat,
        value: categories[cat],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const reportConcerns = countGroupedCategories(categories, [
      "Health & Safety concern",
      "Sustainability concern",
      "Quality concern",
      "Positive observation",
    ]);
    const inspectionForms = countGroupedCategories(categories, [
      "Weekly supervisor health & safety inspection",
      "Weekly supervisor reports",
    ]);

    const mainPayload = {
      success: true,
      scope,
      formsByCompany,
      stats: {
        totalSites,
        totalReports,
        reportConcerns,
        inspectionForms,
        sheqForms,
        totalNonconformances,
        pendingNonconformances,
      },
      charts: {
        areaChartData: reportsTimeline.areaChartData,
        monthlySubmissions: reportsTimeline.monthlySubmissions,
        availableYears: reportsTimeline.availableYears,
        latestMonth: reportsTimeline.latestMonth,
        barChartData,
        pieChartData: [],
      },
      sheq,
      recentActions,
    };

    await cacheSet(cacheKey, mainPayload, DASHBOARD_CACHE_TTL);
    res.json(mainPayload);
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
