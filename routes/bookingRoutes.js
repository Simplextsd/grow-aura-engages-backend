const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const bookingController = require("../config/controllers/bookingController");

/* =====================================================
   MULTER SETUP (Screenshot Upload)
===================================================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure uploads folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/* =====================================================
   ROUTES
===================================================== */

router.get("/analytics", bookingController.getBookingAnalytics);
router.get("/pnr/fetch", bookingController.fetchPNR);
router.get("/download/:id", bookingController.downloadBookingPdf);
router.get("/all", bookingController.getBookings);
router.get("/dashboard-stats", bookingController.getDashboardStats);
router.get("/booking-graph", bookingController.getBookingGraph);
router.get("/last7days-graph", bookingController.getLast7DaysGraph);
router.get("/status-distribution", bookingController.getStatusDistribution);

// 🔹 ADD BOOKING (with file upload)
router.post("/", upload.array("files"), bookingController.addBooking);

// 🔹 GENERAL
router.get("/", bookingController.getBookings);

// 🔹 DYNAMIC ROUTES (ALWAYS LAST)
router.get("/:id", bookingController.getBookingById);
router.post("/:id/lock", bookingController.lockBooking);

module.exports = router;