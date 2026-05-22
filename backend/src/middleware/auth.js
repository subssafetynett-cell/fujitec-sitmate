// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { resolveTokenRole } = require('../utils/userAuthorization');
const { attachActingClient } = require('../utils/actingClientScope');

/** Throttled DB write so listing "online" users does not update on every request. */
const LAST_SEEN_THROTTLE_MS = 60 * 1000;
const lastSeenWriteAt = new Map();

function touchUserLastSeen(userId) {
  if (!userId) return;
  const now = Date.now();
  const prev = lastSeenWriteAt.get(userId) || 0;
  if (now - prev < LAST_SEEN_THROTTLE_MS) return;
  lastSeenWriteAt.set(userId, now);
  prisma.user
    .update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});
}

exports.requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, clientId, companyname }
    const userId = decoded.id ?? decoded.userId ?? decoded.sub;
    touchUserLastSeen(userId);
    await attachActingClient(req);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

exports.requireRole = (roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Not authenticated' });

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  const effectiveRole = resolveTokenRole(req.user);
  if (!allowedRoles.includes(effectiveRole)) {
    console.error(`⛔ 403 Forbidden: User ${req.user.email} (Role: ${effectiveRole}) tried to access route expecting: ${allowedRoles.join(', ')}`);
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      debug: { userRole: effectiveRole, required: allowedRoles }
    });
  }

  next();
};
