const express = require("express");
const router = express.Router();
const db = require("../config/db");
const axios = require("axios");
require("dotenv").config();

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v21.0";

const graphUrl = (path) => `https://graph.facebook.com/${GRAPH_VERSION}${path}`;

/** ✅ FB user profile (PSID) -> name */
async function getUserInfo(psid) {
  try {
    const r = await axios.get(graphUrl(`/${psid}`), {
      params: {
        // name field + fallbacks
        fields: "name,first_name,last_name,profile_pic",
        access_token: PAGE_ACCESS_TOKEN,
      },
      timeout: 15000,
    });

    const name =
      (r.data?.name && String(r.data.name).trim()) ||
      `${r.data?.first_name || ""} ${r.data?.last_name || ""}`.trim() ||
      "Facebook User";

    return { name, profile_pic: r.data?.profile_pic || null };
  } catch (e) {
    console.error("❌ User Info Fetch Error:", e.response?.data || e.message);
    return { name: "Facebook User", profile_pic: null };
  }
}

/** ✅ WEBHOOK VERIFY */
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/** ✅ WEBHOOK RECEIVE */
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") return res.sendStatus(404);
  res.status(200).send("EVENT_RECEIVED");

  try {
    for (const entry of body.entry || []) {
      const page_id = entry.id;

      for (const ev of entry.messaging || []) {
        const sender_id = ev.sender?.id;
        const msgText = ev.message?.text || "";
        const meta_message_id = ev.message?.mid || null;

        if (!sender_id || !msgText) continue;

        console.log(`📩 FB Message | page:${page_id} | from:${sender_id} | text:${msgText}`);

        // ✅ Fetch name (every time OR only when missing)
        const profile = await getUserInfo(sender_id);
        const customerName = profile.name;

        // 1) Conversation find
        const [convRows] = await db.query(
          `SELECT id FROM conversations 
           WHERE platform='facebook' AND page_id=? AND sender_id=? 
           LIMIT 1`,
          [page_id, sender_id]
        );

        let conversation_id;

        if (convRows.length > 0) {
          conversation_id = convRows[0].id;
          await db.query(
            `UPDATE conversations 
             SET last_message=?, last_message_at=NOW(), customer_name=? 
             WHERE id=?`,
            [msgText, customerName, conversation_id]
          );
        } else {
          const [ins] = await db.query(
            `INSERT INTO conversations (platform, page_id, sender_id, customer_name, last_message, last_message_at)
             VALUES ('facebook', ?, ?, ?, ?, NOW())`,
            [page_id, sender_id, customerName, msgText]
          );
          conversation_id = ins.insertId;
        }

        // 2) Save incoming message
        await db.query(
          `INSERT INTO messages (conversation_id, platform, page_id, sender_id, direction, message_text, meta_message_id)
           VALUES (?, 'facebook', ?, ?, 'incoming', ?, ?)`,
          [conversation_id, page_id, sender_id, msgText, meta_message_id]
        );

        // ❌ AUTO REPLY REMOVED (as you requested)
        // try {
        //   await axios.post(graphUrl(`/me/messages`), {
        //     recipient: { id: sender_id },
        //     message: { text: "Auto reply..." }
        //   }, {
        //     params: { access_token: PAGE_ACCESS_TOKEN }
        //   });
        // } catch (apiErr) {}
      }
    }
  } catch (err) {
    console.error("🔥 Webhook processing error:", err);
  }
});

/** ✅ THREADS LIST */
router.get("/threads", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM conversations WHERE platform='facebook' ORDER BY last_message_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** ✅ REPLY FROM CRM -> FB (manual reply) */
router.post("/reply", async (req, res) => {
  try {
    const { conversationId, messageText } = req.body;

    const [convRows] = await db.query(
      `SELECT * FROM conversations WHERE id=? AND platform='facebook' LIMIT 1`,
      [conversationId]
    );

    if (!convRows[0]) return res.status(404).json({ success: false, error: "No conversation found" });

    const conv = convRows[0];

    // ✅ Send manual message
    const fbRes = await axios.post(
      graphUrl(`/me/messages`),
      { recipient: { id: conv.sender_id }, message: { text: messageText } },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );

    // Save outgoing
    await db.query(
      `INSERT INTO messages (conversation_id, platform, page_id, sender_id, direction, message_text, meta_message_id)
       VALUES (?, 'facebook', ?, ?, 'outgoing', ?, ?)`,
      [conv.id, conv.page_id, conv.sender_id, messageText, fbRes.data?.message_id || null]
    );

    res.json({ success: true, fb: fbRes.data });
  } catch (err) {
    console.error("❌ Reply API Error:", err.response?.data || err.message);
    res.status(400).json({ success: false, error: err.response?.data || err.message });
  }
});

module.exports = router;
