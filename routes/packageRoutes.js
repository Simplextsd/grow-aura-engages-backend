const express = require("express");
const router = express.Router();
const db = require("../config/db");
router.post("/add", async (req, res) => {
    try {
        const { 
            packageName, 
            destination, 
            duration, 
            price, 
            category, 
            maxTravelers, 
            description, 
            image_url, 
            included_services 
        } = req.body;

        if(!packageName || !price) {
            return res.status(400).json({ error: "Package Name and Price are required" });
        }

        const sql = `INSERT INTO packages 
        (packageName, destination, duration, price, category, maxTravelers, description, image_url, included_services) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            packageName, 
            destination, 
            duration, 
            price, 
            category, 
            maxTravelers || 1, 
            description, 
            image_url, 
            typeof included_services === 'object' ? JSON.stringify(included_services) : included_services 
        ];

        const [result] = await db.execute(sql, values);
        console.log("✅ Data Saved :", result.insertId);
        
        res.status(201).json({ 
            success: true,
            message: "✅ Data saved!", 
            id: result.insertId 
        });
        
    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});


router.get("/all", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM packages ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;