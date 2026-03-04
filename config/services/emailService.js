const nodemailer = require("nodemailer");
const { ImapFlow } = require("imapflow");
const crypto = require("crypto");
const db = require("../db");

// =====================
// SECURITY (encrypt app password)
// =====================
const SECRET = process.env.EMAIL_SECRET_KEY; // set in .env
if (!SECRET) console.warn("⚠️ EMAIL_SECRET_KEY missing in .env");

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(String(SECRET)).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return `${iv.toString("hex")}:${enc}`;
}

function decrypt(payload) {
  const [ivHex, encHex] = String(payload).split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.createHash("sha256").update(String(SECRET)).digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(encHex, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

// =====================
// SMTP + IMAP verify
// =====================
async function verifySMTP({ smtp_host, smtp_port, email, app_password }) {
  const transporter = nodemailer.createTransport({
    host: smtp_host,
    port: Number(smtp_port),
    secure: false,         // ✅ for 587
    requireTLS: true,
    auth: { user: email, pass: app_password },
  });
  await transporter.verify();
  return true;
}

async function verifyIMAP({ imap_host, imap_port, email, app_password }) {
  const client = new ImapFlow({
    host: imap_host,
    port: Number(imap_port),
    secure: true,          // ✅ for 993
    auth: { user: email, pass: app_password },
    logger: false,
  });
  await client.connect();
  await client.logout();
  return true;
}

exports.testCredentials = async (body) => {
  const {
    smtp_host = "smtp.gmail.com",
    smtp_port = 587,
    imap_host = "imap.gmail.com",
    imap_port = 993,
    email,
    app_password,
  } = body;

  if (!email || !app_password) throw new Error("Missing email/app_password");

  const pass = String(app_password).replace(/\s/g, ""); // remove spaces
  await verifySMTP({ smtp_host, smtp_port, email, app_password: pass });
  await verifyIMAP({ imap_host, imap_port, email, app_password: pass });

  return { message: "SMTP & IMAP authenticated ✅" };
};

exports.connectAndSave = async (body) => {
  const {
    business_id,
    smtp_host = "smtp.gmail.com",
    smtp_port = 587,
    imap_host = "imap.gmail.com",
    imap_port = 993,
    email,
    app_password,
  } = body;

  if (!business_id) throw new Error("Missing business_id");
  if (!email || !app_password) throw new Error("Missing email/app_password");
  if (!SECRET) throw new Error("EMAIL_SECRET_KEY missing in .env");

  const pass = String(app_password).replace(/\s/g, "");

  // 1) Verify
  await verifySMTP({ smtp_host, smtp_port, email, app_password: pass });
  await verifyIMAP({ imap_host, imap_port, email, app_password: pass });

  // 2) Save encrypted
  const encryptedPass = encrypt(pass);

  await db.query(
    `INSERT INTO email_integrations
      (business_id, email_address, smtp_host, smtp_port, imap_host, imap_port, encrypted_password, status, last_sync_uid)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', 0)
     ON DUPLICATE KEY UPDATE
      email_address=VALUES(email_address),
      smtp_host=VALUES(smtp_host),
      smtp_port=VALUES(smtp_port),
      imap_host=VALUES(imap_host),
      imap_port=VALUES(imap_port),
      encrypted_password=VALUES(encrypted_password),
      status='connected'`,
    [business_id, email, smtp_host, smtp_port, imap_host, imap_port, encryptedPass]
  );

  return { message: "Connected & saved ✅" };
};

// =====================
// Sync inbox → contacts + conversations + messages
// =====================
exports.syncInbox = async ({ business_id }) => {
  if (!business_id) throw new Error("Missing business_id");

  const [rows] = await db.query(
    "SELECT * FROM email_integrations WHERE business_id=? AND status='connected' LIMIT 1",
    [business_id]
  );
  if (!rows.length) throw new Error("No connected email integration found");

  const integration = rows[0];
  const email = integration.email_address;
  const pass = decrypt(integration.encrypted_password);

  const client = new ImapFlow({
    host: integration.imap_host,
    port: Number(integration.imap_port),
    secure: true,
    auth: { user: email, pass },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const lastUid = Number(integration.last_sync_uid || 0);
    const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";

    let fetched = 0;
    let inserted = 0;
    let maxUid = lastUid;

    for await (const msg of client.fetch(range, { uid: true, envelope: true, source: true })) {
      fetched++;
      const uid = msg.uid;
      maxUid = Math.max(maxUid, uid);

      const from = msg.envelope?.from?.[0];
      const fromEmail = from?.address;
      const fromName = from?.name;
      const subject = msg.envelope?.subject || "(no subject)";
      const date = msg.envelope?.date || new Date();

      if (!fromEmail) continue;

      // prevent duplicate
      const [dup] = await db.query(
        "SELECT id FROM messages WHERE business_id=? AND email_uid=? LIMIT 1",
        [business_id, uid]
      );
      if (dup.length) continue;

      // upsert contact
      const [c] = await db.query(
        "SELECT id FROM contacts WHERE business_id=? AND email=? LIMIT 1",
        [business_id, fromEmail]
      );
      let contactId;
      if (c.length) {
        contactId = c[0].id;
      } else {
        const [ins] = await db.query(
          "INSERT INTO contacts (business_id, name, email, source, created_at) VALUES (?, ?, ?, 'email', NOW())",
          [business_id, fromName || fromEmail, fromEmail]
        );
        contactId = ins.insertId;
      }

      // conversation per contact (simple)
      const [conv] = await db.query(
        "SELECT id FROM conversations WHERE sender_id=? LIMIT 1",
        [fromEmail] // ✅ because your existing schema uses sender_id
      );

      let conversationId;
      if (conv.length) {
        conversationId = conv[0].id;
        await db.query(
          "UPDATE conversations SET last_message=?, last_message_at=NOW() WHERE id=?",
          [subject, conversationId]
        );
      } else {
        const [insConv] = await db.query(
          "INSERT INTO conversations (sender_id, last_message, last_message_at, created_at) VALUES (?, ?, NOW(), NOW())",
          [fromEmail, subject]
        );
        conversationId = insConv.insertId;
      }

      // save message (your messages table structure)
      await db.query(
        "INSERT INTO messages (conversation_id, direction, message_text, created_at, email_uid) VALUES (?, 'incoming', ?, NOW(), ?)",
        [conversationId, (msg.source || "").toString("utf8"), uid]
      );

      inserted++;
    }

    await db.query(
      "UPDATE email_integrations SET last_sync_uid=?, last_sync_at=NOW() WHERE business_id=?",
      [maxUid, business_id]
    );

    return { fetched, inserted, last_uid: maxUid };
  } finally {
    lock.release();
    await client.logout();
  }
};
exports.sendReply = async ({ business_id, to, subject, text }) => {
  const [rows] = await db.query(
    "SELECT * FROM email_integrations WHERE business_id=? AND status='connected' LIMIT 1",
    [business_id]
  );
  if (!rows.length) throw new Error("No connected email integration found");

  const integration = rows[0];
  const fromEmail = integration.email_address;
  const pass = decrypt(integration.encrypted_password);

  const transporter = nodemailer.createTransport({
    host: integration.smtp_host,
    port: Number(integration.smtp_port),
    secure: false,        // 587
    requireTLS: true,
    auth: { user: fromEmail, pass },
  });

  await transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    text,
  });

  return { message: "✅ Email sent successfully" };
};