const express = require("express");
const router = express.Router();
const { getAnalytics } = require("../config/controllers/reportsController");

router.get("/analytics", getAnalytics);

module.exports = router;