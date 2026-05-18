const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getUsersByClient,
} = require("../controllers/clientsController");

const { requireAuth, requireRole } = require("../middleware/auth");
const {
  CLIENT_READ_ROLES,
  CLIENT_MANAGE_ROLES,
} = require("../utils/clientAccess");

router.use(requireAuth);

router.get("/", requireRole(CLIENT_READ_ROLES), listClients);
router.get("/:id", requireRole(CLIENT_READ_ROLES), getClient);
router.get("/:id/users", requireRole(["superadmin"]), getUsersByClient);

router.post(
  "/",
  requireRole(CLIENT_MANAGE_ROLES),
  upload.single("logo"),
  createClient
);

router.put(
  "/:id",
  requireRole(["superadmin", "company_admin"]),
  upload.single("logo"),
  updateClient
);

router.delete("/:id", requireRole(CLIENT_MANAGE_ROLES), deleteClient);

module.exports = router;
