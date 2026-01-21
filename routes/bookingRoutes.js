const express = require("express");
const router = express.Router();
const bookingController = require("../config/controllers/bookingController");

// Debugging ke liye: Agar ye console mein 'undefined' aaye to matlab path galat hai
console.log("Check Controller Functions:", bookingController);

// Route for adding booking
router.post("/", bookingController.addBooking);

// Route for getting all bookings (Aapka frontend /api/bookings/all par call kar raha hai)
router.get("/all", bookingController.getBookings);

module.exports = router;