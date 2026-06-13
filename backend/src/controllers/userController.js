const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const { validatePlainName } = require("../utils/plainTextName");
const { validatePlainCompanyName } = require("../utils/plainTextCompany");
const { sendInviteVerificationEmailWithTimeout } = require("../services/emailVerificationService");
const { validateNewPassword } = require("../utils/passwordPolicy");
const {
  reqUserDbId,
  loadAdminActor,
  canManageTargetUser,
  invalidateSessionUserCache,
} = require("../utils/userAuthorization");
const {
  isSafetynettCompanyName,
  isPlatformSuperadminEmail,
  assertRoleAllowedForCompany,
} = require("../utils/company");
const { APP_PAGES, VIEW_ONLY_FORBIDDEN_PAGE_KEYS } = require("../constants/pageAccess");
const {
  normalizeAllowedPages,
  mergeWithAlwaysOn,
  formatUserAccessFields,
} = require("../utils/pageAccess");
const {
  sendViewAccessInviteEmailWithTimeout,
} = require("../services/viewAccessInviteService");

// Role hierarchy — higher index = higher privilege
const ROLE_HIERARCHY = ["worker", "supervisor", "site_manager", "company_admin", "superadmin"];

function toIsoOrNull(v) {
  if (v == null) return null;
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

// Roles a given role is allowed to assign
const ASSIGNABLE_ROLES = {
  superadmin:    ["worker", "supervisor", "site_manager", "company_admin", "superadmin"],
  company_admin: ["worker", "supervisor", "site_manager", "company_admin"],
  site_manager:  ["worker", "supervisor"],
  supervisor:    [],
  worker:        [],
};

/** @returns {{ ok: true } | { ok: false, status: number, message: string }} */
function assertActorMayAssignRole(effectiveRole, role) {
  const r = String(role || "").toLowerCase();
  const allowed = ASSIGNABLE_ROLES[effectiveRole] || [];
  if (!allowed.includes(r)) {
    return { ok: false, status: 403, message: "You cannot assign this role" };
  }
  if (r === "superadmin" && effectiveRole !== "superadmin") {
    return {
      ok: false,
      status: 403,
      message: "Only superadmins can assign the superadmin role",
    };
  }
  return { ok: true };
}

exports.getAdminStats = asyncHandler(async (req, res) => {
  const [userCount, clientCount] = await Promise.all([
    prisma.user.count(),
    prisma.client.count()
  ]);
  res.json({ success: true, userCount, clientCount });
});

exports.listAllUsers = asyncHandler(async (req, res) => {
  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  try {
    const actingId = req.actingClient?.id || null;
    const where = actingId
      ? { clientId: actingId }
      : actor.effectiveRole === "company_admin"
        ? { clientId: actor.clientId }
        : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        companyname: true,
        mobile: true,
        role: true,
        accessMode: true,
        allowedPages: true,
        active: true,
        clientId: true,
        createdAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
      },
    });

    const formatted = users.map((u) => ({
      _id: u.id,
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      companyname: u.companyname || "",
      clientId: u.clientId,
      role: u.role || "worker",
      ...formatUserAccessFields(u),
      active: typeof u.active === "boolean" ? u.active : true,
      createdAt: toIsoOrNull(u.createdAt),
      lastLoginAt: toIsoOrNull(u.lastLoginAt),
      lastSeenAt: toIsoOrNull(u.lastSeenAt),
    }));

    res.json({ success: true, users: formatted });
  } catch (err) {
    console.error("Error fetching all users:", err);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    jobTitle,
    companyname,
    mobile,
    accessMode,
    allowedPages,
  } = req.body;

  if (password !== undefined && password !== null && String(password).trim() !== "") {
    return res.status(400).json({
      success: false,
      message: "Password cannot be changed via this endpoint. Use POST /api/auth/change-password for your own account.",
    });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      clientId: true,
      role: true,
      accessMode: true,
      allowedPages: true,
      companyname: true,
      email: true,
      client: { select: { name: true } },
    },
  });
  if (!target) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!canManageTargetUser(actor, target, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  if (actor.effectiveRole !== "superadmin" && target.role === "superadmin") {
    return res.status(403).json({
      success: false,
      message: "Only superadmins can change platform superadmin accounts",
    });
  }

  const data = {};
  if (firstName !== undefined && firstName !== null) {
    const r = validatePlainName(firstName, "First name");
    if (!r.ok) {
      return res.status(400).json({ success: false, message: r.message });
    }
    data.firstName = r.value;
  }
  if (lastName !== undefined && lastName !== null) {
    const r = validatePlainName(lastName, "Last name");
    if (!r.ok) {
      return res.status(400).json({ success: false, message: r.message });
    }
    data.lastName = r.value;
  }
  if (email) data.email = email.trim().toLowerCase();

  if (jobTitle) data.jobTitle = jobTitle.trim();
  if (companyname !== undefined && companyname !== null && String(companyname).trim() !== "") {
    const cn = validatePlainCompanyName(companyname, "Company name");
    if (!cn.ok) {
      return res.status(400).json({ success: false, message: cn.message });
    }
    data.companyname = cn.value;
  }
  if (mobile) data.mobile = mobile.trim();

  if (role) {
    const normalizedRole = String(role).toLowerCase();
    if (["superadmin", "company_admin", "site_manager", "supervisor", "worker"].includes(normalizedRole)) {
      const roleGate = assertActorMayAssignRole(actor.effectiveRole, normalizedRole);
      if (!roleGate.ok) {
        return res.status(roleGate.status).json({ success: false, message: roleGate.message });
      }
      const companyForRole =
        data.companyname ??
        target.companyname ??
        target.client?.name ??
        "";
      const roleCheck = assertRoleAllowedForCompany(
        normalizedRole,
        companyForRole,
        data.email ?? target.email
      );
      if (!roleCheck.ok) {
        return res.status(400).json({ success: false, message: roleCheck.message });
      }
      data.role = normalizedRole;
    }
  }

  if (
    data.companyname &&
    isSafetynettCompanyName(data.companyname) &&
    (data.role ?? target.role) === "superadmin" &&
    !isPlatformSuperadminEmail(target.email)
  ) {
    return res.status(400).json({
      success: false,
      message: "Safetynett company users cannot have the superadmin role.",
    });
  }

  if (accessMode !== undefined) {
    const mode = String(accessMode).toLowerCase();
    if (!["standard", "view_only"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "accessMode must be 'standard' or 'view_only'",
      });
    }
    if (mode === "view_only" && target.role === "superadmin" && !isPlatformSuperadminEmail(target.email)) {
      return res.status(400).json({
        success: false,
        message: "View-only page access cannot be applied to superadmin accounts.",
      });
    }
    data.accessMode = mode;
    if (mode === "standard") {
      data.allowedPages = null;
    }
  }

  if (allowedPages !== undefined) {
    const effectiveMode = data.accessMode ?? target.accessMode ?? "standard";
    const pages = normalizeAllowedPages(allowedPages, {
      forViewOnly: effectiveMode === "view_only",
    });
    if (effectiveMode === "view_only" && pages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least one page for view-only access.",
      });
    }
    data.allowedPages =
      effectiveMode === "view_only"
        ? mergeWithAlwaysOn(pages, { forViewOnly: true })
        : null;
  } else if (data.accessMode === "view_only") {
    const existing = normalizeAllowedPages(target.allowedPages, { forViewOnly: true });
    if (existing.length === 0) {
      data.allowedPages = mergeWithAlwaysOn(["dashboard"], { forViewOnly: true });
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      accessMode: true,
      allowedPages: true,
      jobTitle: true,
      companyname: true,
      mobile: true,
      clientId: true,
      active: true,
    },
  });

  invalidateSessionUserCache(targetId);

  res.json({
    success: true,
    message: "User updated successfully",
    user: { ...updated, _id: updated.id, ...formatUserAccessFields(updated) },
    roleChanged: Boolean(role && String(role).toLowerCase() !== target.role),
  });
});

/** Company scope inferred from admin role / existing user — never from the form. */
async function resolveClientScopeForEmail(prisma, req, actor, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (actor.effectiveRole === "company_admin") {
    if (!actor.clientId) {
      return {
        ok: false,
        status: 400,
        message: "Your account is not linked to a company",
      };
    }
    return { ok: true, clientId: actor.clientId };
  }

  if (actor.effectiveRole === "superadmin") {
    if (normalizedEmail) {
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: { clientId: true },
      });
      if (existing?.clientId) {
        return { ok: true, clientId: existing.clientId };
      }
    }
    const clientId = req.actingClient?.id || actor.clientId || null;
    if (!clientId) {
      return {
        ok: false,
        status: 400,
        message: "Unable to determine company for a new user. Use “View as company” on the Clients page, or add the user under an existing company email domain.",
      };
    }
    return { ok: true, clientId };
  }

  return { ok: false, status: 403, message: "Insufficient permissions" };
}

function namesFromEmail(email) {
  const local = String(email || "").split("@")[0] || "user";
  const parts = local.replace(/[._+-]/g, " ").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : "User";
  const lastName =
    parts.length > 1
      ? parts
          .slice(1)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ")
      : "User";
  return { firstName, lastName };
}

exports.lookupByEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const scope = await resolveClientScopeForEmail(prisma, req, gate.actor, normalizedEmail);
  if (!scope.ok) {
    return res.status(scope.status).json({ success: false, message: scope.message });
  }

  const userWhere =
    gate.actor.effectiveRole === "superadmin"
      ? { email: normalizedEmail }
      : { email: normalizedEmail, clientId: scope.clientId };

  const user = await prisma.user.findFirst({
    where: userWhere,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      accessMode: true,
      allowedPages: true,
      active: true,
    },
  });

  if (user) {
    return res.json({
      success: true,
      exists: true,
      user: {
        id: user.id,
        _id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        active: user.active,
        ...formatUserAccessFields(user),
      },
    });
  }

  const elsewhere = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (elsewhere) {
    return res.json({
      success: true,
      exists: false,
      message: "This email is registered under a different company.",
    });
  }

  res.json({ success: true, exists: false, message: "No account yet — set a password and choose pages to create access." });
});

exports.grantViewAccess = asyncHandler(async (req, res) => {
  const { email, password, allowedPages, accessMode } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }

  const pwdCheck = validateNewPassword(password);
  if (!pwdCheck.ok) {
    return res.status(400).json({ success: false, message: pwdCheck.message });
  }

  const mode = String(accessMode || "view_only").toLowerCase();
  if (!["standard", "view_only"].includes(mode)) {
    return res.status(400).json({ success: false, message: "Invalid access mode" });
  }

  const pages = normalizeAllowedPages(allowedPages, { forViewOnly: mode === "view_only" });
  if (mode === "view_only" && pages.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Select at least one page for view-only access",
    });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const normalizedEmail = String(email).trim().toLowerCase();
  const scope = await resolveClientScopeForEmail(prisma, req, actor, normalizedEmail);
  if (!scope.ok) {
    return res.status(scope.status).json({ success: false, message: scope.message });
  }

  const client = await prisma.client.findUnique({
    where: { id: scope.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return res.status(400).json({ success: false, message: "Company not found" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const mergedPages =
    mode === "view_only" ? mergeWithAlwaysOn(pages, { forViewOnly: true }) : null;

  const targetWhere =
    actor.effectiveRole === "superadmin"
      ? { email: normalizedEmail }
      : { email: normalizedEmail, clientId: scope.clientId };

  let target = await prisma.user.findFirst({
    where: targetWhere,
  });

  if (!target) {
    const elsewhere = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, clientId: true },
    });
    if (elsewhere) {
      return res.status(409).json({
        success: false,
        message: "This email is already used by another company",
      });
    }

    const { firstName, lastName } = namesFromEmail(normalizedEmail);
    const username =
      normalizedEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") +
      "_" +
      Date.now();

    target = await prisma.user.create({
      data: {
        username,
        firstName,
        lastName,
        email: normalizedEmail,
        mobile: "",
        password: hashedPassword,
        companyname: client.name,
        role: "worker",
        active: true,
        emailVerified: true,
        clientId: client.id,
        accessMode: mode,
        allowedPages: mergedPages,
      },
    });

    invalidateSessionUserCache(target.id);

    return res.status(201).json({
      success: true,
      message: "User created with view access. They can sign in with this email and password.",
      created: true,
      user: {
        id: target.id,
        _id: target.id,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        role: target.role,
        ...formatUserAccessFields(target),
      },
    });
  }

  if (!canManageTargetUser(actor, target, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }
  if (target.role === "superadmin") {
    return res.status(400).json({
      success: false,
      message: "Cannot change access for superadmin accounts here",
    });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      password: hashedPassword,
      accessMode: mode,
      allowedPages: mergedPages,
      emailVerified: true,
      active: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      accessMode: true,
      allowedPages: true,
    },
  });

  invalidateSessionUserCache(target.id);

  res.json({
    success: true,
    message: "View access updated. The user can sign in with this email and password.",
    created: false,
    user: {
      ...updated,
      _id: updated.id,
      ...formatUserAccessFields(updated),
    },
  });
});

exports.inviteViewAccess = asyncHandler(async (req, res) => {
  const { email, allowedPages } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }

  const pages = normalizeAllowedPages(allowedPages, { forViewOnly: true });
  if (pages.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Select at least one page for view-only access",
    });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const normalizedEmail = String(email).trim().toLowerCase();
  const scope = await resolveClientScopeForEmail(prisma, req, actor, normalizedEmail);
  if (!scope.ok) {
    return res.status(scope.status).json({ success: false, message: scope.message });
  }

  const client = await prisma.client.findUnique({
    where: { id: scope.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return res.status(400).json({ success: false, message: "Company not found" });
  }

  const mergedPages = mergeWithAlwaysOn(pages, { forViewOnly: true });
  const pageLabels = pages
    .map((key) => APP_PAGES.find((p) => p.key === key)?.label)
    .filter(Boolean);

  const targetWhere =
    actor.effectiveRole === "superadmin"
      ? { email: normalizedEmail }
      : { email: normalizedEmail, clientId: scope.clientId };

  let target = await prisma.user.findFirst({ where: targetWhere });
  let created = false;

  if (!target) {
    const elsewhere = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (elsewhere) {
      return res.status(409).json({
        success: false,
        message: "This email is already used by another company",
      });
    }

    const { firstName, lastName } = namesFromEmail(normalizedEmail);
    const username =
      normalizedEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") +
      "_" +
      Date.now();
    const placeholderPassword = await bcrypt.hash(
      crypto.randomBytes(32).toString("hex"),
      10
    );

    target = await prisma.user.create({
      data: {
        username,
        firstName,
        lastName,
        email: normalizedEmail,
        mobile: "",
        password: placeholderPassword,
        companyname: client.name,
        role: "worker",
        active: true,
        emailVerified: false,
        clientId: client.id,
        accessMode: "view_only",
        allowedPages: mergedPages,
      },
    });
    created = true;
  } else {
    if (!canManageTargetUser(actor, target, actor.effectiveRole)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }
    if (target.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Cannot invite superadmin accounts for view-only access",
      });
    }

    target = await prisma.user.update({
      where: { id: target.id },
      data: {
        accessMode: "view_only",
        allowedPages: mergedPages,
        emailVerified: false,
        active: true,
        companyname: client.name,
      },
    });
  }

  invalidateSessionUserCache(target.id);

  const emailResult = await sendViewAccessInviteEmailWithTimeout(target, {
    companyName: client.name,
    pageLabels,
  });

  const emailSent = Boolean(emailResult?.success);

  res.status(created ? 201 : 200).json({
    success: true,
    emailSent,
    emailError: emailSent ? null : emailResult?.error || "Email delivery failed",
    message: emailSent
      ? "Invitation sent. They must open the link, enter the verification code, and set a password."
      : "User saved, but the invitation email could not be sent. Try again.",
    created,
    user: {
      id: target.id,
      _id: target.id,
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      ...formatUserAccessFields(target),
    },
  });
});

exports.getPageAccessCatalog = asyncHandler(async (req, res) => {
  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  res.json({
    success: true,
    pages: APP_PAGES.filter(
      (p) => !p.alwaysOn && !VIEW_ONLY_FORBIDDEN_PAGE_KEYS.has(p.key)
    ).map(({ key, label }) => ({ key, label })),
  });
});
exports.updateStatus = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;
  const { active } = req.body;

  if (typeof active !== "boolean") {
    return res.status(400).json({ success: false, message: "Invalid 'active' value (expected boolean)" });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, clientId: true },
  });
  if (!target) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!canManageTargetUser(actor, target, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { active },
  });

  invalidateSessionUserCache(targetId);

  const u = { ...user };
  delete u.password;
  delete u.twoFactorSecret;

  res.json({ success: true, message: "User status updated", user: u });
});
exports.getUserById = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!canManageTargetUser(actor, user, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const out = {
    _id: user.id,
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    jobTitle: user.jobTitle ?? user.jobTitle ?? null,
    mobile: user.mobile ?? null,
    companyname: user.companyname ?? user.company ?? "",
    role: user.role ?? "worker",
    ...formatUserAccessFields(user),
    active: typeof user.active === "boolean" ? user.active : true,
    avatar: null,
    createdAt: toIsoOrNull(user.createdAt),
    lastLoginAt: toIsoOrNull(user.lastLoginAt),
    lastSeenAt: toIsoOrNull(user.lastSeenAt),
  };

  res.json({ success: true, user: out });
});

exports.getUserFormSubmissions = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!canManageTargetUser(actor, user, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const rows = await prisma.$queryRaw`
    SELECT
      fr.id,
      fr.category,
      fr."createdAt",
      f.title AS "formTitle",
      COALESCE(
        NULLIF(TRIM(fr.answers->>'name'), ''),
        NULLIF(TRIM(fr.answers->>'report_heading'), ''),
        NULLIF(TRIM(fr.answers->'formMetadata'->>'name'), '')
      ) AS "customTitle"
    FROM "FormResponse" fr
    LEFT JOIN "Form" f ON f.id = fr."formId"
    WHERE fr."submittedById" = ${targetId}
    ORDER BY fr."createdAt" DESC
    LIMIT 100`;

  const data = rows.map((row) => ({
    id: row.id,
    title:
      (row.customTitle && String(row.customTitle).trim()) ||
      row.formTitle ||
      row.category ||
      "Untitled form",
    category: row.category || row.formTitle || "General",
    createdAt: toIsoOrNull(row.createdAt),
  }));

  res.json({ success: true, data, total: data.length });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, clientId: true, role: true },
  });

  if (!target) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!canManageTargetUser(actor, target, actor.effectiveRole)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  if (actor.effectiveRole === "company_admin" && target.role === "superadmin") {
    return res.status(403).json({ success: false, message: "You cannot delete this user" });
  }

  if (targetId === actor.id) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account" });
  }

  // Detach heavy relations before delete so FK work is indexed and predictable on large tenants.
  await prisma.$transaction([
    prisma.formResponse.updateMany({
      where: { submittedById: targetId },
      data: { submittedById: null },
    }),
    prisma.siteDocument.updateMany({
      where: { uploadedById: targetId },
      data: { uploadedById: actor.id },
    }),
    prisma.user.delete({ where: { id: targetId } }),
  ]);

  invalidateSessionUserCache(targetId);
  res.json({ success: true, message: "User deleted successfully", id: targetId });
});

exports.checkUser = asyncHandler(async (req, res) => {
  const { email, companyId } = req.body;
  if (!email || !companyId) {
    return res.status(400).json({ success: false, message: "Email and Company ID required" });
  }

  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }
  const { actor } = gate;

  if (actor.effectiveRole === "company_admin" && actor.clientId !== companyId) {
    return res.status(403).json({ success: false, message: "You can only manage users in your company" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      clientId: companyId
    },
    select: {
      id: true,
      username: true,
      role: true,
      accessMode: true,
      allowedPages: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (user) {
    res.json({
      success: true,
      exists: true,
      user: {
        id: user.id,
        _id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        ...formatUserAccessFields(user),
      },
    });
  } else {
    // Check if user exists but in different company (optional hint)
    const other = await prisma.user.findUnique({ where: { email } });
    if (other) {
      res.json({ success: true, exists: false, message: "User exists but belongs to a different company." });
    } else {
      res.json({ success: true, exists: false, message: "User doesn't exist." });
    }
  }
});

// ─── INVITE / CREATE USER ────────────────────────────────────────────────────
exports.inviteUser = asyncHandler(async (req, res) => {
  const gate = await loadAdminActor(prisma, req);
  if (!gate.ok) {
    return res.status(gate.status).json({ success: false, message: gate.message });
  }

  const inviter = {
    id: gate.actor.id,
    role: gate.actor.effectiveRole,
    clientId: gate.actor.clientId,
    companyname: gate.actor.companyname,
    email: gate.actor.email,
  };

  const { firstName, lastName, email, mobile, role, password, companyname, username, clientId: bodyClientId } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ success: false, message: "firstName, lastName, email, and password are required" });
  }

  const fn = validatePlainName(firstName, "First name");
  const ln = validatePlainName(lastName, "Last name");
  if (!fn.ok) {
    return res.status(400).json({ success: false, message: fn.message });
  }
  if (!ln.ok) {
    return res.status(400).json({ success: false, message: ln.message });
  }
  const assignedRole = String(role || "worker").toLowerCase();

  const roleGate = assertActorMayAssignRole(inviter.role, assignedRole);
  if (!roleGate.ok) {
    return res.status(roleGate.status).json({ success: false, message: roleGate.message });
  }

  let clientId;
  let resolvedCompany;

  if (inviter.role === "superadmin") {
    clientId = (bodyClientId && String(bodyClientId).trim()) || inviter.clientId;
    if (!clientId) {
      return res.status(400).json({ success: false, message: "Select a company for this user" });
    }
    if (bodyClientId && bodyClientId !== inviter.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: bodyClientId },
        select: { name: true },
      });
      if (!client) {
        return res.status(400).json({ success: false, message: "Selected company not found" });
      }
      resolvedCompany = client.name;
    } else {
      resolvedCompany = companyname?.trim() || inviter.companyname || "";
    }
  } else if (inviter.role === "company_admin") {
    if (!inviter.clientId) {
      return res.status(400).json({ success: false, message: "Your account is not linked to a company" });
    }
    if (bodyClientId && bodyClientId !== inviter.clientId) {
      return res.status(403).json({
        success: false,
        message: "You can only add users to your own company",
      });
    }
    clientId = inviter.clientId;
    resolvedCompany = inviter.companyname || "";
  } else {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  // Admins may have null companyname; use the linked Client name when available.
  if (!String(resolvedCompany || "").trim() && clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });
    if (client?.name) {
      resolvedCompany = client.name;
    }
  }

  const trimmedCompany = String(resolvedCompany || "").trim();
  if (trimmedCompany) {
    const companyCheck = validatePlainCompanyName(trimmedCompany, "Company name");
    if (!companyCheck.ok) {
      return res.status(400).json({ success: false, message: companyCheck.message });
    }
    resolvedCompany = companyCheck.value;
  } else {
    resolvedCompany = null;
  }

  const roleCheck = assertRoleAllowedForCompany(assignedRole, resolvedCompany, email);
  if (!roleCheck.ok) {
    return res.status(400).json({ success: false, message: roleCheck.message });
  }

  const pwdCheck = validateNewPassword(password);
  if (!pwdCheck.ok) {
    return res.status(400).json({ success: false, message: pwdCheck.message });
  }

  // Generate username if not provided
  const resolvedUsername = username?.trim() || email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Date.now();

  // Check for duplicate email or username
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }),
    prisma.user.findUnique({ where: { username: resolvedUsername } }),
  ]);

  if (existingEmail) {
    return res.status(409).json({ success: false, message: "A user with this email already exists" });
  }

  const finalUsername = existingUsername
    ? resolvedUsername + "_" + Math.floor(Math.random() * 9000 + 1000)
    : resolvedUsername;

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      username:    finalUsername,
      firstName:   fn.value,
      lastName:    ln.value,
      email:       email.toLowerCase().trim(),
      mobile:      (mobile || "").trim(),
      password:    hashedPassword,
      companyname: resolvedCompany,
      role:        assignedRole,
      active:      true,
      emailVerified: false,
      clientId,
    },
  });

  let emailSent = false;
  let emailError = null;

  try {
    const emailResult = await sendInviteVerificationEmailWithTimeout(newUser, {
      companyName: resolvedCompany,
      temporaryPassword: password,
    });
    emailSent = Boolean(emailResult?.success);
    if (!emailSent) {
      emailError = emailResult?.error || "Email delivery failed";
    }
  } catch (emailErr) {
    console.error("Failed to send verification email:", emailErr);
    emailError = emailErr.message || "Email delivery failed";
  }

  res.status(201).json({
    success: true,
    message: emailSent
      ? "User invited. They must verify their email before they can sign in."
      : "User created, but the verification email could not be sent. Resend verification or share the link manually.",
    emailSent,
    emailError,
    user: {
      id:          newUser.id,
      username:    newUser.username,
      firstName:   newUser.firstName,
      lastName:    newUser.lastName,
      email:       newUser.email,
      role:        newUser.role,
      active:      newUser.active,
      companyname: newUser.companyname,
      createdAt:   newUser.createdAt,
    },
  });
});
