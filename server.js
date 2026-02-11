require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const db = require("./config/db");

// ✅ App
const app = express();

// ✅ Routes
const messengerRoutes = require("./routes/messenger.routes.js");
const instagramRoutes = require("./routes/instagram.routes");

// ✅ Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ Health
app.get("/", (req, res) => res.json({ ok: true, message: "Server is Running" }));
app.get("/health", (req, res) => res.json({ status: "Server is healthy ✅" }));

/* ============================================================
    ✅ ROUTES
   ============================================================ */
try {
  app.use("/api/messenger", messengerRoutes);
  app.use("/api/instagram", instagramRoutes);

  app.use("/api/edit-bookings", require("./routes/editBooking"));
  app.use("/api/bookings", require("./routes/bookingRoutes"));
  app.use("/api/contacts", require("./routes/contactRoutes"));
  app.use("/api/packages", require("./routes/packageRoutes"));
  app.use("/api/auth", require("./routes/authRoutes"));
} catch (err) {
  console.error("❌ Route Loading Error:", err.message);
}

/* ============================================================
    ✅ USER MANAGEMENT (MySQL)
   ============================================================ */

// ✅ Create user
app.post(["/api/users", "/api/create-user"], async (req, res) => {
  const { full_name, name, email, password, role, permissions } = req.body;
  const displayName = (full_name || name || "").trim();

  try {
    if (!displayName || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, Email, Password required" });
    }

    const [existingUser] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsString = JSON.stringify(permissions || []);

    const sql =
      "INSERT INTO users (full_name, email, password, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, NOW())";

    await db.query(sql, [displayName, email, hashedPassword, role || "user", permissionsString]);

    res.json({
      success: true,
      message: `✅ User ${displayName} created successfully in MySQL.`,
    });
  } catch (err) {
    console.error("❌ Save Error:", err);
    res.status(500).json({
      success: false,
      message: "Database error during user creation",
      sqlMessage: err?.sqlMessage,
    });
  }
});

// ✅ Get all users (CRM table)
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, full_name, email, role, permissions, created_at FROM users ORDER BY id DESC"
    );

    const users = rows.map((u) => {
      let perms = [];
      try {
        perms = u.permissions ? JSON.parse(u.permissions) : [];
      } catch {
        perms = [];
      }
      return { ...u, permissions: perms };
    });

    res.json({ success: true, users });
  } catch (err) {
    console.error("❌ Users Fetch Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch users", sqlMessage: err?.sqlMessage });
  }
});

// ✅ Delete user
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);

    res.json({ success: true, message: "User deleted", affectedRows: result.affectedRows });
  } catch (err) {
    console.error("❌ Delete Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete user", sqlMessage: err?.sqlMessage });
  }
});

/* ============================================================
    ✅ PROFILE (simple: users table)
    GET /api/profile   -> current logged-in user
    PUT /api/profile
   ============================================================ */

// ✅ helper auth middleware (token optional)
function authOptional(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    // if no token, still allow (for now)
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = decoded;
    next();
  } catch (e) {
    req.user = null;
    next();
  }
}

// ✅ Get profile
app.get("/api/profile", authOptional, async (req, res) => {
  try {
    // If token not present, just return empty (so frontend doesn't crash)
    if (!req.user?.id) {
      return res.json({ full_name: "", email: "", company: "Grow Business Digital", phone: "" });
    }

    // users table me company/phone columns agar nahi hain to empty return
    const [rows] = await db.query(
      "SELECT id, full_name, email, company, phone FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) return res.json({ full_name: "", email: "", company: "Grow Business Digital", phone: "" });

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Profile Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch profile", sqlMessage: err?.sqlMessage });
  }
});

// ✅ Update profile
app.put("/api/profile", authOptional, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { full_name, company, phone } = req.body;

    await db.query(
      "UPDATE users SET full_name = ?, company = ?, phone = ? WHERE id = ?",
      [full_name || "", company || "", phone || "", req.user.id]
    );

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("❌ Profile Update Error:", err);
    res.status(500).json({ message: "Failed to update profile", sqlMessage: err?.sqlMessage });
  }
});

/* ============================================================
    ✅ LOGIN (your existing)
   ============================================================ */

const userPermissions = {
  admin: [
    "Dashboard","Contacts","Bookings","Packages","Itineraries","Pipeline","Tasks","Marketing","Campaigns","Messages",
    "Segments","Lead Forms","Workflows","Business","Reputation","Invoices","Courses","Calls","System","AI Assistant","Reports","Settings",
  ],
  user: ["Dashboard", "Contacts", "Bookings", "Packages", "AI Assistant", "Reports", "Courses"],
  guest: ["Dashboard", "Marketing", "Campaigns", "Messages", "Calls", "Bookings", "Packages", "AI Assistant"],
};

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const validUsers = {
    "admin@test.com": "admin123",
    "darluharm@test.com": "dar123",
    "alburaq@test.com": "albu123",
  };

  if (validUsers[email] && validUsers[email] === password) {
    return res.status(200).json({
      success: true,
      message: "✅ Login successful",
      token: "static-token-" + email,
      user: {
        id: 999,
        email: email,
        fullName: "Admin User",
        role: "admin",
        pages: userPermissions["admin"],
      },
    });
  }

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

    let dbPages = [];
    try {
      dbPages = user.permissions ? JSON.parse(user.permissions) : userPermissions[user.role] || [];
    } catch (e) {
      dbPages = userPermissions[user.role] || [];
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        pages: dbPages,
      },
    });
  } catch (err) {
    console.error("❌ Login DB Error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/* ============================================================
    ✅ GLOBAL ERROR HANDLER
   ============================================================ */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err?.message || String(err),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
