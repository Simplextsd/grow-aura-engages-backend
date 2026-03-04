const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../config/db");

require("dotenv").config();

const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const IG_PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const GRAPH_VERSION = "v19.0";

// ✅ Threads (IG)
router.get("/threads", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, platform, page_id, sender_id, last_message, last_message_at
       FROM conversations
       WHERE platform='instagram'
       ORDER BY last_message_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Conversation messages
router.get("/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const [rows] = await db.query(
      `SELECT id, direction, message_text, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Reply from CRM -> IG DM
router.post("/reply", async (req, res) => {
  try {
    const { conversationId, messageText } = req.body;
    if (!conversationId || !messageText) {
      return res.status(400).json({ success: false, error: "conversationId and messageText required" });
    }

    const [convRows] = await db.query(
      `SELECT id, platform, page_id, sender_id FROM conversations WHERE id=? AND platform='instagram' LIMIT 1`,
      [conversationId]
    );
    if (!convRows[0]) return res.status(404).json({ success: false, error: "Conversation not found" });

    const conv = convRows[0];

    // IG send uses /me/messages with the IG token (page token linked with IG)
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages`;
    const igRes = await axios.post(
      url,
      {
        messaging_type: "RESPONSE",
        recipient: { id: conv.sender_id },
        message: { text: messageText },
      },
      { params: { access_token: IG_PAGE_ACCESS_TOKEN } }
    );

    await db.query(
      `INSERT INTO messages (conversation_id, platform, page_id, sender_id, direction, message_text, meta_message_id)
       VALUES (?,?,?,?, 'outgoing', ?, ?)`,
      [conv.id, "instagram", conv.page_id, conv.sender_id, messageText, igRes.data?.message_id || null]
    );

    await db.query(
      `UPDATE conversations SET last_message=?, last_message_at=NOW() WHERE id=?`,
      [messageText, conv.id]
    );

    res.json({ success: true, ig: igRes.data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.response?.data || err.message });
  }
});

// ✅ Webhook verify
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// ✅ Webhook receive (IG)
router.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body || body.object !== "instagram") return;

    for (const entry of body.entry || []) {
      const page_id = entry.id; // instagram business account id in webhook payload
      for (const ev of entry.messaging || []) {
        const sender_id = ev.sender?.id;
        const msgText = ev.message?.text || "";
        const meta_message_id = ev.message?.mid || null;
        if (!sender_id) continue;

        const [convRows] = await db.query(
          `SELECT id FROM conversations WHERE platform='instagram' AND page_id=? AND sender_id=? LIMIT 1`,
          [page_id, sender_id]
        );

        let conversation_id;
        if (convRows[0]) {
          conversation_id = convRows[0].id;
          await db.query(
            `UPDATE conversations SET last_message=?, last_message_at=NOW() WHERE id=?`,
            [msgText || "[attachment]", conversation_id]
          );
        } else {
          const [ins] = await db.query(
            `INSERT INTO conversations (platform, page_id, sender_id, last_message, last_message_at)
             VALUES ('instagram', ?, ?, ?, NOW())`,
            [page_id, sender_id, msgText || "[attachment]"]
          );
          conversation_id = ins.insertId;
        }

        await db.query(
          `INSERT INTO messages (conversation_id, platform, page_id, sender_id, direction, message_text, meta_message_id)
           VALUES (?,?,?,?, 'incoming', ?, ?)`,
          [conversation_id, "instagram", page_id, sender_id, msgText, meta_message_id]
        );
      }
    }
  } catch (err) {
    console.error("IG webhook error:", err.message);
  }
});

module.exports = router;
