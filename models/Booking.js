const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  // Humne required: true hata diya hai taake agar select na ho to error na aaye
  customerName: { type: String, default: "Guest Customer" }, 
  email: { type: String, default: "" },
  packageId: { type: String, default: null }, 
  packageName: { type: String, default: "General Package" },
  travelDate: { type: String, required: true }, // Ye dena zaroori hai
  travelers: { type: Number, default: 1 },
  totalAmount: { type: Number, required: true }, // Ye dena zaroori hai
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model("Booking", BookingSchema);