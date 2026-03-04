require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const db = require("./config/db");

// ✅ QR Direct Route (Aapki file import ho rahi hai)
const qrDirect = require("./routes/qrdirect");

const app = express();

// --- Middleware Configuration ---
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
    "Cache-Control",
    "Pragma",
    "Expires"
  ]
}));

app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ Middleware to Authenticate Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        console.log("❌ Token missing!");
        return res.status(401).json({ message: "No token provided" });
    }

    const secret = process.env.JWT_SECRET || "default_secret";

    jwt.verify(token, secret, (err, user) => {
        if (err) {
            console.log("❌ Token Verification Failed:", err.message);
            return res.status(403).json({ message: "Token is not valid" });
        }
        req.user = user;
        next();
    });
}

// ------------------------------------------------------------------
// ✅ IMPORTANT: WHATSAPP QR ROUTE (Fixes "Cannot GET /api/whatsapp/qr")
// ------------------------------------------------------------------
app.use("/api/whatsapp", qrDirect);

// ✅ Integrations Save Logic
app.post("/api/integrations/save", authenticateToken, async (req, res) => {
    try {
        const { platform, credentials } = req.body;
        const userId = req.user.id;

        const sql = `
            INSERT INTO integrations (user_id, platform, credentials, status) 
            VALUES (?, ?, ?, 'connected')
            ON DUPLICATE KEY UPDATE 
            credentials = VALUES(credentials), 
            status = 'connected',
            last_sync_at = CURRENT_TIMESTAMP
        `;

        await db.query(sql, [userId, platform, JSON.stringify(credentials)]);
        res.json({ success: true, message: "Integration saved successfully! ✅" });
    } catch (err) {
        console.error("❌ Integration Save Error:", err.message);
        res.status(500).json({ success: false, message: "Database Error", error: err.message });
    }
});

app.get("/", (req, res) => res.json({ ok: true, message: "Server is Running" }));
app.get("/health", (req, res) => res.json({ status: "Server is healthy ✅" }));
app.get("/qr-test", (req, res) => res.json({ ok: true, example: "/w/test123" }));

// --- Packages & Hotels Routes ---
app.post(["/api/packages/add", "/api/packages/all", "/api/hotels/add"], async (req, res) => {
    try {
        const { category, price, image_url, included_services } = req.body;
        if (!category) return res.status(400).json({ success: false, message: "Category is required" });

        const servicesData = typeof included_services === 'object' ? JSON.stringify(included_services) : included_services;
        const sql = `INSERT INTO packages (category, price, image_url, included_services, created_at) VALUES (?, ?, ?, ?, NOW())`;

        const [result] = await db.query(sql, [category, price || 0, image_url || null, servicesData]);
        res.status(201).json({ success: true, message: "Saved Successfully! ✅", bookingId: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: "Database Error", error: err.message });
    }
});

app.get(["/api/packages/all", "/api/hotels/all", "/api/hotels"], async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM packages ORDER BY created_at DESC");
        const formattedRows = rows.map(item => ({
            ...item,
            included_services: item.included_services ? JSON.parse(item.included_services) : {}
        }));
        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch hotels/packages" });
    }
});

// ✅ Profile Update Route
app.put("/api/profile", authenticateToken, async (req, res) => {
    try {
        const { is_whatsapp_connected, whatsapp_number } = req.body;
        const userId = req.user.id;
        const sql = "UPDATE users SET is_whatsapp_connected = ?, whatsapp_number = ? WHERE id = ?";
        await db.query(sql, [is_whatsapp_connected, whatsapp_number, userId]);
        res.json({ success: true, message: "Profile updated!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ Profile Get Route (Consolidated)
app.get("/api/profile", authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, full_name, email, role, company, phone, is_whatsapp_connected, whatsapp_number FROM users WHERE id = ?", 
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/packages/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM packages WHERE id = ?", [id]);
        res.json({ success: true, message: "Deleted successfully! 🗑️" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Webhook Routes (Meta WhatsApp API) ---
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "Travexa_Secret_123"; 
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("✅ WEBHOOK_VERIFIED");
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
});

app.post('/webhook', async (req, res) => {
    const body = req.body;
    console.log("📩 Incoming Webhook:", JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const value = entry?.changes?.[0]?.value;
        const message = value?.messages?.[0];

        if (message) {
            const sender_number = message.from;
            const message_text = message.text?.body || "";
            const sender_name = value.contacts?.[0]?.profile?.name || "Unknown";

            try {
                const sql = "INSERT INTO messages (sender, message, name, type, created_at) VALUES (?, ?, ?, 'incoming', NOW())";
                await db.query(sql, [sender_number, message_text, sender_name]);
                console.log(`✅ Message from ${sender_name} saved.`);
            } catch (err) {
                console.error("❌ DB Webhook Error:", err.message);
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }
    res.sendStatus(404);
});

// ✅ Messages API
// Is API ko server.js mein replace kar dein
app.get('/api/whatsapp/messages', async (req, res) => {
    try {
        // Humne 'platform' column add kiya hai aur grouping ki hai taake 
        // ek hi bande ke 10 messages ki bajaye uska latest message dikhe list mein
        const sql = `
            SELECT m1.* FROM messages m1
            INNER JOIN (
                SELECT sender, MAX(created_at) as last_msg 
                FROM messages 
                WHERE platform = 'whatsapp' 
                GROUP BY sender
            ) m2 ON m1.sender = m2.sender AND m1.created_at = m2.last_msg
            ORDER BY m1.created_at DESC
        `;
        const [rows] = await db.query(sql);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// --- Other API Routes ---
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

// app.get("/api/users", async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT id, full_name, email, role, permissions, created_at FROM users ORDER BY id DESC");
//     const users = rows.map((u) => ({ ...u, permissions: u.permissions ? JSON.parse(u.permissions) : [] }));
//     res.json({ success: true, users });
//   } catch (err) { res.status(500).json({ success: false, message: "Fetch failed" }); }
// });

app.delete("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true, message: "✅ Deleted" });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// --- External Routes Integration ---


 try {

  app.use("/api/messenger", require("./routes/messenger.routes.js"));
  app.use("/api/instagram", require("./routes/instagram.routes"));
  app.use("/api/edit-bookings", require("./routes/editBooking"));
  app.use("/api/bookings", require("./routes/bookingRoutes"));
  app.use("/api/contacts", require("./routes/contactRoutes"));
  app.use("/api/email", require("./routes/emailRoutes"));
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/invoices", require("./routes/invoiceRoutes"));
  app.use("/api/integrations", require("./routes/integrationsroutes.js"));
  app.use("/", require("./routes/whatsapp.webhook.routes"));
  app.use("/api/campaigns", require("./routes/compaignsRoutes.js"));

  const reportsRoutes = require("./routes/reportsroutes");
  app.use("/api/reports", reportsRoutes);

  const segmentRoutes = require("./routes/segmentRoutes");
  app.use("/api/segments", segmentRoutes);

  const userRoutes = require("./routes/usersRoutes");
  app.use("/api", userRoutes);

  app.use("/api/profile", require("./routes/profileRoutes"));

  const dashboardRoutes = require("./routes/dashboardroutes");
  app.use("/api/dashboard", dashboardRoutes);

  const webhookRoutes = require("./routes/webhookRoutes");
  app.use("/api/webhook", webhookRoutes);
const integrationRoutes = require("./routes/integrationsroutes");

app.use("/api/integrations", integrationRoutes);
  app.use("/api/ai", require("./routes/aiRoutes.js"));

  // 🔥🔥🔥 YEH LINE ADD KARO
const internalChat = require("./routes/internalchat");

app.use("/api/chat", internalChat);
} catch (err) {
  console.error("Route Loading Error:");
  console.error(err.stack);
}
// --- Auth & Login Logic ---
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
    
const token = jwt.sign(
  { id: user.id, role: user.role }, 
  process.env.JWT_SECRET || "default_secret", 
  { expiresIn: "36500d" } 
);    const dbPages = user.permissions ? JSON.parse(user.permissions) : userPermissions[user.role] || [];
    
    res.json({ success: true, token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, pages: dbPages } });
  } catch (err) { res.status(500).json({ error: "DB error" }); }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// server.js ke andar chat history ka sahi logic
app.get('/api/whatsapp/chat-history/:number', authenticateToken, async (req, res) => {
    try {
        const { number } = req.params;
        const cleanNum = number.replace(/\D/g, ''); // Sirf digits

        // Dono taraf ki chat nikalne ke liye
        const sql = `
            SELECT id, direction, message_text, created_at 
            FROM messages 
            WHERE sender = ? OR (name = 'Me' AND sender = ?)
            ORDER BY created_at ASC
        `;
        const [rows] = await db.query(sql, [cleanNum, cleanNum]);
        
        // Frontend ki format ke mutabiq map karein
        const data = rows.map(m => ({
            id: m.id,
            direction: m.direction, 
            message_text: m.message_text,
            created_at: m.created_at
        }));

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 CRM Server is Running on Port: ${PORT}`);
    console.log(`🔗 WhatsApp QR logic is active on /api/whatsapp/qr`);
});