const db = require("../db");
const messengerService = require('../../services/messengerService');
const instagramService = require("../../services/instagramService");
const emailService = require("../../services/emailService");

exports.getThreads = async (req,res)=>{

  const [rows] = await db.query(`
    SELECT conversation_id,platform,
    MAX(created_at) as last_message_at,
    MAX(message_text) as preview
    FROM messages
    GROUP BY conversation_id,platform
  `);

  res.json(rows);

};


exports.getConversation = async (req,res)=>{

  const {id}=req.params;

  const [rows]=await db.query(
    "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
    [id]
  );

  res.json(rows);

};


exports.sendReply = async (req,res)=>{

  const {platform,conversationId,messageText}=req.body;

  if(platform==="facebook")
    await messengerService.send(conversationId,messageText);

  if(platform==="instagram")
    await instagramService.send(conversationId,messageText);

  if(platform==="email")
    await emailService.send(conversationId,messageText);

  await db.query(
    "INSERT INTO messages (conversation_id,platform,message_text,direction) VALUES (?,?,?,?)",
    [conversationId,platform,messageText,"outgoing"]
  );

  res.json({success:true});

};