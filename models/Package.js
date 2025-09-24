const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  name: { type: String, enum: ["Basic", "Moderate", "Classic"], required: true },
  carType: { type: String, enum: ["Sedan", "SUV", "Premium"], required: true },
  pricePerMonth: { type: Number, required: true },
  exteriorWashes: { type: Number, default: 0 },
  interiorWashes: { type: Number, default: 0 },
  washDays: [{ type: String }], // ["Mon", "Thu"]
});

module.exports = mongoose.model("Package", packageSchema);
