const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");
const { reqUserDbId } = require("../utils/userAuthorization");
const {
  formatUserName,
  notifyAssigneeOfRejectedAction,
  notifyReporterOfSentAction,
  buildNonconformanceGroupKey,
} = require("../services/nonconformanceActionService");

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
};

function serializeAction(row, userId) {
  if (!row) return null;
  const isAssignee = userId && String(row.assigneeId) === String(userId);
  const isReporter = userId && String(row.reporterId) === String(userId);
  return {
    id: row.id,
    formResponseId: row.formResponseId,
    groupKey: row.groupKey,
    status: row.status,
    registerStatus: row.registerStatus || "open",
    title: row.title,
    correctionAction: row.correctionAction,
    responsibleEmail: row.responsibleEmail,
    responsibleName: row.responsibleName,
    dateCompleted: row.dateCompleted,
    details: row.details || {},
    responseNotes: row.responseNotes,
    draftData: row.draftData,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    userRole: isAssignee ? "assignee" : isReporter ? "reporter" : null,
    isAssignee,
    isReporter,
    reporter: row.reporter
      ? {
          id: row.reporter.id,
          name: formatUserName(row.reporter),
          email: row.reporter.email,
        }
      : null,
    assignee: row.assignee
      ? {
          id: row.assignee.id,
          name: formatUserName(row.assignee),
          email: row.assignee.email,
        }
      : null,
  };
}

async function syncLinkedFormResponse(action, responseStatus, extraAnswers = {}) {
  if (!action?.formResponseId) return;

  const response = await prisma.formResponse.findUnique({
    where: { id: action.formResponseId },
    select: { id: true, answers: true },
  });
  if (!response) return;

  const details =
    action.details && typeof action.details === "object" ? action.details : {};
  const responseFields = [
    "noncon_response_correction",
    "noncon_response_correction_evidence",
    "noncon_response_correction_evidence_name",
    "noncon_response_correction_evidence_description",
    "noncon_response_root_cause",
    "noncon_response_root_cause_evidence",
    "noncon_response_root_cause_evidence_name",
    "noncon_response_root_cause_evidence_description",
    "noncon_response_corrective_action",
    "noncon_response_corrective_action_evidence",
    "noncon_response_corrective_action_evidence_name",
    "noncon_response_corrective_action_evidence_description",
    "noncon_response_decision",
    "noncon_rejection_reason",
  ];
  const answers = {
    ...(response.answers && typeof response.answers === "object"
      ? response.answers
      : {}),
    noncon_response_status: responseStatus,
    ...extraAnswers,
  };

  for (const key of responseFields) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      answers[key] = details[key];
    }
  }

  await prisma.formResponse.update({
    where: { id: response.id },
    data: { answers },
  });
}

function resolveGroupKey(row) {
  if (row.groupKey) return row.groupKey;
  const d = row.details || {};
  return buildNonconformanceGroupKey(row.reporterId, d);
}

async function fetchRelatedActions(row, userId) {
  const groupKey = resolveGroupKey(row);
  if (!groupKey) return [row];

  const rows = await prisma.nonconformanceAction.findMany({
    where: {
      groupKey,
      OR: [{ assigneeId: userId }, { reporterId: userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  if (rows.length > 0) return rows;

  // Legacy rows without groupKey persisted — match by computed key
  const mine = await prisma.nonconformanceAction.findMany({
    where: { OR: [{ assigneeId: userId }, { reporterId: userId }] },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  return mine.filter((a) => resolveGroupKey(a) === groupKey);
}

exports.listMyActions = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const rows = await prisma.nonconformanceAction.findMany({
    where: {
      OR: [{ assigneeId: userId }, { reporterId: userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = resolveGroupKey(row) || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  res.json({ success: true, data: deduped.map((row) => serializeAction(row, userId)) });
});

exports.getActionByFormResponse = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const row = await prisma.nonconformanceAction.findFirst({
    where: {
      formResponseId: req.params.formResponseId,
      OR: [{ assigneeId: userId }, { reporterId: userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  if (!row) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }

  res.json({ success: true, data: serializeAction(row, userId) });
});

exports.getAction = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const row = await prisma.nonconformanceAction.findFirst({
    where: {
      id: req.params.id,
      OR: [{ assigneeId: userId }, { reporterId: userId }],
    },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  if (!row) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }

  const relatedRows = await fetchRelatedActions(row, userId);
  const relatedActions = relatedRows.map((r) => serializeAction(r, userId));
  const latestAction = relatedActions[0] || serializeAction(row, userId);

  res.json({
    success: true,
    data: serializeAction(row, userId),
    relatedActions,
    latestAction,
  });
});

exports.updateAction = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const existing = await prisma.nonconformanceAction.findFirst({
    where: { id: req.params.id, assigneeId: userId },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }
  if (existing.status === "sent") {
    return res.status(400).json({ success: false, message: "This response has already been sent." });
  }

  const asDraft = req.body?.asDraft === true;
  const responseNotes =
    req.body?.responseNotes != null ? String(req.body.responseNotes) : existing.responseNotes;

  const data = {
    responseNotes,
  };

  if (asDraft) {
    data.status = "draft";
  }

  if (req.body?.correctionAction != null) {
    data.correctionAction = String(req.body.correctionAction);
  }
  if (req.body?.dateCompleted != null) {
    data.dateCompleted = String(req.body.dateCompleted);
  }
  if (req.body?.details && typeof req.body.details === "object") {
    const merged = {
      ...(existing.details && typeof existing.details === "object" ? existing.details : {}),
      ...req.body.details,
    };
    if (data.correctionAction != null) {
      merged.noncon_action = data.correctionAction;
    }
    if (data.dateCompleted != null) {
      merged.noncon_date = data.dateCompleted;
    }
    data.details = merged;
  }

  const updated = await prisma.nonconformanceAction.update({
    where: { id: existing.id },
    data,
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  // Drafts remain private to the assignee. Only non-draft updates are copied
  // into the linked report for the reporter to view.
  if (!asDraft) {
    await syncLinkedFormResponse(updated, updated.status);
  }

  res.json({
    success: true,
    message: asDraft ? "Draft saved." : "Updated.",
    data: serializeAction(updated, userId),
  });
});

exports.sendActionToReporter = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const existing = await prisma.nonconformanceAction.findFirst({
    where: { id: req.params.id, assigneeId: userId },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }

  const responseNotes =
    req.body?.responseNotes != null
      ? String(req.body.responseNotes)
      : existing.responseNotes || "";

  const updateData = {
    responseNotes,
    status: "sent",
    sentAt: new Date(),
    draftData: null,
  };

  if (req.body?.correctionAction != null) {
    updateData.correctionAction = String(req.body.correctionAction);
  }
  if (req.body?.dateCompleted != null) {
    updateData.dateCompleted = String(req.body.dateCompleted);
  }
  if (req.body?.details && typeof req.body.details === "object") {
    updateData.details = {
      ...(existing.details && typeof existing.details === "object" ? existing.details : {}),
      ...req.body.details,
      noncon_rejection_reason: "",
      noncon_response_decision: "pending",
    };
  } else {
    updateData.details = {
      ...(existing.details && typeof existing.details === "object" ? existing.details : {}),
      noncon_rejection_reason: "",
      noncon_response_decision: "pending",
    };
  }

  const updated = await prisma.nonconformanceAction.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  await syncLinkedFormResponse(updated, "sent");

  await notifyReporterOfSentAction(
    updated,
    updated.assignee,
    updated.reporter,
    responseNotes
  );

  res.json({
    success: true,
    message: "Response sent to the reporter.",
    data: serializeAction(updated, userId),
  });
});

exports.reviewSentAction = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const decision = String(req.body?.decision || "").trim().toLowerCase();
  if (!["accept", "reject"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "decision must be accept or reject",
    });
  }

  const rejectionReason = String(req.body?.rejectionReason || "").trim();
  if (decision === "reject" && !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason is required.",
    });
  }

  const existing = await prisma.nonconformanceAction.findFirst({
    where: { id: req.params.id, reporterId: userId },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }
  if (existing.status !== "sent") {
    return res.status(400).json({
      success: false,
      message: "Only a sent response can be reviewed.",
    });
  }

  const details = {
    ...(existing.details && typeof existing.details === "object"
      ? existing.details
      : {}),
    noncon_response_decision: decision === "accept" ? "accepted" : "rejected",
    noncon_rejection_reason: decision === "reject" ? rejectionReason : "",
  };
  const updated = await prisma.nonconformanceAction.update({
    where: { id: existing.id },
    data:
      decision === "accept"
        ? { registerStatus: "closed", details }
        : {
            registerStatus: "open",
            status: "draft",
            sentAt: null,
            details,
          },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  await syncLinkedFormResponse(updated, "sent", {
    noncon_status: decision === "accept" ? "closed" : "open",
    noncon_response_decision:
      decision === "accept" ? "accepted" : "rejected",
    noncon_rejection_reason: decision === "reject" ? rejectionReason : "",
  });

  if (decision === "reject") {
    await notifyAssigneeOfRejectedAction(
      updated,
      updated.assignee,
      updated.reporter,
      rejectionReason
    );
  }

  res.json({
    success: true,
    message:
      decision === "accept"
        ? "Response accepted and nonconformance closed."
        : "Response rejected and nonconformance reopened.",
    data: serializeAction(updated, userId),
  });
});

const REGISTER_STATUSES = new Set(["open", "closed", "accepted", "rejected"]);

exports.updateRegisterStatus = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const registerStatus = String(req.body?.registerStatus || "").toLowerCase();
  if (!REGISTER_STATUSES.has(registerStatus)) {
    return res.status(400).json({
      success: false,
      message: "registerStatus must be one of: open, closed, accepted, rejected",
    });
  }

  const existing = await prisma.nonconformanceAction.findFirst({
    where: {
      id: req.params.id,
      OR: [{ assigneeId: userId }, { reporterId: userId }],
    },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Action not found" });
  }

  const updated = await prisma.nonconformanceAction.update({
    where: { id: existing.id },
    data: { registerStatus },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
    },
  });

  res.json({
    success: true,
    message: `Status updated to ${registerStatus}.`,
    data: serializeAction(updated, userId),
  });
});
