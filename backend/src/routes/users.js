const express = require("express");
const router = express.Router();
const usersController = require("../controllers/userController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Check if user exists (public helper used during invite flow)
router.post("/check-user", requireAuth, usersController.checkUser);

// Get stats — superadmin only
router.get(
  "/stats",
  requireAuth,
  requireRole(["superadmin"]),
  usersController.getAdminStats
);

// Invite a new user — company_admin and above
router.post(
  "/invite",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.inviteUser
);

// List all users — company_admin and above
router.get(
  "/",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager"]),
  usersController.listAllUsers
);

// Get single user — authenticated users (used in profile views)
router.get("/:id", requireAuth, usersController.getUserById);

// Toggle active/inactive — company_admin and above
router.put(
  "/:id/status",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.updateStatus
);

// Edit user details / role — company_admin and above
router.put(
  "/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.updateUser
);

// Delete user — superadmin only
router.delete(
  "/:id",
  requireAuth,
  requireRole(["superadmin"]),
  usersController.deleteUser
);

module.exports = router;
