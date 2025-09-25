const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String },
  apartment: { type: String, required: true },
  doorNo: { type: String, required: true },
  carModel: { type: String, required: true },
  vehicleNo: { type: String, required: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  packageName: { type: String }, // Add packageName column to store package name
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  subscriptionStart: { type: Date, default: Date.now },
  subscriptionEnd: { type: Date },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model("Customer", customerSchema);
