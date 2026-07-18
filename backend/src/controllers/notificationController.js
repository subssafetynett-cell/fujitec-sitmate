const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");
const { reqUserDbId } = require("../utils/userAuthorization");

exports.listNotifications = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const rows = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json({ success: true, data: rows });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const count = await prisma.userNotification.count({
    where: { userId, read: false },
  });

  res.json({ success: true, count });
});

exports.markRead = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  await prisma.userNotification.updateMany({
    where: { id: req.params.id, userId },
    data: { read: true },
  });

  res.json({ success: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const userId = reqUserDbId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  await prisma.userNotification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  res.json({ success: true });
});
