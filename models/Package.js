const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  name: { type: String, enum: ["Basic", "Moderate", "Classic"], required: true },
  carType: { type: String, enum: ["Sedan", "SUV", "Premium"], required: true },
  pricePerMonth: { type: Number, required: true },
  exteriorWashes: { type: Number, default: 0 },
  interiorWashes: { type: Number, default: 0 },
  washDays: [{ type: String }], // ["Mon", "Thu"]
  duration: { type: String, // Example: "1 Month", "5 Washes"
  required: [true, "Package duration is required"],
  price: { type: Number, required: [true, "Package price is required"],
  min: [0, "Price cannot be negative"],
  description: { type: String,
  required: [true, "Package description is required"],
  trim: true,
    },
    },
    },
});

module.exports = mongoose.model("Package", packageSchema);
