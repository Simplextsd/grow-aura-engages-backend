const db = require("../../config/db");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable");

// Helper: safely parse json
function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return fallback;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// POST /api/invoices
const createInvoice = async (req, res) => {
  try {
    const {
      customer_name,
      due_date,
      status,
      currency,
      exchange_rate,
      total_amount,
      paid_amount,
      balance_amount,
      payment_method,
      generate_stripe_link,
      items_json,
      booking_id,
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({ success: false, message: "customer_name is required" });
    }
    if (!items_json) {
      return res.status(400).json({ success: false, message: "items_json is required" });
    }

    const itemsObj = safeJsonParse(items_json, null);
    if (!itemsObj) {
      return res.status(400).json({ success: false, message: "items_json must be valid JSON" });
    }

    // ✅ if you have auth middleware: req.user.id
    const createdBy = req.user?.id || null;

    const sql = `
      INSERT INTO invoices
      (invoice_number, booking_id, customer_name, due_date, status,
       currency, exchange_rate, total_amount, paid_amount, balance_amount,
       payment_method, generate_stripe_link, items_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // temporary invoice_number (update after insert)
    const tempInvoiceNumber = "INV-TEMP";

    const values = [
      tempInvoiceNumber,
      booking_id || null,
      customer_name,
      due_date || null,
      status || "sent",
      currency || "USD",
      Number(exchange_rate || 1),
      Number(total_amount || 0),
      Number(paid_amount || 0),
      Number(balance_amount || 0),
      payment_method || "Stripe",
      generate_stripe_link ? 1 : 0,
      JSON.stringify(itemsObj),
      createdBy,
    ];

    const [result] = await db.query(sql, values);

    // ✅ Generate proper invoice_number (example: INV-20260216-000123)
    const now = new Date();
    const invNo =
      `INV-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-` +
      String(result.insertId).padStart(6, "0");

    await db.query("UPDATE invoices SET invoice_number = ? WHERE id = ?", [invNo, result.insertId]);

    return res.status(201).json({
      success: true,
      message: "✅ Invoice Saved",
      id: result.insertId,
      invoice_number: invNo,
      stripe_url: null, // optional
    });
  } catch (err) {
    console.error("Error saving invoice:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// GET /api/invoices
const getInvoices = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM invoices
      ORDER BY id DESC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// GET /api/invoices/:id
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM invoices WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Invoice not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// GET /api/invoices/download/:id  (PDF without price)
const downloadInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT * FROM invoices WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Invoice not found" });

    const inv = rows[0];

    const items = safeJsonParse(inv.items_json, {});
    const passengers = Array.isArray(items.passengers) ? items.passengers : [];
    const flights = Array.isArray(items.flights) ? items.flights : [];
    const hotels = Array.isArray(items.hotels) ? items.hotels : [];
    const transport = Array.isArray(items.transport) ? items.transport : [];
    const other = items?.other_services || {};

    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("TRAVEL ERP - INVOICE", 14, 15);

    doc.setFontSize(10);
    doc.text(`Invoice #: ${inv.invoice_number || inv.id}`, 14, 23);
    doc.text(`Customer: ${inv.customer_name || ""}`, 14, 29);
    doc.text(`Due Date: ${inv.due_date ? String(inv.due_date).slice(0, 10) : ""}`, 14, 35);
    doc.text(`Status: ${inv.status || ""}`, 14, 41);

    // ✅ IMPORTANT: Price/Amount show nahi karna => summary table skip
    // Agar aap sirf currency show karna chahte ho:
    doc.text(`Currency: ${inv.currency || "USD"}`, 14, 47);

    let y = 55;

    // Passengers table
    if (passengers.length) {
      doc.setFontSize(11);
      doc.text("Passengers", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["First Name", "Last Name", "Phone", "Email", "DOB", "Gender"]],
        body: passengers.map((p) => [
          p.firstName || "",
          p.lastName || "",
          p.phone || "",
          p.email || "",
          p.dob || "",
          p.gender || "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 30] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Flights table
    if (flights.length) {
      doc.setFontSize(11);
      doc.text("Flights", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Airline", "DEP", "ARR", "DEP T", "ARR T", "Ref", "Supplier", "Baggage"]],
        body: flights.map((f) => [
          f.date || "",
          f.airline || "",
          f.dep || "",
          f.arr || "",
          f.depT || "",
          f.arrT || "",
          f.ref || items.flight_booking_ref || "",
          f.supplier || "",
          f.baggage || "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 30] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Hotels table (✅ price column remove)
    if (hotels.length) {
      doc.setFontSize(11);
      doc.text("Hotels", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Hotel", "Meal", "Room", "In", "Out", "Ref", "Supplier", "Guests"]],
        body: hotels.map((h) => [
          h.name || "",
          h.meal || "",
          h.room || "",
          h.in || "",
          h.out || "",
          h.ref || "",
          h.supplier || "",
          h.guests || "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 30] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Transport table (✅ cost column remove)
    if (transport.length) {
      doc.setFontSize(11);
      doc.text("Transport", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Vehicle", "Pickup", "Dropoff", "Contact", "Supplier", "Pax"]],
        body: transport.map((t) => [
          t.date || "",
          t.vehicle || "",
          t.pickup || "",
          t.dropoff || "",
          t.contact || "",
          t.supplier || "",
          t.pax || "",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 30] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Other services
    if (other?.description || other?.visa || other?.ziarat) {
      doc.setFontSize(11);
      doc.text("Other Services", 14, y);
      y += 6;

      doc.setFontSize(9);
      doc.text(`Description: ${other.description || ""}`, 14, y);
      y += 5;
      doc.text(`Visa: ${other.visa ? "Yes" : "No"}   Ziarat: ${other.ziarat ? "Yes" : "No"}`, 14, y);
      y += 5;
    }

    // Send PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${inv.invoice_number || inv.id}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return res.status(500).json({ success: false, message: "PDF generation failed", error: err.message });
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  downloadInvoicePdf,
};
