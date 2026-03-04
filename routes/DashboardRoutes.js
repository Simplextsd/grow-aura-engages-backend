const express = require("express");
const router = express.Router();

const dashboardController = require("../config/controllers/dashboardcontroller");

router.get("/stats", dashboardController.getDashboardStats);

module.exports = router;