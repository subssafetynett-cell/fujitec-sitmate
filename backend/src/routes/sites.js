const express = require("express");
const router = express.Router();
const siteController = require("../controllers/siteController");
const { requireAuth, requireRole } = require("../middleware/auth");

// All routes require authentication
router.use(requireAuth);

// Get all sites — site_manager and above can view
router.get("/", siteController.getAllSites);

// Get site managers list — company_admin and above
router.get(
  "/managers",
  requireRole(["superadmin", "company_admin"]),
  siteController.getSiteManagers
);

// Create a new site — company_admin and above
router.post(
  "/",
  requireRole(["superadmin", "company_admin", "site_manager"]),
  siteController.createSite
);

// Update site — company_admin and above
router.put(
  "/:id",
  requireRole(["superadmin", "company_admin", "site_manager"]),
  siteController.updateSite
);

// Delete site — superadmin and company_admin only
router.delete(
  "/:id",
  requireRole(["superadmin", "company_admin"]),
  siteController.deleteSite
);

module.exports = router;
