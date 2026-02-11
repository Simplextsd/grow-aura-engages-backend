const mongoose = require("mongoose");
const BookingSchema = new mongoose.Schema({
  customerName: { type: String, default: "Guest Customer" }, 
  email: { type: String, default: "" },
  packageId: { type: String, default: null }, 
  packageName: { type: String, default: "General Package" },
  travelDate: { type: String, required: true }, 
  travelers: { type: Number, default: 1 },
  totalAmount: { type: Number, required: true }, 
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model("Booking", BookingSchema);