const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  name: { 
    type: String, 
    enum: ["Basic", "Moderate", "Classic", "Hatch Pack"], 
    required: true 
  },
  carType: { 
    type: String, 
    enum: ["sedan", "suv", "premium", "hatch"], 
    required: true 
  },
  pricePerMonth: { 
    type: Number, 
    required: true 
  },
  washCountPerWeek: { 
    type: Number, 
    required: true 
  },
  washCountPerMonth: {
    type: Number,
    required: true
  },
  interiorCleaning: { 
    type: String, 
    required: true 
  },
  exteriorWaxing: { 
    type: String, 
    required: true 
  },
  washDays: [{ 
    type: String 
  }], // ["Monday", "Thursday"]
  description: { 
    type: String,
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create compound index for unique package per car type
packageSchema.index({ name: 1, carType: 1 }, { unique: true });

module.exports = mongoose.model("Package", packageSchema);
