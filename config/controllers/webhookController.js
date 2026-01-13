const express = require("express");
const router = express.Router();
// Controller ka sahi path (config folder ke andar)
const webhookController = require("../config/controllers/webhookController");

// 1. Webhook Verification (Meta ko verify karne ke liye)
router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // "Verify Token" wahi hona chahiye jo aapne CRM mein likha hai
    if (mode && token === "mycrmtoken123") { 
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Incoming Messages Handle karna
router.post("/", webhookController.handleIncomingMessage);

module.exports = router;