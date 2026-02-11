const express = require("express");
const router = express.Router();
const contactController = require("../config/controllers/contactController");

router.post("/add", contactController.addContact);
router.get("/all", contactController.getContacts);
router.put("/update/:id", contactController.updateContact);
router.delete("/delete/:id", contactController.deleteContact);

module.exports = router;