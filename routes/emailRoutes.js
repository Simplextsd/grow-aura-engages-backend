const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const db = require("../config/db");

router.post("/send", async (req, res) => {
  const { to, subject, message } = req.body;

  const [rows] = await db.query(
    "SELECT credentials FROM integrations WHERE platform='email'"
  );

  const creds = JSON.parse(rows[0].credentials);

  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    auth: {
      user: creds.emailUser,
      pass: creds.emailPass
    }
  });

  await transporter.sendMail({
    from: creds.emailUser,
    to,
    subject,
    text: message
  });

  res.json({ success: true });
});

module.exports = router;