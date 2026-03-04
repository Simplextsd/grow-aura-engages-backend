const db = require("../../db"); // apna db connection file

exports.handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    for (const entry of body.entry) {
      for (const event of entry.messaging) {

        // Only handle messages
        if (!event.message) continue;

        const senderId = event.sender.id;

        // Handle text
        let messageText = event.message.text || "";

        // Handle attachments (image, sticker etc)
        if (!messageText && event.message.attachments) {
          messageText = "[Attachment]";
        }

        console.log(`📩 Naya Message [Sender: ${senderId}]: ${messageText}`);

        try {
          // 1️⃣ Check if conversation exists
          let [existingConv] = await db.query(
            "SELECT id FROM conversations WHERE sender_id = ?",
            [senderId]
          );

          let conversationId;

          if (existingConv.length === 0) {
            // 2️⃣ Create conversation
            const [newConv] = await db.query(
              "INSERT INTO conversations (sender_id, last_message, last_message_at) VALUES (?, ?, NOW())",
              [senderId, messageText]
            );

            conversationId = newConv.insertId;

            console.log("🆕 New conversation created:", conversationId);
          } else {
            conversationId = existingConv[0].id;

            // Update last message
            await db.query(
              "UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?",
              [messageText, conversationId]
            );
          }

          // 3️⃣ Save message
          await db.query(
            "INSERT INTO messages (conversation_id, direction, message_text, created_at) VALUES (?, ?, ?, NOW())",
            [conversationId, "incoming", messageText]
          );

          console.log("✅ Message saved in DB");

        } catch (dbError) {
          console.error("❌ DB Error:", dbError);
        }
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return res.sendStatus(500);
  }
};
