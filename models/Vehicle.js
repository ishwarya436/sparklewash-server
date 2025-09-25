const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  carModel: { type: String, required: true },
  vehicleNo: { type: String, required: true, unique: true },
  carType: { 
    type: String, 
    enum: ["sedan", "suv", "premium"], 
    required: true 
  },
  color: { type: String },
  year: { type: Number },
  brand: { type: String },
  
  // Current package subscription for this vehicle
  currentPackage: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Package" 
  },
  monthlyAmount: { type: Number },
  
  // Wash schedule (days of week: 1=Monday, 2=Tuesday, etc.)
  washDays: [{ type: Number }], // e.g., [1, 4] for Monday and Thursday
  
  // Subscription details
  subscriptionStart: { type: Date },
  subscriptionEnd: { type: Date },
  isActive: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Vehicle", vehicleSchema);