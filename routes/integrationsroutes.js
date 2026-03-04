const express = require("express");
const router = express.Router();
const path = require('path');
console.log("Checking DB path:", path.resolve(__dirname, '../config/db.js'));
const db = require("../config/db");
const axios = require("axios");

/* SAVE INTEGRATION */
router.post("/save", async (req, res) => {
  const { platform, credentials } = req.body;

  await db.query(
    `INSERT INTO integrations (platform, credentials, is_connected)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE credentials=VALUES(credentials)`,
    [platform, JSON.stringify(credentials)]
  );

  res.json({ success: true });
});

/* TEST FACEBOOK + INSTAGRAM */
router.post("/meta/test", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Access token missing" });
    }

    const response = await axios.get(
      `https://graph.facebook.com/v20.0/me?access_token=${accessToken}`
    );

    if (!response.data || !response.data.id) {
      return res.status(400).json({ message: "Invalid token" });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("META TEST ERROR:", error.response?.data || error.message);
    return res.status(400).json({
      message: "Invalid details",
      error: error.response?.data || error.message,
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT platform, is_connected FROM integrations");

    const result = {
      whatsapp: false,
      facebook: false,
      instagram: false,
      email: false,
    };

    rows.forEach(row => {
      result[row.platform] = row.is_connected === 1;
    });

    res.json(result);

  } catch (error) {
    console.error("STATUS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;