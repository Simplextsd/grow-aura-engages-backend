const express = require("express");
const router = express.Router();
const uniboxController = require('../config/controllers/uniboxController');

router.get("/threads", uniboxController.getThreads);
router.get("/conversation/:id", uniboxController.getConversation);
router.post("/reply", uniboxController.sendReply);

module.exports = router;