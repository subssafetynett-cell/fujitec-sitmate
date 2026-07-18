const crypto = require("node:crypto");
const prisma = require("../prismaClient");
const { sendEmail } = require("./emailService");
const { buildAppUrl } = require("../utils/appBaseUrl");
const { escapeHtml } = require("../utils/htmlEscape");

function formatUserName(user) {
  if (!user) return "A user";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "A user";
}

function buildNonconformanceGroupKey(reporterId, answers = {}) {
  const parts = [
    String(reporterId || ""),
    String(answers.project_name || "").trim().toLowerCase(),
    String(answers.customer_reference || "").trim().toLowerCase(),
    String(answers.observation_details || "").trim().slice(0, 300).toLowerCase(),
    String(answers.full_address || "").trim().toLowerCase(),
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

function snapshotConcernAnswers(answers = {}) {
  const copy = { ...answers };
  delete copy.form_schema;
  delete copy.password;
  return copy;
}

function buildNonconformancePayload(answers = {}, formResponseId, reporterId, clientId) {
  const assigneeId = answers.noncon_responsible_user_id;
  if (!assigneeId || !reporterId || !clientId) return null;

  const correctionAction = String(answers.noncon_action || "").trim();
  const responsibleName = String(answers.noncon_responsible || "").trim();
  if (!correctionAction && !responsibleName) return null;

  if (String(assigneeId) === String(reporterId)) return null;

  const groupKey = buildNonconformanceGroupKey(reporterId, answers);
  const snapshot = snapshotConcernAnswers(answers);

  return {
    formResponseId: formResponseId || null,
    assigneeId: String(assigneeId),
    reporterId: String(reporterId),
    clientId: String(clientId),
    groupKey,
    title:
      String(answers.report_heading || "").trim() ||
      String(answers.project_name || "").trim() ||
      "Nonconformance report",
    correctionAction,
    responsibleEmail: answers.noncon_responsible_email || null,
    responsibleName: responsibleName || null,
    dateCompleted: answers.noncon_date || null,
    details: {
      ...snapshot,
      noncon_action: answers.noncon_action || "",
      noncon_responsible: answers.noncon_responsible || "",
      noncon_responsible_email: answers.noncon_responsible_email || "",
      noncon_date: answers.noncon_date || "",
      project_name: answers.project_name || "",
      customer_name: answers.customer_name || "",
      customer_reference: answers.customer_reference || "",
      observation_details: answers.observation_details || "",
      full_address: answers.full_address || "",
      exact_location: answers.exact_location || "",
      corrective_action: answers.corrective_action || "",
      incidents: Array.isArray(answers.incidents) ? answers.incidents : [],
      incidents_other: answers.incidents_other || "",
    },
  };
}

async function createNonconformanceFromFormSubmission({
  answers,
  formResponseId,
  submitterId,
}) {
  const submitter = await prisma.user.findUnique({
    where: { id: submitterId },
    select: { id: true, clientId: true, firstName: true, lastName: true, email: true },
  });
  if (!submitter?.clientId) return null;

  const payload = buildNonconformancePayload(
    answers,
    formResponseId,
    submitter.id,
    submitter.clientId
  );
  if (!payload) return null;

  // Safe to call again on report edits: notify only on first assignment.
  if (formResponseId) {
    const existing = await prisma.nonconformanceAction.findFirst({
      where: { formResponseId, assigneeId: payload.assigneeId },
      select: { id: true },
    });
    if (existing) return null;
  }

  const assignee = await prisma.user.findFirst({
    where: { id: payload.assigneeId, clientId: submitter.clientId, active: true },
    select: { id: true, email: true, firstName: true, lastName: true, accessMode: true },
  });
  if (!assignee) return null;
  if (String(assignee.accessMode || "standard").toLowerCase() === "view_only") {
    return null;
  }

  const action = await prisma.nonconformanceAction.create({
    data: {
      ...payload,
      status: "pending",
    },
  });

  const reporterName = formatUserName(submitter);
  await prisma.userNotification.create({
    data: {
      userId: assignee.id,
      type: "nonconformance_reported",
      title: "New nonconformance reported",
      message: `New nonconformance reported by ${reporterName}`,
      link: `/nonconformance?item=${action.id}`,
      metadata: {
        actionId: action.id,
        reporterId: submitter.id,
        reporterName,
      },
    },
  });

  if (assignee.email) {
    const correction = String(answers?.noncon_action || "").trim();
    const observation = String(answers?.observation_details || "").trim();
    const subject = `Nonconformance raised: ${action.title}`;
    const html = `
      <p>Hello ${escapeHtml(formatUserName(assignee))},</p>
      <p><strong>${escapeHtml(reporterName)}</strong> has raised a nonconformance and assigned you as the responsible person.</p>
      <p><strong>Report:</strong> ${escapeHtml(action.title)}</p>
      ${observation ? `<p><strong>Observation:</strong></p><p>${escapeHtml(observation)}</p>` : ""}
      ${correction ? `<p><strong>Required correction:</strong></p><p>${escapeHtml(correction)}</p>` : ""}
      <p><a href="${escapeHtml(buildAppUrl(`/nonconformance?item=${action.id}`))}">View and respond to the nonconformance</a></p>
    `;

    await sendEmail({
      to: assignee.email,
      subject,
      html,
    }).catch((err) => {
      console.error("Nonconformance assignment email failed:", err);
    });
  }

  return action;
}

async function notifyReporterOfSentAction(action, assignee, reporter, notes) {
  const assigneeName = formatUserName(assignee);
  await prisma.userNotification.create({
    data: {
      userId: reporter.id,
      type: "nonconformance_response",
      title: "Nonconformance response received",
      message: `${assigneeName} sent a response to your nonconformance report`,
      link: `/nonconformance?item=${action.id}`,
      metadata: { actionId: action.id, assigneeId: assignee.id },
    },
  });

  if (!reporter.email) return;

  const subject = `Nonconformance response: ${action.title}`;
  const html = `
    <p>Hello ${escapeHtml(formatUserName(reporter))},</p>
    <p><strong>${escapeHtml(assigneeName)}</strong> has sent a response to the nonconformance you reported.</p>
    <p><strong>Report:</strong> ${escapeHtml(action.title)}</p>
    <p><strong>Response:</strong></p>
    <p>${escapeHtml(notes || "No additional notes provided.")}</p>
    <p><a href="${escapeHtml(buildAppUrl(`/nonconformance?item=${action.id}`))}">View in Nonconformance</a></p>
  `;

  await sendEmail({
    to: reporter.email,
    subject,
    html,
  }).catch((err) => {
    console.error("Nonconformance response email failed:", err);
  });
}

async function notifyAssigneeOfRejectedAction(action, assignee, reporter, reason) {
  const reporterName = formatUserName(reporter);
  await prisma.userNotification.create({
    data: {
      userId: assignee.id,
      type: "nonconformance_rejected",
      title: "Nonconformance response rejected",
      message: `${reporterName} rejected your response and reopened the nonconformance`,
      link: `/nonconformance?item=${action.id}`,
      metadata: {
        actionId: action.id,
        reporterId: reporter.id,
        rejectionReason: reason,
      },
    },
  });

  if (!assignee.email) return;

  const subject = `Nonconformance reopened: ${action.title}`;
  const html = `
    <p>Hello ${escapeHtml(formatUserName(assignee))},</p>
    <p><strong>${escapeHtml(reporterName)}</strong> rejected your nonconformance response and reopened the item.</p>
    <p><strong>Report:</strong> ${escapeHtml(action.title)}</p>
    <p><strong>Reason for rejection:</strong></p>
    <p>${escapeHtml(reason)}</p>
    <p><a href="${escapeHtml(buildAppUrl(`/nonconformance?item=${action.id}`))}">Review and update the response</a></p>
  `;

  await sendEmail({
    to: assignee.email,
    subject,
    html,
  }).catch((err) => {
    console.error("Nonconformance rejection email failed:", err);
  });
}

module.exports = {
  buildNonconformanceGroupKey,
  buildNonconformancePayload,
  createNonconformanceFromFormSubmission,
  formatUserName,
  notifyAssigneeOfRejectedAction,
  notifyReporterOfSentAction,
};
