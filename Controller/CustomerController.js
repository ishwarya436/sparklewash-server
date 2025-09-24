// customerController.js
const Customer = require("../models/Customer");

// ✅ Get all customers with package & washer details
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate("packageId")   // Get package details
      .populate("washerId");   // Get washer details if stored in customer

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching customers", error });
  }
};
