const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  customer: String,
  vehicle: String,
  location: String,
  time: String,
  price: Number,
  status: { type: String, enum: ["New", "Accepted", "Declined"], default: "New" }
});




module.exports = mongoose.model("Request", requestSchema);
