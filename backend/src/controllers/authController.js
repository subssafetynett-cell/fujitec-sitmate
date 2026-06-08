const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const {
  requestPasswordReset,
  resetPasswordWithToken,
} = require('../services/passwordResetService');
const {
  verifyEmailWithToken,
  resendVerificationEmail,
  sendSignupVerificationEmailWithTimeout,
} = require('../services/emailVerificationService');
const {
  getViewInvitePreview,
  acceptViewInviteWithOtp,
} = require('../services/viewAccessInviteService');
const prisma = require('../prismaClient');
const asyncHandler = require('express-async-handler');
const { validateNewPassword } = require('../utils/passwordPolicy');
const { reqUserDbId, resolveTokenRole } = require('../utils/userAuthorization');
const { formatUserAccessFields } = require('../utils/pageAccess');

// Existing signup...
exports.signup = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload.passwordConfirm;

    try {
        const { user, clientName } = await authService.signup(payload);
        const safeUser = { ...user };
        delete safeUser.password;
        delete safeUser.twoFactorSecret;

        let emailSent = false;
        let emailError = null;
        try {
            const emailResult = await sendSignupVerificationEmailWithTimeout(user, {
                companyName: clientName || user.companyname,
            });
            emailSent = Boolean(emailResult?.success);
            if (!emailSent) {
                emailError = emailResult?.error || 'Email delivery failed';
            }
        } catch (emailErr) {
            console.error('Failed to send signup verification email:', emailErr);
            emailError = emailErr.message || 'Email delivery failed';
        }

        res.status(201).json({
            success: true,
            requiresVerification: true,
            emailSent,
            emailError,
            message: emailSent
                ? 'Account created. Check your email and verify your address before signing in.'
                : 'Account created, but the verification email could not be sent. Use resend verification on the sign-in page.',
            user: safeUser,
        });
    } catch (err) {
        const body = {
            success: false,
            message: err.message || "Signup failed",
        };
        if (err.code) body.code = err.code;
        if (err.field) {
            body.errors = { [err.field]: err.message };
        }
        return res.status(err.status || 500).json(body);
    }
});

// Setup 2FA - Generate Secret & QR Code
exports.me = asyncHandler(async (req, res) => {
    const actorId = reqUserDbId(req);
    if (!actorId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
        where: { id: actorId },
        select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            companyname: true,
            mobile: true,
            role: true,
            accessMode: true,
            allowedPages: true,
            active: true,
            clientId: true,
            avatar: true,
            createdAt: true,
            lastLoginAt: true,
            lastSeenAt: true,
            twoFactorEnabled: true,
            client: { select: { id: true, name: true, logo: true } },
        },
    });

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
        success: true,
        user: {
            ...user,
            _id: user.id,
            role: resolveTokenRole(user),
            ...formatUserAccessFields(user),
        },
    });
});

exports.changePassword = asyncHandler(async (req, res) => {
    const actorId = reqUserDbId(req);
    if (!actorId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, password: true, active: true },
    });

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.active === false) {
        return res.status(403).json({ success: false, message: 'This account is disabled.' });
    }

    if (!user.password) {
        return res.status(400).json({
            success: false,
            message: 'This account cannot change password here. Contact your administrator.',
        });
    }

    const matches = await bcrypt.compare(String(currentPassword), user.password);
    if (!matches) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const pwdCheck = validateNewPassword(newPassword);
    if (!pwdCheck.ok) {
        return res.status(400).json({ success: false, message: pwdCheck.message });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(pwdCheck.value, salt);

    await prisma.user.update({
        where: { id: actorId },
        data: { password: hashed },
    });

    res.json({ success: true, message: 'Password updated successfully' });
});

exports.setup2FA = asyncHandler(async (req, res) => {
    const userId = reqUserDbId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Generate a secret
    const secret = speakeasy.generateSecret({
        name: `Safetynet (${req.user.email})`
    });

    // Temporarily store secret in DB
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32, twoFactorEnabled: false }
    });

    // Generate QR
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error generating QR code' });
        }
        res.json({ success: true, secret: secret.base32, qrCode: data_url });
    });
});

// Verify 2FA & Enable
exports.verify2FA = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const userId = reqUserDbId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || null == user.twoFactorSecret) {
        return res.status(400).json({ success: false, message: '2FA setup not initiated' });
    }

    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow 30-60s drift
    });

    if (verified) {
        await prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: true }
        });
        res.json({ success: true, message: '2FA enabled successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});


// Updated Login
exports.login = asyncHandler(async (req, res) => {
    try {
        const { email, password, otp } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const result = await authService.login({ email, password });

        const userObj = result.user.toObject ? result.user.toObject() : { ...result.user };

        const isActive = typeof userObj.active === "boolean" ? userObj.active : true;
        if (!isActive) {
            return res.status(403).json({ success: false, message: "User is blocked." });
        }

        delete userObj.password;
        delete userObj.twoFactorSecret;

        return res.json({ success: true, user: userObj, token: result.token });

    } catch (err) {
        console.error("AUTH LOGIN ERROR:", err);
        const status = err.status || 500;
        const body = {
            success: false,
            message: err.message || "Server error",
        };
        if (err.code) body.code = err.code;
        return res.status(status).json(body);
    }
});

exports.forgotPassword = asyncHandler(async (req, res) => {
    try {
        await requestPasswordReset(req.body.email, { ipAddress: req.ip });
        res.json({
            success: true,
            message:
                'If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.',
        });
    } catch (err) {
        const body = {
            success: false,
            message: err.message || 'Could not process password reset request',
        };
        if (err.code) body.code = err.code;
        res.status(err.status || 500).json(body);
    }
});

exports.resetPassword = asyncHandler(async (req, res) => {
    try {
        await resetPasswordWithToken(req.body.token, req.body.password);
        res.json({ success: true, message: 'Password reset successfully. You can sign in with your new password.' });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Could not reset password',
        });
    }
});

exports.verifyEmail = asyncHandler(async (req, res) => {
    try {
        const result = await verifyEmailWithToken(req.body.token);
        const message = result.alreadyVerified
            ? 'Your email is already verified. You can sign in.'
            : 'Email verified successfully. You can now sign in.';
        res.json({ success: true, message });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Could not verify email',
        });
    }
});

exports.getViewInvite = asyncHandler(async (req, res) => {
    try {
        const preview = await getViewInvitePreview(req.params.token);
        res.json({ success: true, invite: preview });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Invalid invitation',
        });
    }
});

exports.acceptViewInvite = asyncHandler(async (req, res) => {
    try {
        await acceptViewInviteWithOtp(req.body);
        res.json({
            success: true,
            message: 'Your account is ready. Sign in with your email and the password you just created.',
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Could not complete invitation',
        });
    }
});

exports.resendVerification = asyncHandler(async (req, res) => {
    try {
        await resendVerificationEmail(req.body.email);
        res.json({
            success: true,
            message:
                'If an unverified account exists for that email, we sent a new verification link. Check your inbox and spam folder.',
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Could not resend verification email',
        });
    }
});
