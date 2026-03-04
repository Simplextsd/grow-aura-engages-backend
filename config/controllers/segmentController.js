const db = require("../db");

// 1. Get All Segments
const getSegments = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.*,
        COUNT(sc.contact_id) as contact_count,
        MIN(c.email) as email,
        MIN(c.phone) as phone
      FROM segments s
      LEFT JOIN segment_contacts sc ON sc.segment_id = s.id
      LEFT JOIN contacts c ON c.id = sc.contact_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("❌ Fetch Segments Error:", error.message);
    res.status(500).json({ message: "Error fetching segments" });
  }
};

// 2. Create New Segment with Contacts
const createSegment = async (req, res) => {
  const { name, description, is_dynamic, filter_type, filter_value, contactIds } = req.body;
  
  try {
    // 1. Pehle segment table mein entry karein
    const [result] = await db.query(
      "INSERT INTO segments (name, description, is_dynamic, filter_type, filter_value) VALUES (?, ?, ?, ?, ?)",
      [name, description, is_dynamic ? 1 : 0, filter_type, filter_value]
    );
    
    const segmentId = result.insertId;

    // 2. Agar contacts select kiye gaye hain, toh unhe segment_contacts table mein daalein
    if (contactIds && contactIds.length > 0) {
      const values = contactIds.map(contactId => [segmentId, contactId]);
      await db.query(
        "INSERT INTO segment_contacts (segment_id, contact_id) VALUES ?",
        [values]
      );
    }

    res.status(201).json({ id: segmentId, message: "Segment created with contacts!" });
  } catch (error) {
    console.error("❌ Create Segment Error:", error.message);
    res.status(500).json({ message: "Database error", error: error.message });
  }
};

const getSegmentContacts = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
          c.id,
          CONCAT(c.first_name, ' ', c.last_name) AS name,
          c.email,
          c.phone
       FROM contacts c
       INNER JOIN segment_contacts sc 
          ON c.id = sc.contact_id
       WHERE sc.segment_id = ?`,
      [id]
    );

    res.json(rows);
  } catch (error) {
    console.error("❌ SQL Error:", error.message);
    res.status(500).json({
      message: "Error loading contacts",
      error: error.message
    });
  }
};

// 4. Delete Segment
const deleteSegment = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM segment_contacts WHERE segment_id = ?", [id]);
    const [result] = await db.query("DELETE FROM segments WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Segment not found" });
    }
    
    res.json({ message: "Segment deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Error:", error.sqlMessage || error.message);
    res.status(500).json({ message: "Error deleting segment", error: error.message });
  }
};

module.exports = {
  getSegments,
  createSegment,
  getSegmentContacts,
  deleteSegment
};