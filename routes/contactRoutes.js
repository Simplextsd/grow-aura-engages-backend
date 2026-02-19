// const express = require("express");
// const router = express.Router();
// // 1. Yahan 'contactController' (c small) define kiya gaya hai
// const contactController = require('../config/controllers/contactController');
// // 2. Niche har jagah 'contactController' (c small) hi use hona chahiye
// router.get("/", contactController.getAllContacts);

// // Create Manual Contact
// router.post("/", contactController.createManualContact);

// // Website Live Chat Auto Save
// router.post("/webchat", contactController.webChatContact);

// // WhatsApp Webhook Verify
// router.get("/whatsapp/webhook", contactController.verifyWhatsAppWebhook);

// // WhatsApp Receive Messages
// router.post("/whatsapp/webhook", contactController.receiveWhatsAppMessage);

// // CSV Upload
// router.post("/upload", contactController.uploadCSV);

// router.post("/crm-chat", contactController.crmChatAutoSave);
// router.delete("/:id", contactController.deleteContact);

// module.exports = router;

const express = require("express");
const router = express.Router();

const contactController = require("../config/controllers/contactController");

// ✅ Only routes that actually exist in controller

router.get("/", contactController.getAllContacts);
router.post("/", contactController.createManualContact);
router.post("/upload", contactController.uploadCSV);
router.delete("/:id", contactController.deleteContact);

module.exports = router;
