const express = require("express");
const router = express.Router();

const aiController = require("../config/controllers/AiController");

router.post("/chat", aiController.chat);

module.exports = router;