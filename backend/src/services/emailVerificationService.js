const crypto = require("crypto");
const prisma = require("../prismaClient");
const { sendEmail } = require("./emailService");
const { buildAppUrl } = require("../utils/appBaseUrl");
const { escapeHtml } = require("../utils/htmlEscape");

const VERIFY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function createVerificationToken(userId) {
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_MS);

  await prisma.emailVerificationToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      expiresAt,
    },
  });

  return rawToken;
}

function buildVerificationEmailHtml(user, { companyName, temporaryPassword, isSignup }) {
  const verifyUrl = buildAppUrl(`/verify-email/${user._rawToken}`);
  const firstName = escapeHtml((user.firstName || "").trim() || "there");
  const safeCompany = escapeHtml(companyName || "your organisation");
  const safeEmail = escapeHtml(user.email);
  const safePassword = escapeHtml(temporaryPassword || "");
  const safeVerifyUrl = escapeHtml(verifyUrl);
  const loginUrl = escapeHtml(buildAppUrl("/login"));

  const intro = isSignup
    ? `<p>Thanks for signing up for <strong>${safeCompany}</strong> on Sitemate. Confirm that you own <strong>${safeEmail}</strong> before you can sign in.</p>`
    : temporaryPassword
    ? `<p>You have been invited to join <strong>${safeCompany}</strong> on Sitemate. Confirm that you own <strong>${safeEmail}</strong> before signing in.</p>`
    : `<p>Please confirm that you own <strong>${safeEmail}</strong> for your <strong>${safeCompany}</strong> Sitemate account before signing in.</p>`;

  const credentialsBlock =
    temporaryPassword && !isSignup
      ? `<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #0B4DA6;">
        <p style="margin: 0 0 8px 0;"><strong>After verifying</strong>, sign in at <a href="${loginUrl}" style="color: #0B4DA6;">${loginUrl}</a> with:</p>
        <p style="margin: 0 0 6px 0;"><strong>Email:</strong> <code style="background: #fff; padding: 2px 5px; border-radius: 3px;">${safeEmail}</code></p>
        <p style="margin: 0;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 5px; border-radius: 3px;">${safePassword}</code></p>
      </div>`
      : `<p style="font-size: 0.95em; color: #444;">After verifying, sign in at <a href="${loginUrl}" style="color: #0B4DA6;">${loginUrl}</a> using your account email and password.</p>`;

  const footerNote = isSignup
    ? "This link expires in 7 days. If you did not create this account, you can ignore this email."
    : "This link expires in 7 days. Change your password after your first login.";

  return `
    <div style="font-family: sans-serif; color: #1B212C; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 10px;">
      <h2 style="color: #0B4DA6; border-bottom: 2px solid #0B4DA6; padding-bottom: 10px;">Verify your Sitemate account</h2>
      <p>Hello <strong>${firstName}</strong>,</p>
      ${intro}
      <p style="margin: 24px 0;">
        <a href="${safeVerifyUrl}" style="display: inline-block; background: #0B4DA6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify email address</a>
      </p>
      <p style="font-size: 0.9em; color: #666;">Or copy this link into your browser:<br/><a href="${safeVerifyUrl}" style="color: #0B4DA6; word-break: break-all;">${safeVerifyUrl}</a></p>
      ${credentialsBlock}
      <p style="font-size: 0.9em; color: #666;">${footerNote}</p>
      <p style="margin-top: 24px; font-size: 0.9em; color: #666;">— The Sitemate Team</p>
    </div>
  `;
}

/**
 * Create a verification token and email the user (invite or self-signup).
 */
async function sendAccountVerificationEmail(user, { companyName, temporaryPassword, isSignup = false }) {
  const rawToken = await createVerificationToken(user.id);
  const html = buildVerificationEmailHtml(
    { ...user, _rawToken: rawToken },
    { companyName, temporaryPassword, isSignup }
  );

  return sendEmail({
    to: user.email,
    subject: "Verify your Sitemate account",
    html,
  });
}

/** Used when admins invite users. */
async function sendInviteVerificationEmail(user, { companyName, temporaryPassword }) {
  return sendAccountVerificationEmail(user, { companyName, temporaryPassword, isSignup: false });
}

/** Used after self-service signup. */
async function sendSignupVerificationEmail(user, { companyName }) {
  return sendAccountVerificationEmail(user, { companyName, isSignup: true });
}

const INVITE_EMAIL_TIMEOUT_MS = 12_000;

/**
 * Await invite email delivery with a cap so the API does not hang on slow SMTP.
 * Returns { success, error? } like sendEmail.
 */
async function sendVerificationEmailWithTimeout(
  sendFn,
  user,
  options,
  timeoutMs = INVITE_EMAIL_TIMEOUT_MS
) {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(
      () =>
        resolve({
          success: false,
          error:
            "Verification email timed out. The account was created — use resend verification to try again.",
        }),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([sendFn(user, options), timeoutPromise]);
    return result;
  } catch (err) {
    return { success: false, error: err.message || "Email delivery failed" };
  } finally {
    clearTimeout(timerId);
  }
}

async function sendInviteVerificationEmailWithTimeout(user, options, timeoutMs = INVITE_EMAIL_TIMEOUT_MS) {
  return sendVerificationEmailWithTimeout(sendInviteVerificationEmail, user, options, timeoutMs);
}

async function sendSignupVerificationEmailWithTimeout(user, options, timeoutMs = INVITE_EMAIL_TIMEOUT_MS) {
  return sendVerificationEmailWithTimeout(sendSignupVerificationEmail, user, options, timeoutMs);
}

async function verifyEmailWithToken(token) {
  const raw = String(token || "").trim();
  if (!raw) {
    const err = new Error("Verification token is required");
    err.status = 400;
    throw err;
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, active: true, emailVerified: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    const err = new Error(
      "This verification link is invalid or has expired. Use resend verification on the sign-in page to request a new link."
    );
    err.status = 400;
    throw err;
  }

  if (!record.user?.active) {
    const err = new Error("This account is disabled. Contact your administrator.");
    err.status = 403;
    throw err;
  }

  if (record.user.emailVerified) {
    return { ok: true, alreadyVerified: true };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, alreadyVerified: false };
}

/**
 * Resend verification for an unverified account. Does not reveal whether the email exists.
 */
async function resendVerificationEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
    const err = new Error("Enter a valid email address");
    err.status = 400;
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      firstName: true,
      active: true,
      emailVerified: true,
      companyname: true,
    },
  });

  if (!user || user.active === false || user.emailVerified) {
    return { ok: true };
  }

  await sendAccountVerificationEmail(user, {
    companyName: user.companyname || "your organisation",
    isSignup: false,
  });

  return { ok: true };
}

module.exports = {
  sendInviteVerificationEmail,
  sendInviteVerificationEmailWithTimeout,
  sendSignupVerificationEmail,
  sendSignupVerificationEmailWithTimeout,
  verifyEmailWithToken,
  resendVerificationEmail,
};
