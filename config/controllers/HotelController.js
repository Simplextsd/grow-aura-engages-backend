const db = require("../config/db"); // Aapka MySQL connection

// Naya Hotel Save karne ke liye
exports.createHotelBooking = async (req, res) => {
  try {
    const { category, price, image_url, included_services } = req.body;
    
    // Data ko save karne se pehle stringify karna zaroori hai agar wo object hai
    const services = typeof included_services === 'object' 
      ? JSON.stringify(included_services) 
      : included_services;

    const sql = "INSERT INTO packages (category, price, image_url, included_services, created_at) VALUES (?, ?, ?, ?, NOW())";
    const [result] = await db.query(sql, [category, price || 0, image_url, services]);

    res.status(201).json({ success: true, message: "Saved to MySQL! ✅", id: result.insertId });
  } catch (error) {
    console.error("❌ Insert Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Saare Hotels Fetch karne ke liye (SAFE VERSION)
exports.getAllHotels = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM packages ORDER BY created_at DESC");
    
    const formatted = rows.map(r => {
      let parsedServices = {};
      
      if (r.included_services) {
        try {
          // Check: Agar pehle se object hai toh direct use karein, warna parse karein
          parsedServices = typeof r.included_services === 'string' 
            ? JSON.parse(r.included_services) 
            : r.included_services;
        } catch (e) {
          // AGAR DATABASE MEIN GALAT TEXT HAI ("hum ko fli..."):
          // Toh hum error parse karne ke bajaye usay khali object de denge taake app chale
          console.warn(`⚠️ Row ID ${r.id} has invalid JSON. Falling back to empty object.`);
          parsedServices = { info: r.included_services }; // Ya sirf {} rakhen
        }
      }

      return { 
        ...r, 
        included_services: parsedServices 
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Fetch Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};