const mongoose = require("mongoose");

const washLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  message: { type: String },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("WashLog", washLogSchema);
