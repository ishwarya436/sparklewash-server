const mongoose = require("mongoose");

const earningSchema = new mongoose.Schema({
  day: String, // Mon, Tue, ...
  amount: Number,
  week: Number
});

module.exports = mongoose.model("Earning", earningSchema);
