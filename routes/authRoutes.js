const express = require("express");
const { register,login } = require("../Controllers/authController");


// const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const User = require("../models/userModel");
const router = express.Router();
const bcrypt = require("bcryptjs");


// Register route
router.post("/register", register);


// Login route
router.post("/login", login);







module.exports = router;