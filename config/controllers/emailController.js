// controllers/emailController.js
const emailService = require("../services/emailService");
exports.testEmailIntegration = async (req, res) => {
  try {
    const { email, app_password } = req.body || {};
    if (!email || !app_password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: "email and app_password are required",
      });
    }

    const result = await emailService.testCredentials(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Email test failed:", err);
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
      error: err?.message || String(err),
    });
  }
};

/**
 * POST /api/email/connect
 * Body: { business_id, email, app_password, smtp_host?, smtp_port?, imap_host?, imap_port? }
 */
exports.connectEmailIntegration = async (req, res) => {
  try {
    const { business_id, email, app_password } = req.body || {};

    if (!business_id || !email || !app_password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: "business_id, email and app_password are required",
      });
    }

    const result = await emailService.connectAndSave(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Email connect failed:", err);
    return res.status(401).json({
      success: false,
      message: "Connection failed",
      error: err?.message || String(err),
    });
  }
};

/**
 * POST /api/email/sync
 * Body: { business_id }
 */
exports.syncInboxEmails = async (req, res) => {
  try {
    const { business_id } = req.body || {};
    if (!business_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: "business_id is required",
      });
    }

    const result = await emailService.syncInbox({ business_id });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Email sync failed:", err);
    return res.status(500).json({
      success: false,
      message: "Sync failed",
      error: err?.message || String(err),
    });
  }
};

/**
 * POST /api/email/reply
 * Body: { business_id, to, subject, text }
 */
exports.replyEmail = async (req, res) => {
  try {
    const { business_id, to, subject, text } = req.body || {};
    if (!business_id || !to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: "business_id, to, subject, text are required",
      });
    }

    const result = await emailService.sendReply({ business_id, to, subject, text });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Email reply failed:", err);
    return res.status(500).json({
      success: false,
      message: "Reply failed",
      error: err?.message || String(err),
    });
  }
};