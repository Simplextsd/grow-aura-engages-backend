const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");

// 1. Is line se comment (//) hata diya hai taake controller load ho sakay
const profileController = require("../config/controllers/profileController");

// GET Profile
router.get("/", authenticateToken, profileController.getProfile);

// UPDATE Profile
router.put("/", authenticateToken, profileController.updateProfile);

module.exports = router;