const mongoose = require('mongoose');
const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
segment:{ type: String, default: "Active" },
status:{ type: String, default: "New" },
lastcontact : { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = mongoose.model("Contact", ContactSchema);
