import { randomUUID } from "node:crypto";
import { readBlob, writeBlob } from "../db/blob-store.js";
import type { User } from "./sheq.js";
import { listTemplates } from "./templates-store.js";
import { listUsers as listUsersFromStore } from "./users-store.js";
import {
  createNotification,
  createNotificationsForUsers,
} from "./notifications-store.js";

export type NcStatus =
  | "Pending Admin Approval"
  | "Rejected"
  | "Assigned"
  | "Draft"
  | "In Progress"
  | "Pending Admin Review"
  | "Reopened"
  | "Closed";

export type NcPriority = "Low" | "Medium" | "High" | "Critical";

export type NcEvidence = {
  name: string;
  url: string;
  mimeType?: string;
};

export type NcTimelineEntry = {
  id: string;
  action: string;
  userId: string;
  userName: string;
  role: string;
  comments?: string;
  createdAt: string;
};

export type NcResponse = {
  correction: string;
  rootCause: string;
  correctiveAction: string;
  evidence: NcEvidence[];
  updatedAt: string;
};

export type NonConformanceRecord = {
  id: string;
  title: string;
  description: string;
  company: string;
  site: string;
  department: string;
  auditRef: string;
  priority: NcPriority;
  status: NcStatus;
  /** Alias for legacy UI that used `stage`. */
  stage: NcStatus;
  reporterId: string;
  reporterName: string;
  responsiblePersonId: string;
  responsiblePersonName: string;
  dueDate: string;
  raised: string;
  createdAt: string;
  createdBy: string;
  rejectionReason: string;
  adminReviewComments: string;
  evidence: NcEvidence[];
  formData?: Record<string, string>;
  templateId?: string;
  templateName?: string;
  kind?: string;
  response?: NcResponse;
  timeline: NcTimelineEntry[];
  closedAt?: string;
  /** Legacy chart fields */
  owner: string;
  severity: NcPriority;
  source: string;
};

export const NC_STATUSES: NcStatus[] = [
  "Pending Admin Approval",
  "Rejected",
  "Assigned",
  "Draft",
  "In Progress",
  "Pending Admin Review",
  "Reopened",
  "Closed",
];

export const NC_WORKFLOW = [
  "Raise Nonconformance",
  "Pending Admin Approval",
  "Admin Approve / Reject",
  "Assigned to Responsible Person",
  "Draft / Submit Response",
  "Pending Admin Review",
  "Close or Reopen",
];

type Store = {
  version: 1;
  items: NonConformanceRecord[];
};

const BLOB_KEY = "nonconformances";
const CONCERN_KINDS = new Set([
  "ohs-concern",
  "quality-concern",
  "good-practice",
  "sustainability-concern",
]);

type Actor = {
  id: string;
  name: string;
  role: string;
  company: string;
  email?: string;
};

function sameCompany(a?: string, b?: string) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function normalizePriority(raw: unknown): NcPriority {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "low") return "Low";
  if (v === "high") return "High";
  if (v === "critical") return "Critical";
  return "Medium";
}

function timelineEntry(
  actor: Actor,
  action: string,
  comments?: string,
): NcTimelineEntry {
  return {
    id: `TL-${randomUUID().slice(0, 8)}`,
    action,
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    comments: comments?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

function nextId(existing: NonConformanceRecord[]): string {
  let max = 3100;
  for (const item of existing) {
    const m = /^NC-(\d+)$/.exec(item.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `NC-${max + 1}`;
}

function normalize(raw: Partial<NonConformanceRecord> & { id: string }): NonConformanceRecord {
  const status = (NC_STATUSES.includes(raw.status as NcStatus)
    ? raw.status
    : NC_STATUSES.includes(raw.stage as NcStatus)
      ? raw.stage
      : "Pending Admin Approval") as NcStatus;
  const priority = normalizePriority(raw.priority ?? raw.severity);
  return {
    id: raw.id,
    title: String(raw.title ?? "Untitled nonconformance").trim(),
    description: String(raw.description ?? "").trim(),
    company: String(raw.company ?? "").trim(),
    site: String(raw.site ?? "—").trim() || "—",
    department: String(raw.department ?? "—").trim() || "—",
    auditRef: String(raw.auditRef ?? "").trim(),
    priority,
    status,
    stage: status,
    reporterId: String(raw.reporterId ?? "").trim(),
    reporterName: String(raw.reporterName ?? "Reporter").trim(),
    responsiblePersonId: String(raw.responsiblePersonId ?? "").trim(),
    responsiblePersonName: String(
      raw.responsiblePersonName ?? raw.owner ?? "Unassigned",
    ).trim(),
    dueDate: String(raw.dueDate ?? "").slice(0, 10),
    raised: String(raw.raised ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    createdBy: String(raw.createdBy ?? raw.reporterName ?? "System"),
    rejectionReason: String(raw.rejectionReason ?? ""),
    adminReviewComments: String(raw.adminReviewComments ?? ""),
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    formData:
      raw.formData && typeof raw.formData === "object"
        ? Object.fromEntries(
            Object.entries(raw.formData).map(([k, v]) => [k, String(v ?? "")]),
          )
        : undefined,
    templateId: raw.templateId,
    templateName: raw.templateName,
    kind: raw.kind,
    response: raw.response,
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    closedAt: raw.closedAt,
    owner: String(raw.responsiblePersonName ?? raw.owner ?? "Unassigned"),
    severity: priority,
    source: String(raw.source ?? "Manual"),
  };
}

async function readStore(): Promise<Store> {
  const raw = await readBlob<Store>(BLOB_KEY, { version: 1, items: [] });
  return {
    version: 1,
    items: Array.isArray(raw.items)
      ? raw.items.map((i) => normalize(i as NonConformanceRecord))
      : [],
  };
}

async function writeStore(store: Store) {
  await writeBlob(BLOB_KEY, store);
}

async function companyAdmins(company: string): Promise<User[]> {
  const users = await listUsersFromStore();
  return users.filter(
    (u) =>
      (u.role === "Company Admin" || u.role === "Super Admin") &&
      (u.role === "Super Admin" || sameCompany(u.company, company)) &&
      u.status !== "Suspended",
  );
}

export async function listNonConformances(
  actor?: Actor | null,
): Promise<NonConformanceRecord[]> {
  const items = (await readStore()).items;
  if (!actor) return items;
  if (actor.role === "Super Admin") return items;
  if (actor.role === "Company Admin") {
    return items.filter((n) => sameCompany(n.company, actor.company));
  }
  // Reporter + Responsible Person: own created or assigned
  return items.filter(
    (n) =>
      n.reporterId === actor.id ||
      n.responsiblePersonId === actor.id ||
      sameCompany(n.company, actor.company),
  );
}

export async function getNonConformance(
  id: string,
): Promise<NonConformanceRecord | undefined> {
  return (await readStore()).items.find((n) => n.id === id);
}

export function computeNcByDepartment(items: NonConformanceRecord[]) {
  const map = new Map<string, { open: number; closed: number }>();
  for (const n of items) {
    const key = n.department || "Other";
    const cur = map.get(key) || { open: 0, closed: 0 };
    if (n.status === "Closed") cur.closed += 1;
    else cur.open += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([department, v]) => ({
    department,
    open: v.open,
    closed: v.closed,
  }));
}

export function computeNcDashboard(items: NonConformanceRecord[], role: string) {
  const count = (status: NcStatus | NcStatus[]) => {
    const set = new Set(Array.isArray(status) ? status : [status]);
    return items.filter((n) => set.has(n.status)).length;
  };
  const now = new Date().toISOString().slice(0, 10);
  const overdue = items.filter(
    (n) =>
      n.dueDate &&
      n.dueDate < now &&
      n.status !== "Closed" &&
      n.status !== "Rejected",
  ).length;

  if (role === "Company Admin" || role === "Super Admin") {
    return {
      role: "admin" as const,
      cards: {
        pendingApproval: count("Pending Admin Approval"),
        pendingReview: count("Pending Admin Review"),
        assigned: count(["Assigned", "Draft", "In Progress", "Reopened"]),
        closed: count("Closed"),
        reopened: count("Reopened"),
      },
    };
  }

  if (role === "Supervisor" || role === "Site Manager") {
    // Combined reporter/responsible view cards
    return {
      role: "user" as const,
      cards: {
        totalRaised: items.filter((n) => n.reporterId).length,
        pendingApproval: count("Pending Admin Approval"),
        assigned: count(["Assigned", "Draft", "In Progress", "Reopened"]),
        closed: count("Closed"),
        rejected: count("Rejected"),
        draft: count("Draft"),
        pendingReview: count("Pending Admin Review"),
        overdue,
      },
    };
  }

  return {
    role: "user" as const,
    cards: {
      totalRaised: items.length,
      pendingApproval: count("Pending Admin Approval"),
      assigned: count(["Assigned", "Draft", "In Progress", "Reopened"]),
      closed: count("Closed"),
      rejected: count("Rejected"),
      draft: count("Draft"),
      pendingReview: count("Pending Admin Review"),
      overdue,
    },
  };
}

export async function createNonConformance(input: {
  actor: Actor;
  templateId: string;
  title?: string;
  formData?: Record<string, string>;
  responsiblePersonId: string;
  dueDate?: string;
  priority?: string;
  auditRef?: string;
  description?: string;
  evidence?: NcEvidence[];
}): Promise<NonConformanceRecord> {
  const templates = await listTemplates();
  const template = templates.find((t) => t.id === input.templateId);
  if (!template?.kind || !CONCERN_KINDS.has(template.kind)) {
    throw new Error("Select a concern template to raise a nonconformance");
  }

  const users = await listUsersFromStore();
  const responsible = users.find((u) => u.id === input.responsiblePersonId);
  if (!responsible) throw new Error("Select a valid responsible person");
  if (
    input.actor.role !== "Super Admin" &&
    !sameCompany(responsible.company, input.actor.company)
  ) {
    throw new Error("Responsible person must be in your company");
  }

  const formData = Object.fromEntries(
    Object.entries(input.formData ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  );
  const observation =
    input.description?.trim() ||
    formData.observationDetails?.trim() ||
    formData.findings?.trim() ||
    "";
  const title =
    input.title?.trim() ||
    observation.slice(0, 120) ||
    `${template.name} — Nonconformance`;
  const site =
    formData.projectName?.trim() ||
    formData.customerName?.trim() ||
    input.actor.company ||
    "—";
  const priority = normalizePriority(
    input.priority || formData.priority || "Medium",
  );
  const dueDate =
    (input.dueDate || formData.dueDate || "").slice(0, 10) ||
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const store = await readStore();
  const id = nextId(store.items);
  const now = new Date().toISOString();
  const actor = input.actor;

  const record = normalize({
    id,
    title,
    description: observation,
    company: actor.company,
    site,
    department: formData.ncCategory || formData.department || "SHEQ",
    auditRef: input.auditRef || formData.auditRef || "",
    priority,
    status: "Pending Admin Approval",
    reporterId: actor.id,
    reporterName: actor.name,
    responsiblePersonId: responsible.id,
    responsiblePersonName: responsible.name,
    dueDate,
    raised: now.slice(0, 10),
    createdAt: now,
    createdBy: actor.name,
    evidence: input.evidence ?? [],
    formData,
    templateId: template.id,
    templateName: template.name,
    kind: template.kind,
    timeline: [
      timelineEntry(actor, "NC Created"),
      timelineEntry(actor, "Submitted for Approval"),
    ],
    owner: responsible.name,
    source: "Concern Template",
  });

  store.items.unshift(record);
  await writeStore(store);

  const admins = await companyAdmins(actor.company);
  await createNotificationsForUsers(
    admins.map((a) => a.id),
    {
      companyId: actor.company,
      title: "New Nonconformance",
      message: "A new Nonconformance requires your approval.",
      type: "NC_CREATED",
      referenceType: "nonconformance",
      referenceId: id,
    },
  );

  return record;
}

export async function updateNonConformanceDraft(input: {
  id: string;
  actor: Actor;
  title?: string;
  formData?: Record<string, string>;
  responsiblePersonId?: string;
  dueDate?: string;
  priority?: string;
  description?: string;
  evidence?: NcEvidence[];
}): Promise<NonConformanceRecord> {
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === input.id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;

  if (current.reporterId !== input.actor.id && input.actor.role !== "Super Admin") {
    throw new Error("Only the reporter can edit this nonconformance");
  }
  if (
    current.status !== "Rejected" &&
    current.status !== "Pending Admin Approval"
  ) {
    throw new Error("This nonconformance can no longer be edited");
  }

  let responsiblePersonId = current.responsiblePersonId;
  let responsiblePersonName = current.responsiblePersonName;
  if (input.responsiblePersonId) {
    const users = await listUsersFromStore();
    const responsible = users.find((u) => u.id === input.responsiblePersonId);
    if (!responsible) throw new Error("Select a valid responsible person");
    responsiblePersonId = responsible.id;
    responsiblePersonName = responsible.name;
  }

  const formData = input.formData
    ? Object.fromEntries(
        Object.entries(input.formData).map(([k, v]) => [k, String(v ?? "")]),
      )
    : current.formData;

  const next = normalize({
    ...current,
    title: input.title?.trim() || current.title,
    description:
      input.description?.trim() ||
      formData?.observationDetails?.trim() ||
      current.description,
    formData,
    responsiblePersonId,
    responsiblePersonName,
    dueDate: (input.dueDate || current.dueDate).slice(0, 10),
    priority: input.priority
      ? normalizePriority(input.priority)
      : current.priority,
    evidence: input.evidence ?? current.evidence,
    status: "Pending Admin Approval",
    rejectionReason: "",
    timeline: [
      ...current.timeline,
      timelineEntry(input.actor, "Edited"),
      timelineEntry(input.actor, "Resubmitted for Approval"),
    ],
  });

  store.items[idx] = next;
  await writeStore(store);

  const admins = await companyAdmins(next.company);
  await createNotificationsForUsers(
    admins.map((a) => a.id),
    {
      companyId: next.company,
      title: "New Nonconformance",
      message: "A new Nonconformance requires your approval.",
      type: "NC_CREATED",
      referenceType: "nonconformance",
      referenceId: next.id,
    },
  );

  return next;
}

function assertAdmin(actor: Actor) {
  if (actor.role !== "Company Admin" && actor.role !== "Super Admin") {
    throw new Error("Only Company Admins can perform this action");
  }
}

export async function approveNonConformance(
  id: string,
  actor: Actor,
  comments?: string,
): Promise<NonConformanceRecord> {
  assertAdmin(actor);
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;
  if (
    actor.role !== "Super Admin" &&
    !sameCompany(current.company, actor.company)
  ) {
    throw new Error("Access denied");
  }
  if (current.status !== "Pending Admin Approval") {
    throw new Error("Only pending nonconformances can be approved");
  }

  const next = normalize({
    ...current,
    status: "Assigned",
    timeline: [
      ...current.timeline,
      timelineEntry(actor, "Admin Approved", comments),
      timelineEntry(actor, "Assigned"),
    ],
  });
  store.items[idx] = next;
  await writeStore(store);

  await createNotification({
    companyId: next.company,
    userId: next.responsiblePersonId,
    title: "New Nonconformance Assigned",
    message: "A Nonconformance has been assigned to you.",
    type: "NC_ASSIGNED",
    referenceType: "nonconformance",
    referenceId: next.id,
  });
  await createNotification({
    companyId: next.company,
    userId: next.reporterId,
    title: "Nonconformance Approved",
    message: "Your Nonconformance was approved and assigned.",
    type: "NC_APPROVED",
    referenceType: "nonconformance",
    referenceId: next.id,
  });

  return next;
}

export async function rejectNonConformance(
  id: string,
  actor: Actor,
  reason: string,
): Promise<NonConformanceRecord> {
  assertAdmin(actor);
  if (!reason.trim()) throw new Error("Rejection reason is required");
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;
  if (
    actor.role !== "Super Admin" &&
    !sameCompany(current.company, actor.company)
  ) {
    throw new Error("Access denied");
  }
  if (current.status !== "Pending Admin Approval") {
    throw new Error("Only pending nonconformances can be rejected");
  }

  const next = normalize({
    ...current,
    status: "Rejected",
    rejectionReason: reason.trim(),
    timeline: [
      ...current.timeline,
      timelineEntry(actor, "Admin Rejected", reason.trim()),
    ],
  });
  store.items[idx] = next;
  await writeStore(store);

  await createNotification({
    companyId: next.company,
    userId: next.reporterId,
    title: "Nonconformance Rejected",
    message: `Your Nonconformance has been rejected. ${reason.trim()}`,
    type: "NC_REJECTED",
    referenceType: "nonconformance",
    referenceId: next.id,
  });

  return next;
}

export async function saveNcResponse(input: {
  id: string;
  actor: Actor;
  correction: string;
  rootCause: string;
  correctiveAction: string;
  evidence?: NcEvidence[];
  submit: boolean;
}): Promise<NonConformanceRecord> {
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === input.id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;

  if (
    current.responsiblePersonId !== input.actor.id &&
    input.actor.role !== "Super Admin"
  ) {
    throw new Error("Only the responsible person can respond");
  }

  const allowed: NcStatus[] = [
    "Assigned",
    "Draft",
    "In Progress",
    "Reopened",
  ];
  if (!allowed.includes(current.status)) {
    throw new Error("Response cannot be updated in the current status");
  }

  const response: NcResponse = {
    correction: input.correction.trim(),
    rootCause: input.rootCause.trim(),
    correctiveAction: input.correctiveAction.trim(),
    evidence: input.evidence ?? current.response?.evidence ?? [],
    updatedAt: new Date().toISOString(),
  };

  if (input.submit) {
    if (!response.correction || !response.rootCause || !response.correctiveAction) {
      throw new Error("Correction, root cause and corrective action are required");
    }
  }

  const status: NcStatus = input.submit
    ? "Pending Admin Review"
    : "Draft";

  const next = normalize({
    ...current,
    status,
    response,
    timeline: [
      ...current.timeline,
      timelineEntry(
        input.actor,
        input.submit ? "Response Submitted" : "Response Draft Saved",
      ),
    ],
  });
  store.items[idx] = next;
  await writeStore(store);

  if (input.submit) {
    const admins = await companyAdmins(next.company);
    await createNotificationsForUsers(
      admins.map((a) => a.id),
      {
        companyId: next.company,
        title: "Corrective Response Submitted",
        message: "A corrective response has been submitted for review.",
        type: "NC_RESPONSE_SUBMITTED",
        referenceType: "nonconformance",
        referenceId: next.id,
      },
    );
  }

  return next;
}

export async function approveNcResponse(
  id: string,
  actor: Actor,
  comments?: string,
): Promise<NonConformanceRecord> {
  assertAdmin(actor);
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;
  if (
    actor.role !== "Super Admin" &&
    !sameCompany(current.company, actor.company)
  ) {
    throw new Error("Access denied");
  }
  if (current.status !== "Pending Admin Review") {
    throw new Error("Only responses pending review can be approved");
  }

  const closedAt = new Date().toISOString();
  const next = normalize({
    ...current,
    status: "Closed",
    closedAt,
    adminReviewComments: comments?.trim() || "",
    timeline: [
      ...current.timeline,
      timelineEntry(actor, "Response Approved", comments),
      timelineEntry(actor, "Closed"),
    ],
  });
  store.items[idx] = next;
  await writeStore(store);

  for (const userId of [next.reporterId, next.responsiblePersonId]) {
    if (!userId) continue;
    await createNotification({
      companyId: next.company,
      userId,
      title: "Nonconformance Closed",
      message: "The Nonconformance has been successfully closed.",
      type: "NC_CLOSED",
      referenceType: "nonconformance",
      referenceId: next.id,
    });
  }

  return next;
}

export async function rejectNcResponse(
  id: string,
  actor: Actor,
  comments: string,
): Promise<NonConformanceRecord> {
  assertAdmin(actor);
  if (!comments.trim()) throw new Error("Review comments are required");
  const store = await readStore();
  const idx = store.items.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error("Non-conformance not found");
  const current = store.items[idx]!;
  if (
    actor.role !== "Super Admin" &&
    !sameCompany(current.company, actor.company)
  ) {
    throw new Error("Access denied");
  }
  if (current.status !== "Pending Admin Review") {
    throw new Error("Only responses pending review can be rejected");
  }

  const next = normalize({
    ...current,
    status: "Reopened",
    adminReviewComments: comments.trim(),
    timeline: [
      ...current.timeline,
      timelineEntry(actor, "Admin Reopened", comments.trim()),
    ],
  });
  store.items[idx] = next;
  await writeStore(store);

  await createNotification({
    companyId: next.company,
    userId: next.responsiblePersonId,
    title: "Response Rejected",
    message: "Your corrective response requires changes.",
    type: "NC_REOPENED",
    referenceType: "nonconformance",
    referenceId: next.id,
  });

  return next;
}
