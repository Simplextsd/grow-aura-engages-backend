const axios = require("axios");
const db = require("../config/db");

exports.send = async (recipient,message)=>{

  const [rows]=await db.query(
    "SELECT access_token FROM integrations WHERE platform='instagram' LIMIT 1"
  );

  const token = rows[0].access_token;

  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
    {
      recipient:{id:recipient},
      message:{text:message}
    }
  );

};