const express = require("express");
const router = express.Router();
const db = require("../config/db");

// 🔹 1. Naya Package Add Karne Ke Liye (POST)
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

        // Validation: Zaroori fields check karein
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
            // Agar included_services object hai to stringify karein
            typeof included_services === 'object' ? JSON.stringify(included_services) : included_services 
        ];

        const [result] = await db.execute(sql, values);
        console.log("✅ Data Saved to MySQL - ID:", result.insertId);
        
        res.status(201).json({ 
            success: true,
            message: "✅ Data saved to MySQL Database!", 
            id: result.insertId 
        });
        
    } catch (err) {
        console.error("❌ MySQL Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 🔹 2. Saare Packages Dekhne Ke Liye (GET)
router.get("/all", async (req, res) => {
    try {
        // Latest packages pehle dikhane ke liye ORDER BY id DESC
        const [rows] = await db.query("SELECT * FROM packages ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;