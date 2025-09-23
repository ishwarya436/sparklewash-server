// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const { errorResponse } = require("../utils/response");
const User = require("../models/userModel");

exports.verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    if (!token) return res.status(401).json(errorResponse("No token provided"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
    // optionally attach full user
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json(errorResponse("Invalid token"));
    req.user = { id: user._id, role: user.role, email: user.email };
    next();
  } catch (err) {
    res.status(401).json(errorResponse("Unauthorized", err.message));
  }
};

exports.isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json(errorResponse("Unauthorized"));
  if (req.user.role !== "admin") return res.status(403).json(errorResponse("Admin access required"));
  next();
};
