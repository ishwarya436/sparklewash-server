const mongoose = require("mongoose");
// const washerLogSchema = new mongoose.Schema({

const washerLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  message: { type: String },
  sentAt: { type: Date, default: Date.now },
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer", required: true },
  action: { type: String, required: true }, // e.g., "Started Shift", "Completed Wash"
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// module.exports = mongoose.model("WasherLog", washerLogSchema);


module.exports = mongoose.model("WasherLog", washerLogSchema);
