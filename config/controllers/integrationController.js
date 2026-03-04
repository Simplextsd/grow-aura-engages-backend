const db = require("../../db");

/* ================= SAVE INTEGRATION ================= */

exports.saveIntegration = async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;
    const data = req.body;

    if (!platform) {
      return res.status(400).json({ message: "Platform required" });
    }

    // Check if already exists
    const [existing] = await db.query(
      "SELECT id FROM integrations WHERE user_id=? AND platform=?",
      [userId, platform]
    );

    if (existing.length > 0) {
      // Update existing
      await db.query(
        "UPDATE integrations SET page_id=?, access_token=?, config=? WHERE user_id=? AND platform=?",
        [
          data.pageId || null,
          data.accessToken || null,
          JSON.stringify(data),
          userId,
          platform,
        ]
      );
    } else {
      // Insert new
      await db.query(
        "INSERT INTO integrations (user_id, platform, page_id, access_token, config) VALUES (?, ?, ?, ?, ?)",
        [
          userId,
          platform,
          data.pageId || null,
          data.accessToken || null,
          JSON.stringify(data),
        ]
      );
    }

    res.json({ success: true, message: `${platform} connected successfully` });

  } catch (error) {
    console.error("Integration Save Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET INTEGRATION ================= */

exports.getIntegration = async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM integrations WHERE user_id=? AND platform=?",
      [userId, platform]
    );

    if (rows.length === 0) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      data: rows[0],
    });

  } catch (error) {
    console.error("Integration Fetch Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};