const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: "crm_db", // 👈 Yahan "crm" hata kar "crm_db" likhein
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise(); 

pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    // Ye message terminal mein check karein
    console.log("✅ Connected to MySQL database (crm_db) successfully.");
    connection.release();
  }
});

module.exports = db;