// 🔹 ENV load
require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// 🔹 PDF Libraries
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

// 🔹 MySQL connection
const db = require("./config/db"); 

// 🔹 APP define
const app = express();

/**
 * 🚀 FIX: PayloadTooLargeError
 * Image upload ke liye limit barha di gayi hai (50mb)
 */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

/* ============================================================
    ✅ ROUTES CONFIGURATION
   ============================================================ */

const editBookingRoute = require("./routes/editBooking");
app.use("/api/edit-bookings", editBookingRoute); 

const bookingRoutes = require("./routes/bookingRoutes"); 
app.use("/api/bookings", bookingRoutes); 

app.use("/api/contacts", require("./routes/contactRoutes"));
app.use("/api/packages", require("./routes/packageRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));

/* ============================================================
    🚀 NEW: UPDATE BOOKING FROM DIALOG (MASTERS LOGIC)
   ============================================================ */

// Is route ko maine add kiya hai jo aapke edit dialog ko handle karega
app.put("/api/bookings/update/:id", async (req, res) => {
  const bookingId = req.params.id;
  const data = req.body;

  const sql = `
    UPDATE bookings SET 
      customerName = ?, 
      travelDate = ?, 
      returnDate = ?, 
      status = ?, 
      airline = ?, 
      flightNo = ?, 
      depCity = ?, 
      arrCity = ?, 
      depTime = ?, 
      arrTime = ?, 
      hotelName = ?, 
      roomType = ?, 
      mealPlan = ?, 
      checkIn = ?, 
      checkOut = ?, 
      vehicle = ?, 
      pickup = ?, 
      dropoff = ?, 
      paxCount = ?, 
      specialRequests = ?
    WHERE id = ?`;

  const values = [
    data.customerName,
    data.travelDate,
    data.returnDate || null,
    data.status,
    data.airline || "",
    data.flightNo || "",
    data.depCity || "",
    data.arrCity || "",
    data.depTime || null,
    data.arrTime || null,
    data.hotelName || "",
    data.roomType || "",
    data.mealPlan || "",
    data.checkIn || null,
    data.checkOut || null,
    data.vehicle || "",
    data.pickup || "",
    data.dropoff || "",
    data.paxCount || 1,
    data.specialRequests || "",
    bookingId
  ];

  try {
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    console.log(`✅ Booking ${bookingId} updated successfully`);
    res.status(200).json({ success: true, message: "Booking updated successfully" });
  } catch (err) {
    console.error("❌ MySQL Update Error:", err.message);
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

/* ============================================================
    🚀 SAVE BOOKING FROM DIALOG
   ============================================================ */

app.post("/api/bookings/create", async (req, res) => {
  const { 
    customerName, 
    packageId, 
    travelDate, 
    totalAmount, 
    status, 
    flightDetails, 
    hotelDetails, 
    transportDetails, 
    specialRequests 
  } = req.body;

  const sql = `INSERT INTO bookings 
    (customerName, packageId, travelDate, totalAmount, status, flight_details, hotel_details, transport_details, specialRequests) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  try {
    const [result] = await db.query(sql, [
      customerName,
      packageId || "Custom",
      travelDate,
      totalAmount,
      status || "Pending",
      JSON.stringify(flightDetails || []),    
      JSON.stringify(hotelDetails || []),     
      JSON.stringify(transportDetails || []), 
      specialRequests || ""
    ]);

    console.log("✅ New Booking Saved ID:", result.insertId);
    res.status(200).json({ 
      success: true, 
      message: "✅ Booking saved successfully to CRM", 
      id: result.insertId 
    });
  } catch (err) {
    console.error("❌ MySQL Booking Error:", err.message);
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

/* ============================================================
    🗺️ 6. ITINERARIES MANAGEMENT API (FIXED FOR PROMISES)
   ============================================================ */

app.post("/api/itineraries/add", async (req, res) => {
  const { booking_id, itinerary_name, description, start_date, end_date, destinations } = req.body;

  const sql = `INSERT INTO itineraries 
    (booking_id, itinerary_name, description, start_date, end_date, destinations) 
    VALUES (?, ?, ?, ?, ?, ?)`;

  try {
    const [result] = await db.query(sql, [booking_id, itinerary_name, description, start_date, end_date, destinations]);
    console.log("✅ Itinerary Saved ID:", result.insertId);
    res.status(200).json({ 
      message: "✅ Itinerary saved successfully", 
      id: result.insertId 
    });
  } catch (err) {
    console.error("❌ MySQL Error:", err.message);
    res.status(500).json({ error: "Failed to save itinerary in database" });
  }
});

app.get("/api/itineraries", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM itineraries ORDER BY id DESC");
    res.json(results);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

/* ============================================================
    📄 7. INVOICES MANAGEMENT API (WITH PDF GENERATION)
   ============================================================ */

app.post("/api/invoices", async (req, res) => {
  const { 
    customer_name, 
    template_id, 
    total_amount, 
    paid_amount, 
    balance_amount, 
    status, 
    payment_method, 
    due_date, 
    items 
  } = req.body;

  try {
    const sqlInvoice = `INSERT INTO invoices 
      (customer_name, template_id, total_amount, paid_amount, balance_amount, status, payment_method, due_date, items_json) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const itemsData = typeof items === 'string' ? items : JSON.stringify(items);

    const [invResult] = await db.query(sqlInvoice, [
      customer_name,
      template_id,
      total_amount,
      paid_amount,
      balance_amount,
      status || 'sent',
      payment_method,
      due_date || null,
      itemsData
    ]);

    console.log("✅ Invoice Saved ID:", invResult.insertId);
    res.status(200).json({ 
      success: true,
      message: "✅ Invoice successfully saved to MySQL", 
      id: invResult.insertId 
    });

  } catch (err) {
    console.error("❌ Invoice Save Error:", err.message);
    res.status(500).json({ error: "Failed to save invoice: " + err.message });
  }
});

app.get("/api/invoices/download/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).send("Invoice Not Found");
    
    const inv = rows[0];
    const items = JSON.parse(inv.items_json || '{"flights":[], "hotels":[], "transport":[]}');
    const doc = new jsPDF();

    doc.setFontSize(22); doc.setTextColor(255, 100, 0);
    doc.text("TRAVEL ERP INVOICE", 105, 20, { align: "center" });
    
    doc.setFontSize(10); doc.setTextColor(0, 0, 0);
    doc.text(`Customer: ${inv.customer_name}`, 20, 40);
    doc.text(`Invoice ID: #INV-${inv.id}`, 20, 46);
    doc.text(`Date: ${new Date(inv.created_at).toLocaleDateString()}`, 150, 40);
    doc.text(`Status: ${inv.status.toUpperCase()}`, 150, 46);

    let currentY = 60;

    if (items.flights && items.flights.length > 0) {
      doc.text("Flight Details:", 20, currentY);
      doc.autoTable({
        startY: currentY + 2,
        head: [['Airline', 'Dep', 'Arr', 'Ref']],
        body: items.flights.map(f => [f.airline || '-', f.dep || '-', f.arr || '-', f.ref || '-']),
        headStyles: { fillColor: [255, 100, 0] }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    const finalY = currentY + 10;
    doc.text(`Total Amount: $${inv.total_amount}`, 140, finalY);
    doc.text(`Paid Amount: $${inv.paid_amount}`, 140, finalY + 7);
    doc.setFont(undefined, 'bold');
    doc.text(`Balance Due: $${inv.balance_amount}`, 140, finalY + 14);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${inv.id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).send("PDF Error: " + err.message);
  }
});

app.get("/api/invoices", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM invoices ORDER BY id DESC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "DB error fetching invoices" });
  }
});

app.get("/api/templates", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM invoice_templates ORDER BY id ASC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "DB error fetching templates" });
  }
});

/* ============================================================
    📚 8. NEW: COURSE & TRAINING MANAGEMENT API 
   ============================================================ */

app.get("/api/courses/all", async (req, res) => {
  try {
    const sql = `
      SELECT c.*, 
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lesson_count,
      (SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id = c.id) as student_count
      FROM courses c 
      ORDER BY c.created_at DESC`;
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error("❌ MySQL Fetch Error:", err.message);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

app.post("/api/courses/create", async (req, res) => {
  const { title, description, thumbnail_url, target_audience, duration } = req.body;
  const sql = "INSERT INTO courses (title, description, thumbnail_url, target_audience, duration, is_published) VALUES (?, ?, ?, ?, ?, 1)";
  
  try {
    const [result] = await db.query(sql, [title, description, thumbnail_url, target_audience, duration]);
    console.log("✅ New Course Added to MySQL! ID:", result.insertId);
    res.status(200).json({ success: true, message: "✅ Course Created", id: result.insertId });
  } catch (err) {
    console.error("❌ MySQL Error during create:", err.message);
    res.status(500).json({ error: "MySQL issue: " + err.message });
  }
});

app.post("/api/courses/lessons/add", async (req, res) => {
  const { course_id, title, video_url, description } = req.body;
  const sql = "INSERT INTO lessons (course_id, title, content_url, description) VALUES (?, ?, ?, ?)";
  try {
    const [result] = await db.query(sql, [course_id, title, video_url, description]);
    res.json({ message: "✅ Lesson Added", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Lesson add nahi ho saka" });
  }
});

/* ================================
    🔑 Permissions Map
   ================================ */
const userPermissions = {
  admin: [
    "Dashboard", "Contacts", "Bookings", "Packages", "Itineraries",
    "Pipeline", "Tasks", "Marketing", "Campaigns", "Messages",
    "Segments", "Lead Forms", "Workflows", "Business", "Reputation",
    "Invoices", "Courses", "Calls", "System", "AI Assistant",
    "Reports", "Settings"
  ],
  user: ["Dashboard", "Contacts", "Bookings", "Packages", "AI Assistant", "Reports", "Courses"],
  guest: ["Dashboard", "Marketing", "Campaigns", "Messages", "Calls", "Bookings", "Packages", "AI Assistant"],
};

/* ================================
    🧱 1. AUTO CREATE DEFAULT USERS
   ================================ */
async function setupDefaultUsers() {
  try {
    const saltRounds = 10;
    const users = [
      { email: "admin@test.com", username: "Khazir", fullName: "Admin Khazir", password: "admin123", role: "admin" },
      { email: "user@test.com", username: "User1", fullName: "Regular User", password: "123456", role: "user" },
      { email: "seo@test.com", username: "Awais", fullName: "Awais SEO", password: "seo123", role: "guest" },
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, saltRounds);
      await db.query(
        `INSERT INTO users (username, email, password, fullName, role)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           username=VALUES(username), fullName=VALUES(fullName),
           password=VALUES(password), role=VALUES(role)`,
        [user.username, user.email, hash, user.fullName, user.role]
      );
    }
    console.log("✅ Default users ready (MySQL)");
  } catch (err) {
    console.log("❌ Setup Error:", err.message);
  }
}

/* ================================
    🔐 2. LOGIN API
   ================================ */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ error: "Email nahi mila" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Password galat hai" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1d" }
    );

    res.json({
      message: "✅ Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        pages: userPermissions[user.role] || [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

/* ================================
    📝 3. SIGNUP API
   ================================ */
app.post("/signup", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (email, password, fullName, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, fullName, role]
    );
    res.status(201).json({ message: "✅ User created successfully" });
  } catch (err) {
    res.status(500).json({ error: "❌ Signup failed" });
  }
});

/* ================================
    📄 4. USER PAGES API
   ================================ */
app.get("/api/my-pages/:email", async (req, res) => {
  try {
    const [users] = await db.query("SELECT role FROM users WHERE email = ?", [req.params.email]);
    if (users.length === 0) return res.status(404).json({ error: "User nahi mila" });
    const role = users[0].role;
    res.json({ role, pages: userPermissions[role] });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

/* ================================
    ➕ 5. HEALTH & MANAGEMENT
   ================================ */
app.get("/health", (req, res) => {
  res.json({ status: "Server is healthy ✅", timestamp: new Date() });
});

app.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const [result] = await db.query("UPDATE users SET password = ? WHERE email = ?", [hashed, email]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "User nahi mila" });
    res.json({ message: "✅ Password updated" });
  } catch (err) {
    res.status(500).json({ error: "❌ Password reset failed" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, username, email, fullName, role FROM users");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

/* ================================
    🚀 SERVER START
   ================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  setupDefaultUsers(); 
});