// 🔹 ENV load
require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// 🔹 MySQL connection
const db = require("./config/db"); 

// 🔹 APP define
const app = express();
app.use(express.json());
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
    📄 7. INVOICES MANAGEMENT API (UPDATED FOR CUSTOMER NAME)
   ============================================================ */

// 🔹 Create Invoice with Items
app.post("/api/invoices", async (req, res) => {
  const { 
    invoice_number, status, total_amount, due_date, notes, 
    contact_id, customer_name, // 👈 Dono field receive ho rahi hain
    template_id, tax_amount, includes_atol, items 
  } = req.body;

  try {
    // 1. Save Main Invoice (Added customer_name column in SQL)
    const sqlInvoice = `INSERT INTO invoices 
      (invoice_number, status, total_amount, due_date, notes, contact_id, customer_name, template_id, tax_amount, includes_atol) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const [invResult] = await db.query(sqlInvoice, [
      invoice_number, 
      status || 'draft', 
      total_amount, 
      due_date, 
      notes, 
      contact_id || null, // Agar contact select nahi kiya toh null jayega
      customer_name,      // 👈 Typing wala customer name yahan save hoga
      template_id, 
      tax_amount, 
      includes_atol ? 1 : 0
    ]);

    const invoiceId = invResult.insertId;

    // 2. Save Invoice Items (Bulk Insert)
    if (items && items.length > 0) {
      const itemSql = "INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ?";
      const itemValues = items.map(item => [
        invoiceId, item.description, item.quantity, item.unit_price, item.total_price
      ]);
      await db.query(itemSql, [itemValues]);
    }

    res.status(200).json({ message: "✅ Invoice and items saved to MySQL", id: invoiceId });
  } catch (err) {
    console.error("❌ Invoice Error:", err.message);
    res.status(500).json({ error: "Failed to save invoice: " + err.message });
  }
});

// 🔹 Get All Invoices
app.get("/api/invoices", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM invoices ORDER BY id DESC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "DB error fetching invoices" });
  }
});

// 🔹 Get All Invoice Templates
app.get("/api/templates", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM invoice_templates ORDER BY id ASC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "DB error fetching templates" });
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