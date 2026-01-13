const Package = require("../../models/Package");

// 1. Create Package
exports.addPackage = async (req, res) => {
  try {
    const newPackage = new Package(req.body);
    await newPackage.save();
    res.status(201).json({ message: "✅ Package created successfully!", data: newPackage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Get All Packages (Website par dikhane ke liye)
exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Delete Package (Ye naya add kiya gaya hai)
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params; // URL se ID nikalne ke liye
    const deletedPackage = await Package.findByIdAndDelete(id); 

    if (!deletedPackage) {
      return res.status(404).json({ error: "Package nahi mila!" });
    }

    res.status(200).json({ message: "🗑️ Deleted from MongoDB successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};