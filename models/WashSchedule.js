const mongoose = require("mongoose");

const washScheduleSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  washerId: { type: mongoose.Schema.Types.ObjectId, ref: "Washer" },
  date: { type: Date, required: true },
  scheduledDate: { type: Date, required: true },
  type: { type: String, enum: ["exterior", "interior"], required: true },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  completedAt: { type: Date },
  location: { type: String } // apartment + doorNo
});

module.exports = mongoose.model("WashSchedule", washScheduleSchema);
