const mongoose = require("mongoose");

const PackageSchema = new mongoose.Schema({
  packageName: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  duration: { type: String },
  features: { type: [String] },
  status: { type: String, default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Package", PackageSchema);