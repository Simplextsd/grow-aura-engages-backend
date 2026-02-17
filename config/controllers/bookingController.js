const db = require("../db");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default; // ✅ FIX: Guaranteed in Node

// Helper: safely parse json
function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return fallback;
  }
}

// ✅ POST /api/bookings (Save booking + also create invoice)
const addBooking = async (req, res) => {
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
      locked,
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    if (!items_json) {
      return res.status(400).json({ success: false, message: "items_json is required" });
    }

    const itemsObj = safeJsonParse(items_json, null);
    if (!itemsObj) {
      return res.status(400).json({ success: false, message: "items_json must be valid JSON" });
    }

    // ✅ bookings table mapping
    const customerName = customer_name;
    const packageId = "Custom";
    const travelDate = due_date || null;

    const totalAmount = Number(total_amount || 0);
    const paidAmount = Number(paid_amount || 0);
    const balanceAmount = Number(balance_amount || (totalAmount - paidAmount));

    // bookings.status => Paid/Pending
    const bookingStatus = status === "paid" ? "Paid" : "Pending";

    const specialRequests = itemsObj?.other_services?.description || "";
    const flight_details = JSON.stringify(itemsObj?.flights || []);
    const flight_booking_ref = itemsObj?.flight_booking_ref || null;

    // ✅ 1) Save booking
    const sqlBooking = `
      INSERT INTO bookings
      (customerName, packageId, travelDate, totalAmount, status, specialRequests, flight_details,
       locked, currency, exchange_rate, paid_amount, balance_amount, payment_method, generate_stripe_link,
       flight_booking_ref, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valuesBooking = [
      customerName,
      packageId,
      travelDate,
      totalAmount,
      bookingStatus,
      specialRequests,
      flight_details,

      locked ? 1 : 0,
      currency || "USD",
      Number(exchange_rate || 1),
      paidAmount,
      balanceAmount,
      payment_method || "Stripe",
      generate_stripe_link ? 1 : 0,
      flight_booking_ref,
      JSON.stringify(itemsObj),
    ];

    const [result] = await db.query(sqlBooking, valuesBooking);
    const bookingId = result.insertId;

    // ✅ 2) Create invoice (items_json same store)
    // ⚠️ NOTE: booking_id column must exist in invoices table
    const [invRes] = await db.query(
      `INSERT INTO invoices
       (invoice_number, customer_name, due_date, status,
        currency, exchange_rate, total_amount, paid_amount, balance_amount,
        payment_method, generate_stripe_link, items_json, created_by, booking_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "INV-TEMP",
        customerName,
        travelDate,
        status || "sent",
        currency || "USD",
        Number(exchange_rate || 1),
        totalAmount,
        paidAmount,
        balanceAmount,
        payment_method || "Stripe",
        generate_stripe_link ? 1 : 0,
        JSON.stringify(itemsObj),
        req.user?.id || null,
        bookingId,
      ]
    );

    const invId = invRes.insertId;

    // ✅ 3) Update invoice_number
    const now = new Date();
    const invNo =
      `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-` +
      String(invId).padStart(6, "0");

    await db.query("UPDATE invoices SET invoice_number = ? WHERE id = ?", [invNo, invId]);

    return res.status(201).json({
      success: true,
      message: "✅ Booking Saved + Invoice Created",
      id: bookingId,
      invoice_id: invId,
      invoice_number: invNo,
      stripe_url: null,
    });
  } catch (err) {
    console.error("Error saving booking:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ GET /api/bookings
const getBookings = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bookings ORDER BY id DESC");

    const data = rows.map((r) => ({
      ...r,
      items: safeJsonParse(r.items_json, {}),
      flights_parsed: safeJsonParse(r.flight_details, []),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM bookings WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Booking not found" });

    const booking = rows[0];

    return res.json({
      success: true,
      data: {
        ...booking,
        items: safeJsonParse(booking.items_json, {}),
        flights_parsed: safeJsonParse(booking.flight_details, []),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ POST /api/bookings/:id/lock
const lockBooking = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE bookings SET locked = 1 WHERE id = ?", [id]);
    return res.json({ success: true, message: "✅ Locked" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ✅ GET /api/bookings/download/:id (Booking PDF)
const downloadBookingPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT * FROM bookings WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Booking not found" });

    const booking = rows[0];

    const items = safeJsonParse(booking.items_json, {});
    const passengers = Array.isArray(items.passengers) ? items.passengers : [];
    const flights = Array.isArray(items.flights) ? items.flights : safeJsonParse(booking.flight_details, []);
    const hotels = Array.isArray(items.hotels) ? items.hotels : [];
    const transport = Array.isArray(items.transport) ? items.transport : [];

    const currency = booking.currency || "USD";
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.paid_amount || 0);
    const balance = Number(booking.balance_amount || (total - paid));

    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("TRAVEL ERP - BOOKING", 14, 15);

    doc.setFontSize(10);
    doc.text(`Booking ID: ${booking.id}`, 14, 23);
    doc.text(`Customer: ${booking.customerName || ""}`, 14, 29);
    doc.text(`Travel Date: ${booking.travelDate ? String(booking.travelDate).slice(0, 10) : ""}`, 14, 35);
    doc.text(`Status: ${booking.status || ""}`, 14, 41);
    doc.text(`PNR/Ref: ${booking.flight_booking_ref || items.flight_booking_ref || ""}`, 14, 47);

    // ✅ Amount summary (FIXED)
    autoTable(doc, {
      startY: 55,
      head: [["Currency", "Total", "Paid", "Balance"]],
      body: [[currency, String(total), String(paid), String(balance)]],
      styles: { fontSize: 9 },
    });

    let y = (doc.lastAutoTable?.finalY || 55) + 8;

    // Passengers
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
      });

      y = (doc.lastAutoTable?.finalY || y) + 8;
    }

    // Flights
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
          f.ref || items.flight_booking_ref || booking.flight_booking_ref || "",
          f.supplier || "",
          f.baggage || "",
        ]),
        styles: { fontSize: 8 },
      });

      y = (doc.lastAutoTable?.finalY || y) + 8;
    }

    // Hotels
    if (hotels.length) {
      doc.setFontSize(11);
      doc.text("Hotels", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Hotel", "Meal", "Room", "In", "Out", "Ref", "Supplier", "Price", "Guests"]],
        body: hotels.map((h) => [
          h.name || "",
          h.meal || "",
          h.room || "",
          h.in || "",
          h.out || "",
          h.ref || "",
          h.supplier || "",
          h.price || "",
          h.guests || "",
        ]),
        styles: { fontSize: 8 },
      });

      y = (doc.lastAutoTable?.finalY || y) + 8;
    }

    // Transport
    if (transport.length) {
      doc.setFontSize(11);
      doc.text("Transport", 14, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Vehicle", "Pickup", "Dropoff", "Contact", "Supplier", "Pax", "Cost"]],
        body: transport.map((t) => [
          t.date || "",
          t.vehicle || "",
          t.pickup || "",
          t.dropoff || "",
          t.contact || "",
          t.supplier || "",
          t.pax || "",
          t.cost || "",
        ]),
        styles: { fontSize: 8 },
      });

      y = (doc.lastAutoTable?.finalY || y) + 8;
    }

    // Other Services
    const other = items?.other_services || {};
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

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=booking-${booking.id}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF error:", err);
    return res.status(500).json({ success: false, message: "PDF generation failed", error: err.message });
  }
};

module.exports = {
  addBooking,
  getBookings,
  getBookingById,
  lockBooking,
  downloadBookingPdf,
};
