const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");
const { getScopedUser } = require("../utils/actingClientScope");

const VALID_SECTIONS = new Set([
  "ohs",
  "environmental",
  "quality",
  "food-safety",
  "lift",
]);

function resolveClientId(req) {
  const scoped = getScopedUser(req);
  const raw = scoped?.clientId || null;
  if (raw == null) return null;
  if (typeof raw === "object") {
    const nested = raw.id || raw._id;
    return nested != null ? String(nested) : null;
  }
  const id = String(raw).trim();
  return id && id !== "[object Object]" ? id : null;
}

function invalidSectionResponse(res) {
  return res.status(400).json({ success: false, message: "Invalid KPI section." });
}

function missingClientResponse(res) {
  return res.status(400).json({
    success: false,
    message: "Organisation scope is required to load or save KPI dashboards.",
  });
}

exports.getKpiDashboard = asyncHandler(async (req, res) => {
  const section = String(req.params.section || "").trim();
  if (!VALID_SECTIONS.has(section)) return invalidSectionResponse(res);

  const clientId = resolveClientId(req);
  if (!clientId) return missingClientResponse(res);

  const row = await prisma.kpiDashboard.findUnique({
    where: {
      clientId_section: { clientId, section },
    },
    select: {
      payload: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    dashboard: row
      ? {
          payload: row.payload,
          updatedAt: row.updatedAt,
        }
      : null,
  });
});

exports.saveKpiDashboard = asyncHandler(async (req, res) => {
  const section = String(req.params.section || "").trim();
  if (!VALID_SECTIONS.has(section)) return invalidSectionResponse(res);

  const clientId = resolveClientId(req);
  if (!clientId) return missingClientResponse(res);

  const { payload } = req.body ?? {};
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({
      success: false,
      message: "payload must be an object",
    });
  }

  const row = await prisma.kpiDashboard.upsert({
    where: {
      clientId_section: { clientId, section },
    },
    create: {
      clientId,
      section,
      payload,
      updatedById: req.user?.id || null,
    },
    update: {
      payload,
      updatedById: req.user?.id || null,
    },
    select: {
      payload: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    dashboard: {
      payload: row.payload,
      updatedAt: row.updatedAt,
    },
  });
});
