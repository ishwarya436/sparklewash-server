// controllers/packageController.js
const Package = require("../models/Package");

// ✅ Get all packages
const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find(); // fetch all documents
    res.status(200).json(packages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching packages", error: error.message });
  }
};

module.exports = {  getAllPackages };
