const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  vehicleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Vehicle", 
    required: true 
  },
  packageId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Package", 
    required: true 
  },
  
  // Subscription period
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Pricing details
  monthlyAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  
  // Wash tracking for the month
  totalWashesAllowed: { type: Number, required: true }, // e.g., 8 for basic
  exteriorWashesAllowed: { type: Number, required: true },
  interiorWashesAllowed: { type: Number, required: true },
  
  // Remaining washes
  exteriorWashesRemaining: { type: Number },
  interiorWashesRemaining: { type: Number },
  
  // Wash schedule
  washDays: [{ type: Number }], // [1, 4] for Monday, Thursday
  
  // Status
  status: { 
    type: String, 
    enum: ["active", "expired", "cancelled", "suspended"], 
    default: "active" 
  },
  
  // Auto-renewal
  autoRenewal: { type: Boolean, default: true },
  
  // Payment tracking
  paymentStatus: { 
    type: String, 
    enum: ["paid", "pending", "failed"], 
    default: "pending" 
  },
  paymentDate: { type: Date },
  paymentId: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate remaining washes when subscription starts
subscriptionSchema.pre('save', function(next) {
  if (this.isNew) {
    this.exteriorWashesRemaining = this.exteriorWashesAllowed;
    this.interiorWashesRemaining = this.interiorWashesAllowed;
  }
  next();
});

// Index for efficient querying
subscriptionSchema.index({ customerId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);