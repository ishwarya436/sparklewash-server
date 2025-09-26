const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String },
  apartment: { type: String, required: true },
  doorNo: { type: String, required: true },
  carModel: { type: String, required: true },
  carType: { type: String, enum: ["sedan", "suv", "premium"], required: true }, // Car type based on package
  vehicleNo: { type: String, required: true, unique: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  packageName: { type: String }, // Add packageName column to store package name
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  
  // Washing Schedule Configuration
  washingSchedule: {
    scheduleType: { 
      type: String, 
      enum: ['schedule1', 'schedule2'], // schedule1: Mon+Wed+Fri, schedule2: Tue+Thu+Sat
      default: 'schedule1'
    },
    washingDays: {
      type: [Number], // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
      default: []
    },
    lastWashDate: { type: Date },
    nextWashDate: { type: Date },
    washFrequencyPerMonth: { type: Number, default: 8 }
  },
  
  subscriptionStart: { type: Date, default: Date.now },
  subscriptionEnd: { type: Date },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model("Customer", customerSchema);
