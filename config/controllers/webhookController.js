const db = require("../db");

exports.verifyWebhook = (req, res) => {

  const VERIFY_TOKEN = "crm_verify_token";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
};

exports.receiveMessage = async (req, res) => {

  const entry = req.body.entry?.[0];
  const messaging = entry?.messaging?.[0];

  if (!messaging) return res.sendStatus(200);

  const sender = messaging.sender?.id;
  const message = messaging.message?.text;

  await db.query(
    "INSERT INTO messages (conversation_id, channel, message_text, direction) VALUES (?, ?, ?, ?)",
    [sender, "messenger", message, "incoming"]
  );

  res.sendStatus(200);
};