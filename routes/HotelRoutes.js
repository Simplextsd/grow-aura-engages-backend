const express = require("express");
const router = express.Router();
const { createHotelBooking, getAllHotels } = require("../config/controllers/HotelController");

// Frontend ki requests ko handle karne ke liye multiple paths
router.post(["/add", "/all"], createHotelBooking); 
router.get(["/", "/all"], getAllHotels); 

module.exports = router;