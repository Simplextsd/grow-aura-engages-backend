const express = require("express");
const router = express.Router();

// ✅ Correct path
const bookingController = require("../config/controllers/bookingController");

// GET all invoices
router.get("/", bookingController.getBookings);

// For safety
router.get("/all", bookingController.getBookings);

// Create invoice / booking
router.post("/", bookingController.addBooking);

// Download PDF
router.get("/download/:id", bookingController.downloadBookingPdf);

// Get by ID
router.get("/:id", bookingController.getBookingById);

// Lock booking
router.post("/:id/lock", bookingController.lockBooking);

module.exports = router;
