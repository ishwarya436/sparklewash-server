const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  customer: String,
  service: String,
  time: String,
  status: { type: String, enum: ["Upcoming", "Completed"], default: "Upcoming" }
});

module.exports = mongoose.model("Job", jobSchema);
