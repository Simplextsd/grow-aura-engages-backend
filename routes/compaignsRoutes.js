const express = require("express");
const router = express.Router();

const {
  listCampaigns,
  createCampaign,
  getCampaignById,
  sendCampaign,
  listRecipients,
  getAnalytics,
  trackOpen,
  trackClick,
} = require("../config/controllers/campaignsController");

const auth = require("../middleware/authMiddleware");

/* ================= ANALYTICS ================= */
router.get("/analytics", auth, getAnalytics);

/* ================= CAMPAIGN CRUD ================= */
router.get("/", auth, listCampaigns);
router.post("/", auth, createCampaign);

/* ================= SEND ================= */
router.post("/:id/send", auth, sendCampaign);

/* ================= RECIPIENTS ================= */
router.get("/:id/recipients", auth, listRecipients);

/* ================= GET SINGLE CAMPAIGN ================= */
/* ⚠ Dynamic route always last */
router.get("/:id", auth, getCampaignById);

/* ================= TRACKING (NO AUTH) ================= */
router.get("/:id/open", trackOpen);
router.get("/:id/click", trackClick);

module.exports = router;