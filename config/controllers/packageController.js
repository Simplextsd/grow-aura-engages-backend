const Package = require("../../models/Package");
exports.addPackage = async (req, res) => {
  try {
    const newPackage = new Package(req.body);
    await newPackage.save();
    res.status(201).json({ message: "✅ Package created successfully!", data: newPackage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPackage = await Package.findByIdAndDelete(id);

    if (!deletedPackage) {
      return res.status(404).json({ error: "Package nahi mila!" });
    }

    res.status(200).json({ message: "🗑️ Deleted  successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};