const express = require("express");
const router = express.Router();
const bookingController = require("../config/controllers/bookingController");
console.log("Check Controller Functions:", bookingController);
router.post("/", bookingController.addBooking);
router.get("/all", bookingController.getBookings);

module.exports = router;