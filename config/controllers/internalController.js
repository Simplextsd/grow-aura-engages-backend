const internalModel = require("../../models/internalModel");

exports.getUsers = async (req, res) => {
  try {
    const users = await internalModel.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    const messages = await internalModel.getMessages(senderId, receiverId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { sender_id, receiver_id, message } = req.body;
    await internalModel.sendMessage(sender_id, receiver_id, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================
// ADD USER
// ==========================

exports.addUser = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await internalModel.addUser(name);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================
// DELETE USER
// ==========================

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await internalModel.deleteUser(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================
// CLEAR CHAT
// ==========================

exports.clearChat = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    await internalModel.clearChat(senderId, receiverId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================
// LOCK CHAT
// ==========================

exports.lockChat = async (req, res) => {
  try {
    const { sender_id, receiver_id } = req.body;
    await internalModel.lockChat(sender_id, receiver_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};