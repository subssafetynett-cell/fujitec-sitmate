const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const { sendEmail } = require("./emailService");
const { validateNewPassword } = require("../utils/passwordPolicy");
const { buildAppUrl } = require("../utils/appBaseUrl");
const {
  assertPasswordResetAllowed,
  recordPasswordResetAttempt,
} = require("../utils/passwordResetRateLimit");

const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Request a password reset email. Always succeeds from the caller's perspective
 * (does not reveal whether the email exists).
 */
async function requestPasswordReset(email, { ipAddress } = {}) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
    const err = new Error("Enter a valid email address");
    err.status = 400;
    throw err;
  }

  await assertPasswordResetAllowed(normalized, ipAddress);
  await recordPasswordResetAttempt(normalized, ipAddress);

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, firstName: true, active: true },
  });

  if (!user || user.active === false) {
    return { ok: true };
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId: user.id,
      expiresAt,
    },
  });

  const resetUrl = buildAppUrl(`/reset-password/${rawToken}`);
  const firstName = (user.firstName || "").trim() || "there";

  const html = `
    <div style="font-family: sans-serif; color: #1B212C; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 10px;">
      <h2 style="color: #0B4DA6; border-bottom: 2px solid #0B4DA6; padding-bottom: 10px;">Reset your password</h2>
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>We received a request to reset the password for your Sitemate account (<strong>${user.email}</strong>).</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #0B4DA6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a>
      </p>
      <p style="font-size: 0.9em; color: #666;">Or copy this link into your browser:<br/><a href="${resetUrl}" style="color: #0B4DA6; word-break: break-all;">${resetUrl}</a></p>
      <p style="font-size: 0.9em; color: #666;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
      <p style="margin-top: 24px; font-size: 0.9em; color: #666;">— The Sitemate Team</p>
    </div>
  `;

  const emailResult = await sendEmail({
    to: user.email,
    subject: "Reset your Sitemate password",
    html,
  });

  if (!emailResult?.success) {
    console.error("Password reset email failed:", emailResult?.error);
    const err = new Error(
      "Could not send reset email. Check SMTP settings or try again later."
    );
    err.status = 503;
    throw err;
  }

  return { ok: true };
}

async function resetPasswordWithToken(token, password) {
  const pwdCheck = validateNewPassword(password);
  if (!pwdCheck.ok) {
    const err = new Error(pwdCheck.message);
    err.status = 400;
    throw err;
  }

  const raw = String(token || "").trim();
  if (!raw) {
    const err = new Error("Reset token is required");
    err.status = 400;
    throw err;
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, active: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    const err = new Error("This reset link is invalid or has expired. Please request a new one.");
    err.status = 400;
    throw err;
  }

  if (!record.user?.active) {
    const err = new Error("This account is disabled. Contact your administrator.");
    err.status = 403;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(pwdCheck.value, salt);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

module.exports = {
  requestPasswordReset,
  resetPasswordWithToken,
};
