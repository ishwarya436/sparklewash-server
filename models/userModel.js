// const User = require("../models/userModel");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {type: String,required: true,trim: true},
  email:{type: String,required: true,unique: true,lowercase: true},
  phone:{type: String,required: true,unique: true},
  password:{type: String,required: true},
  role:{type: String, enum: ["admin", "customer"],default: "customer"},
  status: { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
  avatar: { type: String, default: "" },
  isDeleted: { type: Boolean, default: false }
},                    
{ timestamps: true });

module.exports = mongoose.model("User", userSchema);
// module.exports = User;