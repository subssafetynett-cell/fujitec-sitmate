const express = require("express");
const router = express.Router();
const actionTrackerController = require("../controllers/actionTrackerController");
const { requireAuth } = require("../middleware/auth");

router.get("/actions", requireAuth, actionTrackerController.listMyActions);
router.get(
  "/actions/by-response/:formResponseId",
  requireAuth,
  actionTrackerController.getActionByFormResponse
);
router.get("/actions/:id", requireAuth, actionTrackerController.getAction);
router.put("/actions/:id", requireAuth, actionTrackerController.updateAction);
router.post("/actions/:id/review", requireAuth, actionTrackerController.reviewSentAction);
router.patch("/actions/:id/register-status", requireAuth, actionTrackerController.updateRegisterStatus);
router.post("/actions/:id/send", requireAuth, actionTrackerController.sendActionToReporter);

module.exports = router;
