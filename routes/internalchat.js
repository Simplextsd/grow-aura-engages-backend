const express = require("express");
const router = express.Router();
const chatController = require("../config/controllers/internalController");

router.get("/users", chatController.getUsers);
router.get("/messages/:senderId/:receiverId", chatController.getMessages);

router.post("/send", chatController.sendMessage);

// NEW APIs
router.post("/add-user", chatController.addUser);
router.delete("/delete-user/:id", chatController.deleteUser);
router.delete("/clear-chat/:senderId/:receiverId", chatController.clearChat);
router.post("/lock-chat", chatController.lockChat);

module.exports = router;