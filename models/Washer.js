const mongoose = require("mongoose");

const washerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String },
  assignedApartments: [{ type: String }],
  status: { type: String, enum: ["active", "inactive"], default: "active" }
});

module.exports = mongoose.model("Washer", washerSchema);
