const express = require('express');
const router = express.Router();
module.exports = (db) => {
    router.post('/add', (req, res) => {
        const { booking_id, itinerary_name, description, start_date, end_date, destinations } = req.body;

        const sql = "INSERT INTO itineraries (booking_id, itinerary_name, description, start_date, end_date, destinations) VALUES (?, ?, ?, ?, ?, ?)";
        
        db.query(sql, [booking_id, itinerary_name, description, start_date, end_date, destinations], (err, result) => {
            if (err) {
                console.error(" Error:", err);
                return res.status(500).json({ error: " error occurred" });
            }
            res.status(200).json({ message: "Itinerary saved successfully!", id: result.insertId });
        });
    });

    return router;
};