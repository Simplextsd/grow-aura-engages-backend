const db = require("../db");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default;
const fs = require("fs");
const path = require("path");

/* =====================================================
   HELPER FUNCTIONS
===================================================== */

function parsePNR(pnrText) {
  if (!pnrText) return [];

  const flights = [];
  const flightRegex =
    /([A-Z0-9]{2})\s*(\d{3,4})\s+[A-Z]\s+(\d{2}[A-Z]{3})\s+([A-Z]{3})([A-Z]{3})\s+[A-Z0-9]{3}\s+(\d{4})\s+(\d{4})/g;

  let match;
  while ((match = flightRegex.exec(pnrText)) !== null) {
    flights.push({
      date: match[3],
      airline: match[1] + match[2],
      dep: match[4],
      arr: match[5],
      depT: match[6],
      arrT: match[7],
      ref: "GDS-Parsed",
    });
  }

  return flights;
}

function safeJsonParse(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

/* =====================================================
   1. ADD BOOKING
===================================================== */

const addBooking = async (req, res) => {
  try {
    const { customer_name, items_json, pnr_text } = req.body;

    if (!customer_name || !items_json) {
      return res.status(400).json({
        success: false,
        message: "Customer name & items_json required",
      });
    }

    let itemsObj = safeJsonParse(items_json, {});

    if (pnr_text) {
      const parsedFlights = parsePNR(pnr_text);
      itemsObj.flights = [...(itemsObj.flights || []), ...parsedFlights];
    }

    if (req.files && req.files.length) {
      itemsObj.uploaded_files = req.files.map((f) => f.filename);
    }

    /* ===============================
       🔥 REVENUE CALCULATION FIX
    =============================== */

    const pricing = itemsObj.pricing || {};

    const totalAmount =
      Number(pricing.total) ||
      Number(pricing.grandTotal) ||
      Number(itemsObj.total) ||
      Number(itemsObj.amount) ||
      0;

    const paidAmount = Number(pricing.paid) || 0;
    const balanceAmount = totalAmount - paidAmount;

    /* ===============================
       🔥 CORRECT INSERT QUERY
    =============================== */

   const [result] = await db.query(
  `INSERT INTO bookings 
   (customerName, items_json, totalAmount, paid_amount, balance_amount) 
   VALUES (?, ?, ?, ?, ?)`,
  [
    customer_name,
    JSON.stringify(itemsObj),
    totalAmount,
    paidAmount,
    balanceAmount,
  ]
);

/* ===============================
   AUTO CREATE INVOICE
================================ */

try {
  await db.query(
    `INSERT INTO invoices
    (invoice_number, booking_id, customer_name, currency, exchange_rate, total_amount, paid_amount, balance_amount, payment_method, items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "INV-" + result.insertId,
      result.insertId,
      customer_name,
      "USD",
      1,
      totalAmount,
      paidAmount,
      balanceAmount,
      "In-Hand",
      JSON.stringify(itemsObj)
    ]
  );
} catch (err) {
  console.log("Invoice Auto Create Error:", err);
}
res.status(201).json({
  success: true,
  id: result.insertId,
});

} catch (err) {
  console.error("Add Booking Error:", err);
  res.status(500).json({ success: false, message: "Server Error" });
}
};

/* =====================================================
   2. GET ALL BOOKINGS
===================================================== */

const getBookings = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM bookings ORDER BY id DESC"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* =====================================================
   3. ANALYTICS
===================================================== */

const getBookingAnalytics = async (req, res) => {
  try {
    const [stats] = await db.query(
      "SELECT COUNT(*) as total FROM bookings"
    );

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* =====================================================
   4. GET BY ID
===================================================== */

const getBookingById = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM bookings WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* =====================================================
   5. LOCK BOOKING
===================================================== */

const lockBooking = async (req, res) => {
  try {
    await db.query(
      "UPDATE bookings SET locked = 1 WHERE id = ?",
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/* =====================================================
   6. DOWNLOAD PDF (WITH LOGO)
===================================================== */

const downloadBookingPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM bookings WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = rows[0];
    const items = safeJsonParse(booking.items_json, {});
    const pricing = items.pricing || {};

    const doc = new jsPDF();

    /* LOGO */
    const logoPath = path.join(__dirname, "../assets/logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBase64 = fs.readFileSync(logoPath).toString("base64");
      doc.addImage(
        `data:image/png;base64,${logoBase64}`,
        "PNG",
        14,
        10,
        40,
        20
      );
    }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING VOUCHER", 200, 20, { align: "right" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Booking ID: ${booking.id}`, 200, 28, { align: "right" });
    doc.text(`Customer: ${booking.customerName}`, 200, 35, {
      align: "right",
    });

    let currentY = 50;

    /* PASSENGERS */
    if (items.passengers?.length) {
      autoTable(doc, {
        startY: currentY,
        head: [["First Name", "Last Name", "Phone", "Email", "DOB", "Gender"]],
        body: items.passengers.map((p) => [
          p.firstName || "",
          p.lastName || "",
          p.phone || "",
          p.email || "",
          p.dob || "",
          p.gender || "",
        ]),
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    /* FLIGHTS */
    if (items.flights?.length) {
      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Airline", "Dep", "Arr", "Dep T", "Arr T", "Ref"]],
        body: items.flights.map((f) => [
          f.date || "",
          f.airline || "",
          f.dep || "",
          f.arr || "",
          f.depT || "",
          f.arrT || "",
          f.ref || "",
        ]),
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    /* HOTELS */
    if (items.hotels?.length) {
      autoTable(doc, {
        startY: currentY,
        head: [["Hotel", "Room", "Meal", "Check In", "Check Out", "Price"]],
        body: items.hotels.map((h) => [
          h.name || "",
          h.room || "",
          h.meal || "",
          h.in || "",
          h.out || "",
          h.price || "",
        ]),
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    /* TRANSPORT */
    if (items.transport?.length) {
      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Vehicle", "Pickup", "Dropoff", "Pax", "Cost"]],
        body: items.transport.map((t) => [
          t.date || "",
          t.vehicle || "",
          t.pickup || "",
          t.dropoff || "",
          t.pax || "",
          t.cost || "",
        ]),
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 15;
    }

    

    /* SCREENSHOTS */
    if (items.uploaded_files?.length) {
      items.uploaded_files.forEach((file) => {
        const imagePath = path.join(__dirname, "../uploads", file);

        if (fs.existsSync(imagePath)) {
          const imgData = fs.readFileSync(imagePath).toString("base64");
          const ext = path.extname(file).toLowerCase();
          const format = ext === ".png" ? "PNG" : "JPEG";

          doc.addPage();
          doc.setFontSize(14);
          doc.text("ATTACHED SCREENSHOT", 14, 20);

          doc.addImage(
            `data:image/${format.toLowerCase()};base64,${imgData}`,
            format,
            15,
            30,
            180,
            120
          );
        }
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=booking-${id}.pdf`
    );

    res.send(Buffer.from(doc.output("arraybuffer")));
  } catch (err) {
    console.error("PDF Error:", err);
    res.status(500).send("PDF Error");
  }
};



const fetchPNR = async (req, res) => {
  try {
    const { text } = req.query;
    const data = parsePNR(text);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ✅ YAHAN PASTE KARO - Analytics + Graph Functions */
const getDashboardStats = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bookings");

    let totalRevenue = 0;

    rows.forEach((b) => {
      try {
        const items = JSON.parse(b.items_json || "{}");

        const pricing = items.pricing || {};
        const total =
          pricing.total ||
          pricing.grandTotal ||
          items.total ||
          items.amount ||
          0;

        totalRevenue += Number(total) || 0;
      } catch {}
    });

    const totalBookings = rows.length;
    const avgSale =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;

    res.json({
      success: true,
      data: {
        totalBookings,
        totalRevenue,
        avgSale,
      },
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ success: false });
  }
};

const getBookingGraph = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as total
      FROM bookings
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Graph Error:", err);
    res.status(500).json({ success: false });
  }
};

const getLast7DaysGraph = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as total
      FROM bookings
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("7 Day Graph Error:", err);
    res.status(500).json({ success: false });
  }
};

const getStatusDistribution = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) as total
      FROM bookings
      GROUP BY status
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Status Graph Error:", err);
    res.status(500).json({ success: false });
  }
};

/* ✅ Ab module.exports aayega */


  // ✅ New functions yahan add hongay (Step 2)

module.exports = {
  addBooking,
  getBookings,
  getBookingAnalytics,
  getBookingById,
  lockBooking,
  downloadBookingPdf,
  fetchPNR,

  // ✅ Dashboard / Graphics APIs
  getDashboardStats,
  getBookingGraph,
  getLast7DaysGraph,
  getStatusDistribution,
};