const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  washLogId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "WashLog" 
  },
  
  // Notification details
  type: { 
    type: String, 
    enum: ["wash_completed", "wash_reminder", "wash_rescheduled", "subscription_expiry", "payment_reminder"], 
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Delivery details
  mobileNo: { type: String, required: true },
  deliveryMethod: { 
    type: String, 
    enum: ["sms", "whatsapp", "email", "push"], 
    default: "sms" 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ["pending", "sent", "delivered", "failed"], 
    default: "pending" 
  },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  
  // Error handling
  failureReason: { type: String },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  
  // Template data for dynamic content
  templateData: {
    customerName: { type: String },
    washDate: { type: Date },
    washTime: { type: String },
    location: { type: String },
    remainingWashes: { type: Number },
    nextWashDate: { type: Date }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient querying
notificationSchema.index({ customerId: 1, createdAt: -1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ type: 1, sentAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);