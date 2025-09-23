const express = require("express");
const { register,login } = require("../Controller/authController");

// const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const User = require("../models/userModel");
const router = express.Router();
const bcrypt = require("bcryptjs");


router.post("/register", register);
router.post("/login", login);

module.exports = router;