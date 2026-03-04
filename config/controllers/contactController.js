const db = require("../db");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 uploads folder created");
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const saveContactIfNotExists = async (contact) => {
  const [existing] = await db.query(
    "SELECT id FROM contacts WHERE phone = ?",
    [contact.phone]
  );

  if (existing.length === 0) {
    await db.query("INSERT INTO contacts SET ?", contact);
    return "Inserted";
  }

  return "Already Exists";
};

exports.getAllContacts = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM contacts ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("❌ Get Contacts Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createManualContact = async (req, res) => {
  try {
    if (!req.body.phone) {
      return res.status(400).json({ error: "Phone is required" });
    }

    const contact = {
      first_name: req.body.first_name || "",
      last_name: req.body.last_name || "",
      phone: req.body.phone.trim(),
      email: req.body.email || null,
      company: req.body.company || null,
      source: "manual",
      status: "active",
      tags: "manual_entry",
      profile_picture: null,
    };

    const result = await saveContactIfNotExists(contact);
    res.json({ message: result });
  } catch (err) {
    console.error("❌ Manual Contact Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   ✅ DELETE CONTACT
============================================================ */
exports.deleteContact = async (req, res) => {
  try {
    await db.query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete Contact Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   ✅ CSV UPLOAD (PRODUCTION READY)
============================================================ */
exports.uploadCSV = [
  upload.single("file"),

  async (req, res) => {
    try {
      console.log("📥 CSV Upload Route Hit");

      if (!req.file) {
        console.log("❌ No file received");
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("📄 Uploaded File:", req.file.originalname);

      const results = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
          results.push(row);
        })
        .on("end", async () => {
          console.log(`📊 Total Rows Found: ${results.length}`);

          let inserted = 0;
          let skipped = 0;

          for (let row of results) {
            const phone =
              row.phone ||
              row.Phone ||
              row.PHONE ||
              row.mobile ||
              row.Mobile ||
              row.MOBILE;

            if (!phone) {
              skipped++;
              continue;
            }

            const contact = {
              first_name:
                row.first_name ||
                row.First_Name ||
                row.name ||
                row.Name ||
                "",
              last_name:
                row.last_name ||
                row.Last_Name ||
                "",
              phone: phone.toString().trim(),
              email:
                row.email ||
                row.Email ||
                null,
              source: "csv",
              status: "active",
              tags: "csv_import",
              profile_picture: null,
            };

            const result = await saveContactIfNotExists(contact);
            if (result === "Inserted") inserted++;
            else skipped++;
          }

          // Delete uploaded file
          fs.unlinkSync(req.file.path);

          console.log("✅ CSV Upload Complete");
          console.log(`Inserted: ${inserted}`);
          console.log(`Skipped: ${skipped}`);

          res.json({
            success: true,
            inserted,
            skipped,
          });
        })
        .on("error", (err) => {
          console.error("❌ CSV Parse Error:", err.message);
          res.status(500).json({ error: "CSV parsing failed" });
        });
    } catch (err) {
      console.error("❌ CSV Upload Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
];

/* ============================================================
   ✅ CONTACT COUNT
============================================================ */
exports.getContactsCount = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM contacts");
    res.json({ total: rows[0].total });
  } catch (err) {
    console.error("❌ Contacts Count Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   ✅ UPDATE CONTACT 
============================================================ */
exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, company, status } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone is required" });
    }

    const updateQuery = `
      UPDATE contacts 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, company = ?, status = ?
      WHERE id = ?
    `;

    const [result] = await db.query(updateQuery, [
      first_name || "",
      last_name || "",
      email || null,
      phone.trim(),
      company || null,
      status || "active",
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({ success: true, message: "Contact updated successfully" });
  } catch (err) {
    console.error("❌ Update Contact Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};