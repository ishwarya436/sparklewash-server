const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { success, error } = require("../utils/response");

// Register
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return error(res, "All fields are required", null, 400);
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return error(res, "Email or Phone already exists", null, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || "customer",
    });

    await user.save();

    return success(res, "User registered successfully", {
      id: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    return error(res, "Server error", null, 500);
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, "Email and password are required", null, 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return error(res, "Enter correct mail id or password", null, 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return error(res, "Enter correct mail id or password", null, 400);
    }

    // 🔑 Create JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return success(res, "Login successful", {
      token, // client ku token anuprom
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return error(res, "Server error", null, 500);
  }
};

module.exports = { register, login };
