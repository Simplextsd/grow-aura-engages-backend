const express = require("express");
const router = express.Router();
const invoiceController = require("../config/controllers/invoiceController");

router.post("/", invoiceController.createInvoice);
router.get("/", invoiceController.getInvoices);
router.get("/dashboard", invoiceController.getDashboardStats);
router.get("/:id", invoiceController.getInvoiceById);
router.get("/download/:id", invoiceController.downloadInvoicePdf);

module.exports = router;