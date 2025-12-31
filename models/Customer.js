const mongoose = require("mongoose");

// Vehicle subdocument schema
const vehicleSchema = new mongoose.Schema({
  carModel: { type: String, required: true },
  vehicleNo: { type: String, required: true },
  carType: { type: String, enum: ["sedan", "suv", "premium", "hatch"], required: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  packageName: { type: String },
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  // Backward-compatibility package dates for single-vehicle customers
  packageStartDate: { type: Date },
  packageEndDate: { type: Date },
  // History of packages applied to this vehicle
  packageHistory: [
    {
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
      packageName: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      autoRenewed: { type: Boolean, default: false },
      renewedOn: { type: Date }
    }
  ],
  
  // Washing Schedule Configuration for this vehicle
  washingSchedule: {
    scheduleType: { 
      type: String, 
      enum: ['schedule1', 'schedule2'], 
      default: 'schedule1'
    },
    washingDays: {
      type: [Number], 
      default: []
    },
    lastWashDate: { type: Date },
    nextWashDate: { type: Date },
    washFrequencyPerMonth: { type: Number, default: 8 }
  },
  
 
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  
  // Wash statistics for this vehicle
  totalWashes: { type: Number, default: 0 },
  completedWashes: { type: Number, default: 0 },
  pendingWashes: { type: Number, default: 0 }
}, {
  timestamps: true
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNo: { type: String, required: true },
  email: { type: String },
  apartment: { type: String, required: true },
  doorNo: { type: String, required: true },
  
  // Multiple vehicles support
  vehicles: [vehicleSchema],
  
  // Backward compatibility fields (for single vehicle customers)
  carModel: { type: String },
  carType: { type: String, enum: ["sedan", "suv", "premium", "hatch"] },
  vehicleNo: { type: String },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
  packageName: { type: String },
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  washingSchedule: {
    scheduleType: { 
      type: String, 
      enum: ['schedule1', 'schedule2'],
      default: 'schedule1'
    },
    washingDays: {
      type: [Number],
      default: []
    },
    lastWashDate: { type: Date },
    nextWashDate: { type: Date },
    washFrequencyPerMonth: { type: Number, default: 8 }
  },
  
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total vehicles count
customerSchema.virtual('totalVehicles').get(function() {
  return this.vehicles ? this.vehicles.length : (this.vehicleNo ? 1 : 0);
});

// Virtual to check if customer has multiple vehicles
customerSchema.virtual('hasMultipleVehicles').get(function() {
  return this.vehicles && this.vehicles.length > 1;
});

// Virtual for primary vehicle (for display purposes)
customerSchema.virtual('primaryVehicle').get(function() {
  if (this.vehicles && this.vehicles.length > 0) {
    return this.vehicles[0];
  } else if (this.vehicleNo) {
    return {
      carModel: this.carModel,
      vehicleNo: this.vehicleNo,
      carType: this.carType,
      packageName: this.packageName
    };
  }
  return null;
});

// Create unique index for vehicle numbers across all customers
customerSchema.index({ "vehicles.vehicleNo": 1 }, { unique: true, sparse: true });
customerSchema.index({ "vehicleNo": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Customer", customerSchema);
