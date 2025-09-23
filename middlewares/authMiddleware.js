const jwt = require("jsonwebtoken");
const { error } = require("../utils/response");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(res, "No token provided", null, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // req.user.id, req.user.role
    next();
  } catch (err) {
    return error(res, "Invalid or expired token", null, 403);
  }
};

module.exports = authMiddleware;
