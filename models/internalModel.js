const db = require("../config/db");

/* ==========================
   GET USERS
========================== */

exports.getUsers = async () => {

  const [rows] = await db.query(
    "SELECT id, name FROM chat_users ORDER BY id DESC"
  );

  return rows;

};

/* ==========================
   ADD USER
========================== */

exports.addUser = async (name) => {

  const [result] = await db.query(
    "INSERT INTO chat_users (name) VALUES (?)",
    [name]
  );

  return {
    id: result.insertId,
    name
  };

};

/* ==========================
   DELETE USER
========================== */

exports.deleteUser = async (id) => {

  await db.query(
    "DELETE FROM chat_users WHERE id = ?",
    [id]
  );

};

/* ==========================
   GET MESSAGES
========================== */

exports.getMessages = async (senderId, receiverId) => {

  const [rows] = await db.query(
    `SELECT * FROM internal_messages
     WHERE (sender_id=? AND receiver_id=?)
     OR (sender_id=? AND receiver_id=?)
     ORDER BY created_at ASC`,
    [senderId, receiverId, receiverId, senderId]
  );

  return rows;

};

/* ==========================
   SEND MESSAGE
========================== */

exports.sendMessage = async (senderId, receiverId, message) => {

  await db.query(
    "INSERT INTO internal_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
    [senderId, receiverId, message]
  );

};
/* ==========================
   CLEAR CHAT
========================== */

exports.clearChat = async (senderId, receiverId) => {

  await db.query(
    `DELETE FROM messages
     WHERE (sender_id=? AND receiver_id=?)
     OR (sender_id=? AND receiver_id=?)`,
    [senderId, receiverId, receiverId, senderId]
  );

};

/* ==========================
   LOCK CHAT
========================== */

exports.lockChat = async (senderId, receiverId) => {

  await db.query(
    `UPDATE internal_messages
     SET is_locked = 1
     WHERE sender_id=? AND receiver_id=?`,
    [senderId, receiverId]
  );

};