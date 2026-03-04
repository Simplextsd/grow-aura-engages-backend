const db = require("../config/db"); 
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default;

// 1. Naya Hotel/Booking Save karne ke liye
exports.createHotelBooking = async (req, res) => {
  try {
    const { category, price, customer_name, included_services, pnr_text } = req.body;

    // Safety: Agar customer_name nahi hai toh error
    if (!customer_name) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    // Data ko stringify karna (Database column ke liye)
    const services = typeof included_services === 'object' 
      ? JSON.stringify(included_services) 
      : included_services;

    const sql = "INSERT INTO packages (category, price, customer_name, included_services, pnr_text, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
    const [result] = await db.query(sql, [category || 'hotel', price || 0, customer_name, services, pnr_text || ""]);

    res.status(201).json({ success: true, message: "Saved to CRM Successfully! ✅", id: result.insertId });
  } catch (error) {
    console.error("❌ Insert Error:", error.message);
    res.status(500).json({ success: false, message: "Backend API Error: " + error.message });
  }
};

// 2. CRM Table ke liye Data Fetch karna (Row-wise)
exports.getAllHotels = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM packages ORDER BY created_at DESC");
    
    const formatted = rows.map(r => {
      let parsedServices = {};
      if (r.included_services) {
        try {
          parsedServices = typeof r.included_services === 'string' 
            ? JSON.parse(r.included_services) 
            : r.included_services;
        } catch (e) {
          console.warn(`⚠️ Row ID ${r.id} invalid JSON`);
          parsedServices = { raw_info: r.included_services }; 
        }
      }
      return { ...r, included_services: parsedServices };
    });

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. PDF Download (No Price, A to Z Details)
exports.downloadHotelPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM packages WHERE id = ?", [id]);

    if (!rows.length) return res.status(404).send("Booking not found");

    const hotel = rows[0];
    const services = typeof hotel.included_services === 'string' 
      ? JSON.parse(hotel.included_services) 
      : hotel.included_services;

    const doc = new jsPDF();

    // Header Design
    doc.setFontSize(22);
    doc.setTextColor(255, 100, 0); // Orange
    doc.text("TRAVEL ERP SYSTEM", 10, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("HOTEL VOUCHER", 10, 30);
    doc.line(10, 32, 200, 32);

    // Customer & Booking Info
    doc.setFontSize(12);
    doc.text(`Guest Name: ${hotel.customer_name || 'N/A'}`, 10, 45);
    doc.text(`Ref No: #HTL-${hotel.id}`, 10, 52);
    doc.text(`Voucher Date: ${new Date().toLocaleDateString()}`, 10, 59);

    // Hotel Details Table (A to Z Details)
    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Details']],
      body: [
        ['Hotel Name', services.hotelName || '-'],
        ['Check-In', services.roomInDate || '-'],
        ['Check-Out', services.outDate || '-'],
        ['Meal Plan', services.meal || '-'],
        ['Total Guests', services.guests || '-'],
        ['Supplier', services.supplier || '-'],
        ['Reference No', services.ref || '-']
      ],
      headStyles: { fillColor: [40, 40, 40] },
      theme: 'grid'
    });

    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Note: This is an official booking voucher. Prices are not shown for privacy.", 10, footerY);

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=hotel_voucher_${id}.pdf`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error("PDF Error:", err);
    res.status(500).send("Error generating PDF");
  }
};