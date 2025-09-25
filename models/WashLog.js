const mongoose = require("mongoose");

const washLogSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  vehicleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", // Reference Customer since vehicle info is stored there
    required: false // Make optional for now
  },
  washerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Washer", 
    required: true 
  },
  packageId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Package", 
    required: false // Make optional for now
  },
  
  // Wash details
  washType: { 
    type: String, 
    enum: ["exterior", "interior", "both"], 
    required: true 
  },
  washDate: { 
    type: Date, 
    default: Date.now 
  },
  startTime: { type: Date },
  endTime: { type: Date },
  
  // Location details
  apartment: { type: String, required: false }, // Make optional
  doorNo: { type: String, required: false }, // Make optional
  
  // Wash status
  status: { 
    type: String, 
    enum: ["scheduled", "in-progress", "completed", "cancelled", "rescheduled"], 
    default: "scheduled" 
  },
  
  // Services performed
  servicesCompleted: {
    exteriorWash: { type: Boolean, default: false },
    interiorWash: { type: Boolean, default: false },
    wheelCleaning: { type: Boolean, default: false },
    dashboardCleaning: { type: Boolean, default: false }
  },
  
  // Feedback and notes
  washerNotes: { type: String },
  customerFeedback: { type: String },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  
  // Images (before/after)
  beforeImages: [{ type: String }],
  afterImages: [{ type: String }],
  
  // Payment details
  amount: { type: Number },
  paymentStatus: { 
    type: String, 
    enum: ["pending", "completed", "failed"], 
    default: "pending" 
  },
  
  // Message sent details
  messageSent: { 
    type: Boolean, 
    default: false 
  },
  messageDetails: {
    sentAt: { type: Date },
    messageType: { type: String, enum: ["completion", "reminder", "rescheduled"] },
    content: { type: String }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient querying
washLogSchema.index({ customerId: 1, washDate: -1 });
washLogSchema.index({ washerId: 1, washDate: -1 });
washLogSchema.index({ status: 1 });

module.exports = mongoose.model("WashLog", washLogSchema);