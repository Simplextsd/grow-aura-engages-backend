const nodemailer = require("nodemailer");
const db = require("../config/db");

exports.send = async (recipient,message)=>{

  const [rows]=await db.query(
    "SELECT credentials FROM integrations WHERE platform='email' LIMIT 1"
  );

  const creds = JSON.parse(rows[0].credentials);

  const transporter = nodemailer.createTransport({
    host:creds.smtpHost,
    port:creds.smtpPort,
    auth:{
      user:creds.emailUser,
      pass:creds.emailPass
    }
  });

  await transporter.sendMail({
    from:creds.emailUser,
    to:recipient,
    subject:"CRM Reply",
    text:message
  });

};