const db = require("../db");/* ================= GET PROFILE ================= */

exports.getProfile = async (req, res) => {
  try {

    const [rows] = await db.query(
      `SELECT id,
              full_name,
              email,
              company,
              phone,
              whatsapp_number,
              is_whatsapp_connected,
              is_email_connected,
              is_instagram_connected,
              is_facebook_connected
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error("Fetch Profile Error:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
};

/* ================= UPDATE PROFILE ================= */

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, company, phone, whatsapp_number } = req.body;

    await db.query(
      `UPDATE users
       SET full_name = ?, company = ?, phone = ?, whatsapp_number = ?
       WHERE id = ?`,
      [
        full_name,
        company,
        phone,
        whatsapp_number,
        req.user.id
      ]
    );

    res.json({ success: true, message: "Profile updated successfully" });

  } catch (err) {
    console.error("Profile Update Error:", err);
    res.status(500).json({ message: "Update failed" });
  }
};