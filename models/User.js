const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  avatar: String,
  status: { type: String, enum: ["Available", "Busy"], default: "Available" },
  rating: { type: Number, default: 5 }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
// module.exports = User;