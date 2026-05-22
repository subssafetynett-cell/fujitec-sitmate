const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");
const { reqUserDbId } = require("../utils/userAuthorization");
const {
  buildDashboardResponseWhere,
  buildDashboardUserCountWhere,
  buildSiteListWhere,
  getDashboardScopeMeta,
  buildFormsByCompany,
} = require("../utils/dashboardAccess");
const { isGlobalSiteAccess } = require("../utils/siteAccess");

function countCategory(categories, matchers) {
  return Object.entries(categories).reduce((sum, [name, count]) => {
    const key = String(name).toLowerCase();
    if (matchers.some((m) => key.includes(m))) return sum + count;
    return sum;
  }, 0);
}

const SHEQ_CATEGORIES = ["SHEQ Installation", "SHEQ Inspection"];
const DASHBOARD_RECENT_LIMIT = 300;
const SHEQ_RECENT_LIMIT = 300;

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

function buildSheqDashboardData(responses) {
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
      forms: row.forms.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
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

function buildReportsTimeline(createdAtRows) {
  const byMonth = {};

  for (const row of createdAtRows) {
    const d = new Date(row.createdAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
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

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const actorId = reqUserDbId(req);
  if (!actorId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      role: true,
      clientId: true,
      companyname: true,
      firstName: true,
    },
  });

  if (!actor) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const actingClient = req.actingClient || null;
  const actingClientId = actingClient?.id || null;
  const scope = getDashboardScopeMeta(actor, actingClient);
  const siteWhere = buildSiteListWhere(actor, actingClientId);
  const userCountWhere = buildDashboardUserCountWhere(actor, actingClientId);
  const responseWhere = await buildDashboardResponseWhere(prisma, actor, actingClientId);

  try {
    const sheqResponseWhere = {
      AND: [responseWhere, { category: { in: SHEQ_CATEGORIES } }],
    };

    const [totalSites, totalUsers, totalReports, submissionDates, allResponses, sheqResponses, formsByCompany] =
      await Promise.all([
      prisma.site.count({ where: siteWhere }),
      userCountWhere != null
        ? prisma.user.count({ where: userCountWhere })
        : Promise.resolve(null),
      prisma.formResponse.count({ where: responseWhere }),
      prisma.formResponse.findMany({
        where: responseWhere,
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.formResponse.findMany({
        where: responseWhere,
        select: {
          id: true,
          category: true,
          createdAt: true,
          answers: true,
          form: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: DASHBOARD_RECENT_LIMIT,
      }),
      prisma.formResponse.findMany({
        where: sheqResponseWhere,
        select: {
          id: true,
          category: true,
          createdAt: true,
          answers: true,
          submittedById: true,
          form: { select: { title: true } },
          submittedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: SHEQ_RECENT_LIMIT,
      }),
      isGlobalSiteAccess(actor, actingClientId)
        ? buildFormsByCompany(prisma)
        : Promise.resolve([]),
    ]);

    const sheq = buildSheqDashboardData(sheqResponses);
    const reportsTimeline = buildReportsTimeline(submissionDates);

    const categories = {};
    const inspectionScores = [];
    const recentActions = [];

    allResponses.forEach((resp) => {
      const cat = resp.category || resp.form?.title || "Other";
      categories[cat] = (categories[cat] || 0) + 1;

      const d = new Date(resp.createdAt);
      const answers = resp.answers && typeof resp.answers === "object" ? resp.answers : {};
      const catLower = String(cat).toLowerCase();

      if (catLower.includes("weekly supervisor") || catLower.includes("inspection")) {
        const siteRating = parseFloat(answers.siteRating);
        if (!Number.isNaN(siteRating) && siteRating > 0) {
          inspectionScores.push(siteRating);
        }
      }

      if (recentActions.length < 8) {
        const heading =
          (answers.report_heading && String(answers.report_heading).trim()) ||
          (answers.reportHeading && String(answers.reportHeading).trim()) ||
          cat;
        recentActions.push({
          title: heading,
          subtitle: d.toLocaleDateString("en-GB"),
          status: "Submitted",
          id: resp.id,
        });
      }
    });

    const avgCompliance =
      inspectionScores.length > 0
        ? (inspectionScores.reduce((a, b) => a + b, 0) / inspectionScores.length).toFixed(1)
        : "0";

    const barChartData = Object.keys(categories)
      .map((cat) => ({
        name: cat.length > 22 ? `${cat.substring(0, 22)}…` : cat,
        fullName: cat,
        value: categories[cat],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const hsConcerns = countCategory(categories, ["health", "safety"]);
    const envConcerns = countCategory(categories, ["sustainability", "environment"]);
    const qualityConcerns = countCategory(categories, ["quality"]);
    const positiveObs = countCategory(categories, ["positive"]);

    res.json({
      success: true,
      scope,
      formsByCompany,
      stats: {
        totalSites,
        totalUsers: totalUsers ?? undefined,
        totalReports,
        hsConcerns,
        envConcerns,
        qualityConcerns,
        positiveObs,
        complianceRate: `${avgCompliance}%`,
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
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
