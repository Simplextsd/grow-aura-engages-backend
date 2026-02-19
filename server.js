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

// ✅ 1. Middlewares
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"] 
}));

// --- NGROK BYPASS MIDDLEWARE ---
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// JSON limit barha di hai taake Base64 images/vouchers save ho saken
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ 2. Health Check
app.get("/", (req, res) => res.json({ ok: true, message: "Server is Running" }));
app.get("/health", (req, res) => res.json({ status: "Server is healthy ✅" }));

/* ============================================================
    ✅ HOTEL & PACKAGE BOOKING LOGIC (MUKAMMAL CRUD)
   ============================================================ */

// 1. ADD NEW PACKAGE/HOTEL (Frontend `CreateHotelDialog` support)
app.post(["/api/packages/add", "/api/packages/all", "/api/hotels/add"], async (req, res) => {
    try {
        const { category, price, image_url, included_services } = req.body;

        if (!category) {
            return res.status(400).json({ success: false, message: "Category is required" });
        }

        const servicesData = typeof included_services === 'object' 
            ? JSON.stringify(included_services) 
            : included_services;

        const sql = `
            INSERT INTO packages (
                category, 
                price, 
                image_url, 
                included_services, 
                created_at
            ) VALUES (?, ?, ?, ?, NOW())
        `;

        const [result] = await db.query(sql, [
            category,
            price || 0,
            image_url || null,
            servicesData
        ]);

        console.log("🏨 New Hotel/Package Saved:", result.insertId);

        res.status(201).json({ 
            success: true, 
            message: "Saved Successfully! ✅",
            bookingId: result.insertId 
        });

    } catch (err) {
        console.error("❌ Save Error:", err.message);
        res.status(500).json({ 
            success: false, 
            message: "Database Error", 
            error: err.message 
        });
    }
});

// 2. FETCH ALL (Fixes 404 for /api/hotels aur /api/packages/all)
app.get(["/api/packages/all", "/api/hotels/all", "/api/hotels"], async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM packages ORDER BY created_at DESC");
        
        const formattedRows = rows.map(item => ({
            ...item,
            included_services: item.included_services ? JSON.parse(item.included_services) : {}
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to fetch hotels/packages" });
    }
});

// 3. UPDATE PACKAGE/HOTEL
app.put("/api/packages/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { category, price, image_url, included_services } = req.body;
        const servicesData = typeof included_services === 'object' ? JSON.stringify(included_services) : included_services;

        const sql = `UPDATE packages SET category = ?, price = ?, image_url = ?, included_services = ? WHERE id = ?`;
        await db.query(sql, [category, price, image_url, servicesData, id]);

        res.json({ success: true, message: "Updated successfully! ✅" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. DELETE PACKAGE/HOTEL
app.delete("/api/packages/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM packages WHERE id = ?", [id]);
        res.json({ success: true, message: "Deleted successfully! 🗑️" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ============================================================
    ✅ FACEBOOK MESSENGER WEBHOOK (VERIFICATION & RECEIVER)
   ============================================================ */

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "my_secret_crm_2026"; 
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object === 'page' || body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
            if (!entry.messaging) continue;
            for (const webhook_event of entry.messaging) {
                if (!webhook_event.message) continue;
                const senderId = webhook_event.sender.id;
                let messageText = webhook_event.message.text || "";
                if (!messageText && webhook_event.message.attachments) {
                    messageText = "[Attachment]";
                }
                try {
                    const [existingConv] = await db.query("SELECT id FROM conversations WHERE sender_id = ?", [senderId]);
                    let conversationId;
                    if (existingConv.length === 0) {
                        const [newConv] = await db.query(
                            "INSERT INTO conversations (sender_id, last_message, last_message_at, created_at) VALUES (?, ?, NOW(), NOW())",
                            [senderId, messageText]
                        );
                        conversationId = newConv.insertId;
                    } else {
                        conversationId = existingConv[0].id;
                        await db.query("UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?", [messageText, conversationId]);
                    }
                    await db.query(
                        "INSERT INTO messages (conversation_id, direction, message_text, created_at) VALUES (?, ?, ?, NOW())",
                        [conversationId, "incoming", messageText]
                    );
                } catch (err) { console.error("❌ DB Save Error:", err.message); }
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }
    res.sendStatus(404);
});

/* ============================================================
    ✅ DASHBOARD & STATS ROUTES
   ============================================================ */

app.get("/api/bookings/all", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bookings ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/courses/all", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM courses ORDER BY id DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/contacts/stats", async (req, res) => {
  try {
    const [all] = await db.query("SELECT COUNT(*) as total FROM contacts");
    const [active] = await db.query("SELECT COUNT(*) as total FROM contacts WHERE status = 'active'");
    const total = all[0]?.total || 0;
    const activeCount = active[0]?.total || 0;
    res.json({ total, active: activeCount, inactive: total - activeCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
    ✅ USER MANAGEMENT
   ============================================================ */

app.post(["/api/users", "/api/create-user"], async (req, res) => {
  const { full_name, name, email, password, role, permissions } = req.body;
  const displayName = (full_name || name || "").trim();
  try {
    if (!displayName || !email || !password) return res.status(400).json({ success: false, message: "Required fields missing" });
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (full_name, email, password, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, NOW())", 
    [displayName, email, hashedPassword, role || "user", JSON.stringify(permissions || [])]);
    res.json({ success: true, message: `✅ User created.` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, full_name, email, role, permissions, created_at FROM users ORDER BY id DESC");
    const users = rows.map((u) => ({ ...u, permissions: u.permissions ? JSON.parse(u.permissions) : [] }));
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: "Fetch failed" }); }
});

app.delete("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true, message: "✅ Deleted" });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
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
    if (!req.user || !req.user.id) return res.json({ full_name: "Guest", email: "" });
    const [rows] = await db.query("SELECT id, full_name, email, company, phone FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    res.json(rows[0] || { full_name: "Guest" });
  } catch (err) { res.status(500).json({ message: "Profile Error" }); }
});

/* ============================================================
    ✅ ROUTE CONNECTORS
   ============================================================ */
try {
  app.use("/api/messenger", require("./routes/messenger.routes.js"));
  app.use("/api/instagram", require("./routes/instagram.routes"));
  app.use("/api/edit-bookings", require("./routes/editBooking"));
  app.use("/api/bookings", require("./routes/bookingRoutes"));
  app.use("/api/contacts", require("./routes/contactRoutes"));
  
  // ✅ Ye dono lines add karein taake 404 na aaye
  app.use("/api/packages", require("./routes/routeHotel")); 
  app.use("/api/hotels", require("./routes/routeHotel")); 

  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/invoices", require("./routes/invoiceRoutes"));
} catch (err) { 
  console.error("⚠️ Route Loading Error:", err.message); 
} { console.error("⚠️ Note: Some route files are missing, using internal routes."); }

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
    const dbPages = user.permissions ? JSON.parse(user.permissions) : userPermissions[user.role] || [];
    res.json({ success: true, token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, pages: dbPages } });
  } catch (err) { res.status(500).json({ error: "DB error" }); }
});

// ✅ 3. Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// ✅ 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CRM Server is Running on Port: ${PORT}`);
});