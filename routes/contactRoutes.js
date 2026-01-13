const express = require("express");
const router = express.Router();
const contactController = require("../config/controllers/contactController");

router.post("/add", contactController.addContact);      // Create
router.get("/all", contactController.getContacts);      // Read
router.put("/update/:id", contactController.updateContact); // Update
router.delete("/delete/:id", contactController.deleteContact); // Delete

module.exports = router;