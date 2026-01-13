const mongoose = require("mongoose");

const PackageSchema = new mongoose.Schema({
  packageName: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  duration: { type: String }, // e.g., "7 Days"
  features: { type: [String] }, // e.g., ["Hotel", "Food"]
  status: { type: String, default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Package", PackageSchema);