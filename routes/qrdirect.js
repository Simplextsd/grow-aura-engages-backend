const express = require('express');
const router = express.Router();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const db = require('../config/db');

let latestQR = "";

// ✅ LocalAuth se login/logout fast ho jayega aur session save rahega
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "travexa_session" }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('✅ QR Code Received!');
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) latestQR = url;
    });
});

client.on('ready', () => {
    console.log('🚀 WhatsApp Client is Ready!');
    latestQR = "CONNECTED";
});

// ✅ Incoming Message: Foran CRM mein dikhane ke liye DB mein save
client.on('message', async (msg) => {
    try {
        const contact = await msg.getContact();
        const senderNumber = contact.id.user; 
        const senderName = contact.pushname || "Customer";
        
        // Note: Column names 'message_text' pakka karein aapke table mein yahi hai
        const sql = `
            INSERT INTO messages (sender, message_text, name, platform, direction, created_at) 
            VALUES (?, ?, ?, 'whatsapp', 'incoming', NOW())
        `;
        
        await db.query(sql, [senderNumber, msg.body || "", senderName]);
        console.log(`✅ Message from ${senderNumber} saved to CRM.`);
    } catch (err) {
        console.error("❌ Incoming Save Error:", err);
    }
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Disconnected:', reason);
    latestQR = "";
    // Re-initiate after disconnect
    client.initialize(); 
});

client.initialize().catch(err => console.error('❌ Init Error:', err));

// --- API Routes ---

router.get('/qr', (req, res) => {
    if (latestQR === "CONNECTED") return res.json({ status: "connected" });
    if (latestQR) return res.json({ qr: latestQR });
    res.status(202).json({ message: "Generating..." });
});

// ✅ Fast Logout Route
router.post('/logout', async (req, res) => {
    try {
        await client.logout();
        latestQR = "";
        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ error: "Logout failed" });
    }
});

router.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: "Number and message are required" });
    }

    try {
        let cleanNumber = number.toString().replace(/\D/g, ''); 
        if (cleanNumber.length < 10) {
            return res.status(400).json({ error: "Invalid phone number" });
        }

        let chatId = `${cleanNumber}@c.us`;
        
        // 1. WhatsApp par message bhejien
        await client.sendMessage(chatId, message);

        // 2. DB mein Save karein (Outgoing) taake chat history mein dikhe
        const sql = `INSERT INTO messages (sender, message_text, name, platform, direction, created_at) VALUES (?, ?, 'Me', 'whatsapp', 'outgoing', NOW())`;
        await db.query(sql, [cleanNumber, message]);

        res.json({ success: true, message: "Sent and Saved!" });
    } catch (err) {
        console.error("❌ Send Error:", err.message);
        res.status(500).json({ success: false, error: "WhatsApp failed to deliver." });
    }
});

// Chat List (Groups latest messages)
router.get('/messages', async (req, res) => {
    try {
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
        res.status(500).json({ success: false, error: err.message });
    }
});

// History API
router.get('/chat/:number', async (req, res) => {
    try {
        const num = req.params.number.replace(/\D/g, '');
        const sql = `
            SELECT * FROM messages 
            WHERE (sender = ? OR sender = CONCAT(?, '@c.us'))
            AND platform = 'whatsapp'
            ORDER BY created_at ASC
        `;
        const [rows] = await db.query(sql, [num, num]);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;