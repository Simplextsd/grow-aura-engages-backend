const express = require("express");
const router = express.Router();
const db = require("../config/db");
const axios = require("axios");

/* VERIFY */
router.get("/meta", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === "my_verify_token"
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* RECEIVE META */
router.post("/meta", async (req, res) => {
  const body = req.body;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {

      if (!event.message) continue;

      const senderId = event.sender.id;
      const text = event.message.text || "[Attachment]";
      const platform = "facebook";

      let [conv] = await db.query(
        "SELECT id FROM conversations WHERE sender_id=? AND platform=?",
        [senderId, platform]
      );

      let conversationId;

      if (!conv.length) {
        const [newConv] = await db.query(
          "INSERT INTO conversations (platform, sender_id, last_message, last_message_at) VALUES (?, ?, ?, NOW())",
          [platform, senderId, text]
        );
        conversationId = newConv.insertId;
      } else {
        conversationId = conv[0].id;
        await db.query(
          "UPDATE conversations SET last_message=?, last_message_at=NOW() WHERE id=?",
          [text, conversationId]
        );
      }

      await db.query(
        "INSERT INTO messages (conversation_id, direction, message_text, created_at) VALUES (?, 'incoming', ?, NOW())",
        [conversationId, text]
      );
    }
  }

  res.sendStatus(200);
});

/* REPLY */
router.post("/reply", async (req, res) => {
  const { platform, recipientId, message } = req.body;

  const [rows] = await db.query(
    "SELECT credentials FROM integrations WHERE platform=?",
    [platform]
  );

  const token = JSON.parse(rows[0].credentials).accessToken;

  await axios.post(
    `https://graph.facebook.com/v20.0/me/messages?access_token=${token}`,
    {
      recipient: { id: recipientId },
      message: { text: message }
    }
  );

  let [conv] = await db.query(
    "SELECT id FROM conversations WHERE sender_id=? AND platform=?",
    [recipientId, platform]
  );

  if (conv.length) {
    await db.query(
      "INSERT INTO messages (conversation_id, direction, message_text, created_at) VALUES (?, 'outgoing', ?, NOW())",
      [conv[0].id, message]
    );
  }

  res.json({ success: true });
});

/* LOAD INBOX */
router.get("/conversations", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM conversations ORDER BY last_message_at DESC"
  );
  res.json(rows);
});

router.get("/messages/:id", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
    [req.params.id]
  );
  res.json(rows);
});

module.exports = router;