const mongoose = require("mongoose");

const washerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String },
  vehicleType: { type: String }, // e.g., Car, Bike
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  joinedAt: { type: Date, default: Date.now }
  // assignedApartments: [{ type: String }],
});

module.exports = mongoose.model("Washer", washerSchema);
