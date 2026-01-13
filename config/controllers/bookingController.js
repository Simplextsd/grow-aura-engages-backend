const db = require("../db");

// 🟢 1. CREATE (Add Booking)
exports.addBooking = async (req, res) => {
  try {
    const { customerName, packageId, travelDate, returnDate, numberOfTravelers, totalAmount, specialRequests } = req.body;

    const sql = `INSERT INTO bookings 
      (customerName, packageId, travelDate, returnDate, numberOfTravelers, totalAmount, specialRequests, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      customerName || "Walking Client", 
      packageId || "Adventure", 
      travelDate || new Date().toISOString().split('T')[0], 
      returnDate || travelDate,
      numberOfTravelers || 1,
      totalAmount || 0,
      specialRequests || "",
      "Pending"
    ];

    const [result] = await db.query(sql, values);
    res.status(201).json({ message: "✅ Booking saved successfully!", id: result.insertId });

  } catch (err) {
    console.error("❌ SQL Insert Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔵 2. READ (Get All)
exports.getBookings = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bookings ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🟡 3. UPDATE (Edit Booking) - 100% Fixed for Package & Travelers
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
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

    // Backend Console log taake aap Terminal mein dekh sakein data aa raha hai
    console.log(`Updating ID ${id}: Package=${packageId}, Travelers=${numberOfTravelers}`);

    const sql = `UPDATE bookings SET 
      customerName = ?, 
      packageId = ?, 
      travelDate = ?, 
      returnDate = ?, 
      numberOfTravelers = ?, 
      totalAmount = ?, 
      specialRequests = ?, 
      status = ? 
      WHERE id = ?`;

    const values = [
      customerName, 
      packageId, 
      travelDate, 
      returnDate, 
      Number(numberOfTravelers), // Ensure it's a number
      totalAmount, 
      specialRequests, 
      status || 'Pending', 
      id
    ];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking record nahi mila!" });
    }

    res.json({ message: "✅ Booking updated successfully!" });
  } catch (err) {
    console.error("❌ Update SQL Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};