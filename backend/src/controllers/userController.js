const asyncHandler = require("express-async-handler");
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
  const { firstName, lastName, email, password, role, jobTitle, companyname, mobile } = req.body;

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

  const updated = await prisma.user.update({
    where: { id: targetId },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
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
    user: { ...updated, _id: updated.id },
    roleChanged: Boolean(role && String(role).toLowerCase() !== target.role),
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
    active: typeof user.active === "boolean" ? user.active : true,
    avatar: user.avatar ?? null,
    createdAt: toIsoOrNull(user.createdAt),
    lastLoginAt: toIsoOrNull(user.lastLoginAt),
    lastSeenAt: toIsoOrNull(user.lastSeenAt),
  };

  res.json({ success: true, user: out });
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

  await prisma.user.delete({ where: { id: targetId } });
  res.json({ success: true, message: "User deleted successfully", id: targetId });
});

exports.checkUser = asyncHandler(async (req, res) => {
  const { email, companyId } = req.body;
  if (!email || !companyId) {
    return res.status(400).json({ success: false, message: "Email and Company ID required" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      clientId: companyId
    }
  });

  if (user) {
    res.json({ success: true, exists: true, user: { id: user.id, username: user.username, role: user.role } });
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
