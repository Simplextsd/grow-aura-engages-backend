const express = require("express");
const router = express.Router();
const controller = require("../config/controllers/metaWebhookcontroller");
router.get("/meta", controller.verifyWebhook);
router.post("/meta", controller.receiveWebhook);

module.exports = router;