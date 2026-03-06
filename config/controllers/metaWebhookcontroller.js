const db = require("../db");

exports.verifyWebhook = (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "TEST123") {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};


exports.receiveWebhook = async (req, res) => {

  try {

    console.log("📩 Webhook Hit:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    for (const entry of body.entry || []) {

      if (!entry.messaging) continue;

      for (const ev of entry.messaging) {

        const sender_id = ev.sender?.id;

        if (!sender_id) continue;

        // message text
        const text = ev.message?.text || "";

        console.log("📩 Messenger Message:", sender_id, text);

        try {

          await db.query(
            "INSERT INTO messages (conversation_id, platform, message_text, direction) VALUES (?,?,?,?)",
            [sender_id, "messenger", text, "incoming"]
          );

          console.log("✅ Message Saved");

        } catch (dbErr) {

          console.error("❌ DB Insert Error:", dbErr);

        }

      }

    }

    res.sendStatus(200);

  } catch (err) {

    console.error("❌ Webhook Error:", err);
    res.sendStatus(500);

  }

};