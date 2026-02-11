const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.put("/update/:id", (req, res) => {
    const bookingId = req.params.id;

    const {
        customerName,
        packageId,
        travelDate,
        returnDate,
        numberOfTravelers,
        totalAmount,
        specialRequests,
        status
    } = req.body;
    const sql = `
        UPDATE bookings SET 
            customerName = ?, 
            packageId = ?, 
            travelDate = ?, 
            returnDate = ?, 
            numberOfTravelers = ?, 
            totalAmount = ?, 
            specialRequests = ?, 
            status = ? 
        WHERE id = ?
    `;

    db.query(sql, [
        customerName,
        packageId,
        travelDate,
        returnDate,
        numberOfTravelers,
        totalAmount,
        specialRequests,
        status,
        bookingId
    ], (err, result) => {
        if (err) {
            console.error("error:", err.message);
            return res.status(500).json({ error: "Update failed: " + err.message });
        }
        res.json({ success: true, message: "Booking updated!" });
    });
});

module.exports = router;