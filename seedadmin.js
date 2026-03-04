const bcrypt = require("bcrypt");
const db = require("./config/db");

async function resetAdmin() {

  const hash = await bcrypt.hash("Gbd@1122334", 10);

  await db.query(
    "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
    ["GBD Admin", "Test@growbusinessdigital.com", hash, "admin"]
  );

  console.log("Admin Reset Done");
  process.exit();
}

resetAdmin();