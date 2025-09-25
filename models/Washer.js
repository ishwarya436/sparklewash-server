const mongoose = require("mongoose");

const washerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true, unique: true },
  email: { type: String },
  
  // Location and service area
  assignedApartments: [{ type: String }], // Apartments they serve
  currentLocation: {
    type: { type: String, default: "Point" },
    coordinates: [{ type: Number }] // [longitude, latitude]
  },
  
  // Availability
  isAvailable: { type: Boolean, default: true },
  workingHours: {
    start: { type: String, default: "08:00" }, // 8:00 AM
    end: { type: String, default: "18:00" }    // 6:00 PM
  },
  workingDays: [{ 
    type: Number, 
    min: 0, 
    max: 6 
  }], // 0=Sunday, 1=Monday, etc.
  
  // Performance metrics
  totalWashesCompleted: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  
  // Current assignments
  currentCustomers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer" 
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ["active", "inactive", "on-leave", "busy"], 
    default: "active" 
  },
  
  // Equipment and supplies
  hasEquipment: { type: Boolean, default: true },
  equipmentList: [{ type: String }],
  
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

// Index for geospatial queries
washerSchema.index({ currentLocation: "2dsphere" });
washerSchema.index({ assignedApartments: 1 });
washerSchema.index({ status: 1, isAvailable: 1 });

module.exports = mongoose.model("Washer", washerSchema);
