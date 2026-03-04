const express = require("express");
const router = express.Router();
const db = require("../config/db");
const axios = require("axios");

// helper: get whatsapp creds from DB
async function getWhatsAppCreds() {
  const [rows] = await db.query("SELECT credentials, is_connected FROM integrations WHERE platform='whatsapp' LIMIT 1");
  if (!rows.length) return null;
  const creds = rows[0].credentials ? JSON.parse(rows[0].credentials) : {};
  return { creds, is_connected: !!rows[0].is_connected };
}

/**
 * GET /webhook (Meta verify)
 */
router.get("/webhook", async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const data = await getWhatsAppCreds();
    const VERIFY_TOKEN = data?.creds?.verifyToken || "my_secret_crm_2026";

    if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.sendStatus(403);
  } catch {
    return res.sendStatus(403);
  }
});

/**
 * POST /webhook (incoming messages)
 * WhatsApp Cloud API payload format
 */
router.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const messages = value?.messages || [];
    const metadata = value?.metadata || {};
    const wa_to = metadata?.display_phone_number || "";

    for (const msg of messages) {
      const wa_from = msg.from; // sender phone
      const wa_message_id = msg.id;
      const text = msg?.text?.body || "";

      // save contact/lead
      await db.query(
        `
        INSERT INTO whatsapp_contacts (wa_phone, last_message, last_message_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          last_message = VALUES(last_message),
          last_message_at = NOW()
        `,
        [wa_from, text]
      );

      // save message
      await db.query(
        `
        INSERT INTO whatsapp_messages (wa_message_id, wa_from, wa_to, direction, message_text)
        VALUES (?, ?, ?, 'incoming', ?)
        `,
        [wa_message_id, wa_from, wa_to, text]
      );
    }

    return res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("webhook error:", err.message);
    return res.status(200).send("EVENT_RECEIVED");
  }
});

/**
 * POST /api/whatsapp/send
 * body: { to, message }
 */
router.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ success: false, message: "to and message required" });

    const data = await getWhatsAppCreds();
    if (!data?.is_connected) return res.status(400).json({ success: false, message: "WhatsApp not connected" });

    const { phoneNumberId, accessToken } = data.creds;
    if (!phoneNumberId || !accessToken) return res.status(400).json({ success: false, message: "Missing API credentials" });

    const payload = {
      messaging_product: "whatsapp",
      to: String(to).replace("+", ""),
      type: "text",
      text: { body: message },
    };

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const r = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // save outgoing in DB
    await db.query(
      `
      INSERT INTO whatsapp_messages (wa_message_id, wa_from, wa_to, direction, message_text)
      VALUES (?, ?, ?, 'outgoing', ?)
      `,
      [r.data?.messages?.[0]?.id || null, phoneNumberId, String(to), message]
    );

    return res.json({ success: true, data: r.data });
  } catch (err) {
    console.error("send error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

module.exports = router;