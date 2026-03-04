const db = require("../../config/db");
const { jsPDF } = require("jspdf");

/* ===============================
   HELPERS
=============================== */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function safeJsonParse(v, fallback) {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return fallback;
  }
}

/* ===============================
   CREATE INVOICE
=============================== */

const createInvoice = async (req, res) => {
  try {
    const {
      customer_name,
      due_date,
      total_amount,
      paid_amount,
      currency,
      exchange_rate,
      payment_method,
      items_json,
    } = req.body;

    if (!customer_name || !items_json) {
      return res.status(400).json({
        success: false,
        message: "customer_name & items_json required",
      });
    }

    const total = Number(total_amount || 0);
    const paid = Number(paid_amount || 0);
    const balance = total - paid;

    let status = "sent";
    if (balance <= 0) status = "paid";

    const [result] = await db.query(
      `INSERT INTO invoices
       (invoice_number, customer_name, due_date, status,
        currency, exchange_rate, total_amount, paid_amount,
        balance_amount, payment_method, items_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "INV-TEMP",
        customer_name,
        due_date || null,
        status,
        currency || "USD",
        Number(exchange_rate || 1),
        total,
        paid,
        balance,
        payment_method || "In-Hand",
        JSON.stringify(safeJsonParse(items_json, {})),
      ]
    );

    const now = new Date();
    const invoiceNumber =
      `INV-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
        now.getDate()
      )}-` + String(result.insertId).padStart(6, "0");

    await db.query(
      "UPDATE invoices SET invoice_number=? WHERE id=?",
      [invoiceNumber, result.insertId]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      invoice_number: invoiceNumber,
    });

  } catch (err) {
    console.error("Create Error:", err);
    res.status(500).json({ success: false });
  }
};

/* ===============================
   GET ALL INVOICES
=============================== */

const getInvoices = async (req, res) => {
  try {

    const [rows] = await db.query(
      "SELECT * FROM invoices ORDER BY id DESC"
    );

    res.json({
      success: true,
      data: rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

/* ===============================
   DASHBOARD STATS (FIXED)
=============================== */

const getDashboardStats = async (req, res) => {

  try {

    const [rows] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN LOWER(status)='paid' THEN total_amount END),0) as totalRevenue,
        COALESCE(SUM(CASE WHEN LOWER(status)!='paid' THEN balance_amount END),0) as pendingAmount,
        COUNT(*) as activeCount
      FROM invoices
    `);

    res.json({
      success: true,
      data: rows[0],
    });

  } catch (err) {

    console.error("Stats Error:", err);

    res.status(500).json({
      success: false,
      data: {
        totalRevenue: 0,
        pendingAmount: 0,
        activeCount: 0,
      },
    });

  }

};

/* ===============================
   GET SINGLE
=============================== */

const getInvoiceById = async (req, res) => {

  try {

    const [rows] = await db.query(
      "SELECT * FROM invoices WHERE id=?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false });
    }

    res.json({
      success: true,
      data: rows[0],
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({ success: false });

  }

};

/* ===============================
   DOWNLOAD PDF
=============================== */

const downloadInvoicePdf = async (req, res) => {

  try {

    const [rows] = await db.query(
      "SELECT * FROM invoices WHERE id=?",
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false });

    const inv = rows[0];

    const doc = new jsPDF();

    doc.text("TRAVEL ERP - INVOICE", 14, 20);
    doc.text(`Invoice #: ${inv.invoice_number}`, 14, 30);
    doc.text(`Customer: ${inv.customer_name}`, 14, 40);
    doc.text(`Total: ${inv.total_amount}`, 14, 50);
    doc.text(`Paid: ${inv.paid_amount}`, 14, 60);
    doc.text(`Balance: ${inv.balance_amount}`, 14, 70);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${inv.invoice_number}.pdf`
    );

    res.send(Buffer.from(doc.output("arraybuffer")));

  } catch (err) {

    console.error(err);

    res.status(500).json({ success: false });

  }

};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  getDashboardStats,
  downloadInvoicePdf,
};