const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
  saveForm,
  getAllForms,
  getFormById,
  deleteForm,
  saveResponse,
  getAllResponses,
  getResponseById,
  deleteResponse,
  updateResponse,
  sendResponseEmail,
  updateForm,
  uploadLogo
} = require("../controllers/formController");

// Create/edit forms — site_manager and above
router.post(
  "/",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  saveForm
);
router.post(
  "/upload-logo",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  upload.single("logo"),
  uploadLogo
);

// Get all forms — all authenticated users
router.get("/", requireAuth, getAllForms);

// Responses — all authenticated roles can read/submit responses
router.get("/responses", requireAuth, getAllResponses);
router.get("/responses/:id", requireAuth, getResponseById);
router.post("/:id/responses", requireAuth, saveResponse);
router.post("/responses/:id/email", requireAuth, sendResponseEmail);

// Response edit/delete — site_manager and above
router.delete(
  "/responses/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  deleteResponse
);
router.put(
  "/responses/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  updateResponse
);

// Single form operations
router.get("/:id", getFormById);

// Update/delete forms — site_manager and above
router.put(
  "/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  updateForm
);
router.delete(
  "/:id",
  requireAuth,
  requireRole(["superadmin", "company_admin", "site_manager", "supervisor"]),
  deleteForm
);

module.exports = router;
