const Contact = require("../../models/Contact"); // Path ka khayal rakhein

// 1. Create: Naya contact add karna
exports.addContact = async (req, res) => {
  try {
    const newContact = new Contact(req.body);
    await newContact.save();
    res.status(201).json({ message: "✅ Contact saved!", data: newContact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Read: Saare contacts mangwana dashboard ke liye
exports.getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Update: Kisi contact ko edit karna
exports.updateContact = async (req, res) => {
  try {
    const updated = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Delete: Contact khatam karna
exports.deleteContact = async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: "🗑️ Contact deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
