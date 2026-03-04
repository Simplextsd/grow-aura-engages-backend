import { db } from "../db/index.js";
import { io } from "../server.js";

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const receiveWebhook = async (req, res) => {
  try {
    const body = req.body;

    for (const entry of body.entry || []) {
      const page_id = entry.id;
      const events = entry.messaging || [];

      for (const ev of events) {
        const sender_id = ev.sender?.id;
        const msgText = ev.message?.text || null;
        const meta_message_id = ev.message?.mid || null;
        if (!sender_id) continue;

        // Find client by page_id
        const [pages] = await db.query(
          `SELECT client_id, platform, page_access_token
           FROM meta_pages WHERE page_id = ? AND is_connected = 1 LIMIT 1`,
          [page_id]
        );
        if (!pages?.[0]) continue;

        const { client_id, platform } = pages[0];

        // Conversation upsert
        const [convRows] = await db.query(
          `SELECT id FROM conversations WHERE platform=? AND page_id=? AND sender_id=? LIMIT 1`,
          [platform, page_id, sender_id]
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
            `INSERT INTO conversations (client_id, platform, page_id, sender_id, last_message, last_message_at)
             VALUES (?,?,?,?,?,NOW())`,
            [client_id, platform, page_id, sender_id, msgText || "[attachment]"]
          );
          conversation_id = ins.insertId;
        }

        // Insert message
        await db.query(
          `INSERT INTO messages
           (conversation_id, client_id, platform, page_id, sender_id, direction, message_type, message_text, meta_message_id)
           VALUES (?,?,?,?,?,'incoming','text',?,?)`,
          [conversation_id, client_id, platform, page_id, sender_id, msgText, meta_message_id]
        );

        // Socket notify
        io.to(`client:${client_id}`).emit("message:new", {
          conversation_id,
          client_id,
          platform,
          page_id,
          sender_id,
          direction: "incoming",
          text: msgText,
          created_at: new Date().toISOString()
        });
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
};
