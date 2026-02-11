const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: "crm_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
const db = pool.promise();
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ connection failed:", err.message);
  } else {
    console.log("✅ Connected to successfully.");
    connection.release();
  }
});
module.exports = db;