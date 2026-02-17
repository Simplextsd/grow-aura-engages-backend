require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const db = require("./config/db");

// ✅ App Initialization
const app = express();

// ✅ 1. Middlewares (Backend Connection Fix)
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ 2. Health Check
app.get("/", (req, res) => res.json({ ok: true, message: "Server is Running" }));
app.get("/health", (req, res) => res.json({ status: "Server is healthy ✅" }));

/* ============================================================
    ✅ DASHBOARD & STATS ROUTES
   ============================================================ */

app.get("/api/bookings/all", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bookings ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/courses/all", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM courses ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/contacts/stats", async (req, res) => {
  try {
    const [all] = await db.query("SELECT COUNT(*) as total FROM contacts");
    const [active] = await db.query("SELECT COUNT(*) as total FROM contacts WHERE status = 'active'");
    const total = all[0]?.total || 0;
    const activeCount = active[0]?.total || 0;
    res.json({ total, active: activeCount, inactive: total - activeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
    ✅ USER MANAGEMENT (Create, Get, DELETE)
   ============================================================ */

// 1. Create User Logic
app.post(["/api/users", "/api/create-user"], async (req, res) => {
  const { full_name, name, email, password, role, permissions } = req.body;
  const displayName = (full_name || name || "").trim();
  try {
    if (!displayName || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, Email, Password required" });
    }
    const [existingUser] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) return res.status(400).json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsString = JSON.stringify(permissions || []);
    const sql = "INSERT INTO users (full_name, email, password, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
    await db.query(sql, [displayName, email, hashedPassword, role || "user", permissionsString]);
    res.json({ success: true, message: `✅ User ${displayName} created successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database error", error: err.message });
  }
});

// 2. Fetch Users Logic
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, full_name, email, role, permissions, created_at FROM users ORDER BY id DESC");
    const users = rows.map((u) => {
      let perms = [];
      try { perms = u.permissions ? JSON.parse(u.permissions) : []; } catch { perms = []; }
      return { ...u, permissions: perms };
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// 3. Delete User Logic (Ab user delete hoga 100%)
app.delete("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "User nahi mila" });
        }
        res.json({ success: true, message: "✅ User deleted successfully" });
    } catch (err) {
        console.error("❌ Delete Error:", err);
        res.status(500).json({ success: false, message: "Delete karne mein error", error: err.message });
    }
});

/* ============================================================
    ✅ PROFILE & AUTH
   ============================================================ */

function authOptional(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { req.user = null; return next(); }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = decoded;
    next();
  } catch (e) { req.user = null; next(); }
}

app.get("/api/profile", authOptional, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
        return res.json({ full_name: "Guest", email: "", company: "Grow Business Digital" });
    }
    const [rows] = await db.query("SELECT id, full_name, email, company, phone FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (rows.length === 0) return res.json({ full_name: "Guest", email: "" });
    res.json(rows[0]);
  } catch (err) { 
    res.status(500).json({ message: "Internal Server Error in Profile" }); 
  }
});

/* ============================================================
    ✅ EXISTING CRM ROUTES (Connecting all Files)
   ============================================================ */
try {
  app.use("/api/messenger", require("./routes/messenger.routes.js"));
  app.use("/api/instagram", require("./routes/instagram.routes"));
  app.use("/api/edit-bookings", require("./routes/editBooking"));
  app.use("/api/bookings", require("./routes/bookingRoutes"));
  app.use("/api/contacts", require("./routes/contactRoutes"));
  app.use("/api/packages", require("./routes/packageRoutes"));
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/invoices", require("./routes/invoiceRoutes"));
} catch (err) {
  console.error("❌ Route Loading Error:", err.message);
}

/* ============================================================
    ✅ LOGIN LOGIC
   ============================================================ */

const userPermissions = {
  admin: ["Dashboard","Contacts","Bookings","Packages","Itineraries","Pipeline","Tasks","Marketing","Campaigns","Messages","Segments","Lead Forms","Workflows","Business","Reputation","Invoices","Courses","Calls","System","AI Assistant","Reports","Settings"],
  user: ["Dashboard", "Contacts", "Bookings", "Packages", "AI Assistant", "Reports", "Courses"],
  guest: ["Dashboard", "Marketing", "Campaigns", "Messages", "Calls", "Bookings", "Packages", "AI Assistant"],
};

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ error: "Email nahi mila" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Password galat hai" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "default_secret", { expiresIn: "1d" });
    
    let dbPages = [];
    try {
      dbPages = user.permissions ? JSON.parse(user.permissions) : userPermissions[user.role] || [];
    } catch (e) { dbPages = userPermissions[user.role] || []; }

    res.json({ success: true, token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, pages: dbPages } });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CRM Server is Running on Port: ${PORT}`);
});