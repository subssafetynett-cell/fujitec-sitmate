const asyncHandler = require("express-async-handler");
const crypto = require("node:crypto");
const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const { validatePlainName } = require("../utils/plainTextName");
const { validatePlainCompanyName } = require("../utils/plainTextCompany");
const { sendInviteVerificationEmailWithTimeout } = require("../services/emailVerificationService");
const { describeInviteEmailResult } = require("../services/emailService");
const { validateNewPassword } = require("../utils/passwordPolicy");
const {
  reqUserDbId,
  loadAdminActor,
  canManageTargetUser,
  invalidateSessionUserCache,
  resolveTokenRole,
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

async function sendInviteWelcomeEmailStatus(user, { companyName, password }) {
  try {
    const emailResult = await sendInviteVerificationEmailWithTimeout(user, {
      companyName,
      temporaryPassword: password,
    });
    return describeInviteEmailResult(emailResult);
  } catch (emailErr) {
    console.error("Failed to send invite welcome email:", emailErr);
    return describeInviteEmailResult({
      success: false,
      error: emailErr.message || "Email delivery failed",
    });
  }
}

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

const VALID_USER_ROLES = ["superadmin", "company_admin", "site_manager", "supervisor", "worker"];

/** @returns {{ ok: true, value?: string } | { ok: false, message: string }} */
function optionalPlainName(raw, label) {
  if (raw === undefined || raw === null) return { ok: true };
  const r = validatePlainName(raw, label);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, value: r.value };
}

/** @returns {{ ok: true, value?: string } | { ok: false, message: string }} */
function optionalPlainCompany(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { ok: true };
  const cn = validatePlainCompanyName(raw, "Company name");
  if (!cn.ok) return { ok: false, message: cn.message };
  return { ok: true, value: cn.value };
}

function isInvalidSafetynettSuperadmin(data, target) {
  const role = data.role ?? target.role;
  return (
    Boolean(data.companyname)
    && isSafetynettCompanyName(data.companyname)
    && role === "superadmin"
    && !isPlatformSuperadminEmail(target.email)
  );
}

/** @returns {{ ok: true } | { ok: false, status: number, message: string }} */
function applyRoleToUpdate(data, { role, actor, target }) {
  const normalizedRole = String(role).toLowerCase();
  if (!VALID_USER_ROLES.includes(normalizedRole)) return { ok: true };

  const roleGate = assertActorMayAssignRole(actor.effectiveRole, normalizedRole);
  if (!roleGate.ok) {
    return { ok: false, status: roleGate.status, message: roleGate.message };
  }

  const companyForRole =
    data.companyname ?? target.companyname ?? target.client?.name ?? "";
  const roleCheck = assertRoleAllowedForCompany(
    normalizedRole,
    companyForRole,
    data.email ?? target.email
  );
  if (!roleCheck.ok) {
    return { ok: false, status: 400, message: roleCheck.message };
  }
  data.role = normalizedRole;
  return { ok: true };
}

/** @returns {{ ok: true } | { ok: false, status: number, message: string }} */
function applyAccessFieldsToUpdate(data, { accessMode, allowedPages, target }) {
  if (accessMode !== undefined) {
    const mode = String(accessMode).toLowerCase();
    if (!["standard", "view_only"].includes(mode)) {
      return {
        ok: false,
        status: 400,
        message: "accessMode must be 'standard' or 'view_only'",
      };
    }
    if (mode === "view_only" && target.role === "superadmin" && !isPlatformSuperadminEmail(target.email)) {
      return {
        ok: false,
        status: 400,
        message: "View-only page access cannot be applied to superadmin accounts.",
      };
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
      return {
        ok: false,
        status: 400,
        message: "Select at least one page for view-only access.",
      };
    }
    data.allowedPages =
      effectiveMode === "view_only"
        ? mergeWithAlwaysOn(pages, { forViewOnly: true })
        : null;
    return { ok: true };
  }

  if (data.accessMode !== "view_only") return { ok: true };

  const existing = normalizeAllowedPages(target.allowedPages, { forViewOnly: true });
  if (existing.length === 0) {
    data.allowedPages = mergeWithAlwaysOn(["dashboard"], { forViewOnly: true });
  }
  return { ok: true };
}

/** @returns {{ ok: true, data: object } | { ok: false, status: number, message: string }} */
function buildUserUpdateData(body, target, actor) {
  const { email, role, jobTitle, companyname, mobile, accessMode, allowedPages } = body;
  const data = {};

  for (const [field, label] of [
    ["firstName", "First name"],
    ["lastName", "Last name"],
  ]) {
    const r = optionalPlainName(body[field], label);
    if (!r.ok) return { ok: false, status: 400, message: r.message };
    if (r.value !== undefined) data[field] = r.value;
  }

  if (email) data.email = email.trim().toLowerCase();
  if (jobTitle) data.jobTitle = jobTitle.trim();

  const companyResult = optionalPlainCompany(companyname);
  if (!companyResult.ok) return { ok: false, status: 400, message: companyResult.message };
  if (companyResult.value !== undefined) data.companyname = companyResult.value;

  if (mobile) data.mobile = mobile.trim();

  if (role) {
    const roleResult = applyRoleToUpdate(data, { role, actor, target });
    if (!roleResult.ok) return roleResult;
  }

  if (isInvalidSafetynettSuperadmin(data, target)) {
    return {
      ok: false,
      status: 400,
      message: "Safetynett company users cannot have the superadmin role.",
    };
  }

  const accessResult = applyAccessFieldsToUpdate(data, { accessMode, allowedPages, target });
  if (!accessResult.ok) return accessResult;

  return { ok: true, data };
}

/**
 * Superadmin may reassign a user to another client; company_admin may not.
 * @returns {Promise<{ ok: true, patch: { clientId?: string, companyname?: string } } | { ok: false, status: number, message: string }>}
 */
async function resolveClientChangeForUpdate(actor, target, bodyClientId) {
  const raw = bodyClientId === undefined || bodyClientId === null ? "" : String(bodyClientId).trim();

  if (actor.effectiveRole === "company_admin") {
    if (raw && raw !== target.clientId && raw !== actor.clientId) {
      return {
        ok: false,
        status: 403,
        message: "You can only manage users in your own company",
      };
    }
    return { ok: true, patch: {} };
  }

  if (actor.effectiveRole !== "superadmin") {
    return { ok: true, patch: {} };
  }

  if (!raw) {
    return { ok: true, patch: {} };
  }

  if (raw === target.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: raw },
      select: { name: true },
    });
    if (!client) {
      return { ok: false, status: 400, message: "Selected company not found" };
    }
    return {
      ok: true,
      patch: {
        clientId: raw,
        companyname: client.name,
      },
    };
  }

  const client = await prisma.client.findUnique({
    where: { id: raw },
    select: { name: true },
  });
  if (!client) {
    return { ok: false, status: 400, message: "Selected company not found" };
  }

  return {
    ok: true,
    patch: {
      clientId: raw,
      companyname: client.name,
    },
  };
}

/** @returns {Promise<{ ok: true, clientId: string, resolvedCompany: string } | { ok: false, status: number, message: string }>} */
async function resolveInviteClientAndCompany(inviter, { bodyClientId, companyname }) {
  if (inviter.role === "superadmin") {
    const clientId = (bodyClientId && String(bodyClientId).trim()) || inviter.clientId;
    if (!clientId) {
      return { ok: false, status: 400, message: "Select a company for this user" };
    }

    if (bodyClientId && bodyClientId !== inviter.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: bodyClientId },
        select: { name: true },
      });
      if (!client) {
        return { ok: false, status: 400, message: "Selected company not found" };
      }
      return { ok: true, clientId, resolvedCompany: client.name };
    }

    return {
      ok: true,
      clientId,
      resolvedCompany: companyname?.trim() || inviter.companyname || "",
    };
  }

  if (inviter.role === "company_admin") {
    if (!inviter.clientId) {
      return { ok: false, status: 400, message: "Your account is not linked to a company" };
    }
    if (bodyClientId && bodyClientId !== inviter.clientId) {
      return {
        ok: false,
        status: 403,
        message: "You can only add users to your own company",
      };
    }
    return {
      ok: true,
      clientId: inviter.clientId,
      resolvedCompany: inviter.companyname || "",
    };
  }

  return { ok: false, status: 403, message: "Insufficient permissions" };
}

/** @returns {Promise<{ ok: true, value: string | null } | { ok: false, status: number, message: string }>} */
async function normalizeInviteCompanyName(clientId, resolvedCompany) {
  let company = String(resolvedCompany || "").trim();
  if (!company && clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });
    if (client?.name) company = client.name;
  }

  if (!company) return { ok: true, value: null };

  const companyCheck = validatePlainCompanyName(company, "Company name");
  if (!companyCheck.ok) {
    return { ok: false, status: 400, message: companyCheck.message };
  }
  return { ok: true, value: companyCheck.value };
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
    clientId: bodyClientId,
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

  const clientChange = await resolveClientChangeForUpdate(actor, target, bodyClientId);
  if (!clientChange.ok) {
    return res.status(clientChange.status).json({ success: false, message: clientChange.message });
  }

  const effectiveCompany =
    clientChange.patch.companyname !== undefined
      ? clientChange.patch.companyname
      : companyname;

  const built = buildUserUpdateData(
    {
      firstName,
      lastName,
      email,
      role,
      jobTitle,
      companyname: effectiveCompany,
      mobile,
      accessMode,
      allowedPages,
    },
    target,
    actor
  );
  if (!built.ok) {
    return res.status(built.status).json({ success: false, message: built.message });
  }
  const { data } = built;
  if (clientChange.patch.clientId !== undefined) {
    data.clientId = clientChange.patch.clientId;
  }
  if (clientChange.patch.companyname !== undefined) {
    data.companyname = clientChange.patch.companyname;
  }

  if (isInvalidSafetynettSuperadmin(data, target)) {
    return res.status(400).json({
      success: false,
      message: "Safetynett company users cannot have the superadmin role.",
    });
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

/** Form field lookup — any authenticated user can resolve a colleague by email within their company. */
exports.resolveUserByEmail = asyncHandler(async (req, res) => {
  const rawEmail = req.query.email;
  if (!rawEmail || !/^\S+@\S+\.\S+$/.test(String(rawEmail).trim())) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }

  const normalizedEmail = String(rawEmail).trim().toLowerCase();
  const effectiveRole = resolveTokenRole(req.user);
  const clientId = req.actingClient?.id || req.user?.clientId || null;

  const userWhere =
    effectiveRole === "superadmin" && !clientId
      ? { email: normalizedEmail }
      : clientId
        ? { email: normalizedEmail, clientId }
        : { email: normalizedEmail };

  const user = await prisma.user.findFirst({
    where: userWhere,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      active: true,
      accessMode: true,
    },
  });

  if (user) {
    if (user.active === false) {
      return res.json({
        success: true,
        exists: false,
        message:
          "This account is inactive. Ask an administrator to reactivate it or create a new account.",
      });
    }

    if (String(user.accessMode || "standard").toLowerCase() === "view_only") {
      return res.json({
        success: true,
        exists: false,
        viewOnly: true,
        message:
          "This user has only view access — not allowed as responsible person.",
      });
    }

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;

    return res.json({
      success: true,
      exists: true,
      user: {
        id: user.id,
        email: user.email,
        name,
        firstName: user.firstName,
        lastName: user.lastName,
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
      message:
        "No user with this email exists in your organisation. Ask an administrator to create an account.",
    });
  }

  res.json({
    success: true,
    exists: false,
    message:
      "No user with this email exists. Ask an administrator to create an account.",
  });
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
        emailVerified: false,
        clientId: client.id,
        accessMode: mode,
        allowedPages: mergedPages,
      },
    });

    invalidateSessionUserCache(target.id);

    const emailStatus = await sendInviteWelcomeEmailStatus(target, {
      companyName: client.name,
      password,
    });

    return res.status(201).json({
      success: true,
      ...emailStatus,
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
      emailVerified: false,
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

  const emailStatus = await sendInviteWelcomeEmailStatus(updated, {
    companyName: client.name,
    password,
  });

  res.json({
    success: true,
    ...emailStatus,
    message: emailStatus.emailSent
      ? "Access updated. A welcome email was sent to their inbox — they must verify their email before signing in."
      : emailStatus.message.replace(/^User created/, "Access updated"),
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
      fr."formId",
      fr.category,
      fr."createdAt",
      f.title AS "formTitle",
      fr.answers->>'siteId' AS "siteId",
      fr.answers->>'subfolderId' AS "subfolderId",
      fr.answers->>'monitoringSection' AS "monitoringSection",
      fr.answers->>'sheqFormCategory' AS "sheqFormCategory",
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
    formId: row.formId,
    formTitle: row.formTitle || null,
    siteId: row.siteId || null,
    subfolderId: row.subfolderId || null,
    monitoringSection: row.monitoringSection || null,
    sheqFormCategory: row.sheqFormCategory || null,
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
  try {
    await prisma.$transaction([
      prisma.nonconformanceAction.updateMany({
        where: { assigneeId: targetId },
        data: { assigneeId: actor.id },
      }),
      prisma.nonconformanceAction.updateMany({
        where: { reporterId: targetId },
        data: { reporterId: actor.id },
      }),
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
  } catch (err) {
    if (err?.code === "P2003") {
      return res.status(409).json({
        success: false,
        message:
          "This user is still linked to records that could not be reassigned. Remove or reassign their actions and documents, then try again.",
      });
    }
    throw err;
  }

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

  const scope = await resolveInviteClientAndCompany(inviter, { bodyClientId, companyname });
  if (!scope.ok) {
    return res.status(scope.status).json({ success: false, message: scope.message });
  }

  const companyResult = await normalizeInviteCompanyName(scope.clientId, scope.resolvedCompany);
  if (!companyResult.ok) {
    return res.status(companyResult.status).json({ success: false, message: companyResult.message });
  }

  const clientId = scope.clientId;
  const resolvedCompany = companyResult.value;

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

  const emailStatus = await sendInviteWelcomeEmailStatus(newUser, {
    companyName: resolvedCompany,
    password,
  });

  res.status(201).json({
    success: true,
    ...emailStatus,
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
