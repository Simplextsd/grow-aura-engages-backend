const express = require("express");
const router = express.Router();
const webhookController = require("../config/controllers/webhookController");
router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token === "mycrmtoken123") {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});
router.post("/", webhookController.handleIncomingMessage);

module.exports = router;