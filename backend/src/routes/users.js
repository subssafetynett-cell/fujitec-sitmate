const express = require("express");
const router = express.Router();
const usersController = require("../controllers/userController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Check if user exists — admin (legacy Enable user access page)
router.post(
  "/check-user",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.checkUser
);

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

// Page access catalog for admin UI
router.get(
  "/page-access-catalog",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.getPageAccessCatalog
);

// View access: lookup by email (company from admin context, not the form)
router.post(
  "/lookup-by-email",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.lookupByEmail
);

router.post(
  "/grant-view-access",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.grantViewAccess
);

router.post(
  "/invite-view-access",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.inviteViewAccess
);

// Form fields: resolve user name by email (any authenticated user, same company)
router.get(
  "/resolve-by-email",
  requireAuth,
  usersController.resolveUserByEmail
);

// Form fields: list assignable users for responsible-person dropdowns (same company)
router.get(
  "/assignable",
  requireAuth,
  usersController.listAssignableUsers
);

// List all users — superadmin and company_admin only (Users page)
router.get(
  "/",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.listAllUsers
);

// Form submissions for a user — admin user detail view
router.get(
  "/:id/form-submissions",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.getUserFormSubmissions
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

// Delete user — company_admin (own org) and superadmin
router.delete(
  "/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin"]),
  usersController.deleteUser
);

module.exports = router;
