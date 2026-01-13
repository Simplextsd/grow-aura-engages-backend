const express = require("express");
const router = express.Router();

// ✅ Controller ka sahi path
const bookingController = require("../config/controllers/bookingController");

// 🟢 Route for Adding
router.post("/add", bookingController.addBooking);

// 🔵 Route for Fetching all
router.get("/all", bookingController.getBookings);

// 🟡 Route for Updating (Edit)
router.put("/update/:id", bookingController.updateBooking);

module.exports = router;