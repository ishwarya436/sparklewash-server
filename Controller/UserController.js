// Controller/userController.js
const User = require("../models/userModel");
const { successResponse, errorResponse } = require("../utils/response");

// Helper to build filters
function buildFilters(query) {
  const { search, status, role, dateFrom, dateTo } = query;
  const filter = { isDeleted: false };

  if (status) filter.status = status;
  if (role) filter.role = role;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (search) {
    const re = new RegExp(search, "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  return filter;
}

exports.getAllUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, sortBy = "-createdAt" } = req.query;
    page = Number(page) || 1;
    limit = Number(limit) || 10;

    const filter = buildFilters(req.query);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit);

    res.json(successResponse("Users fetched", {
      users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    }));
  } catch (err) {
    res.status(500).json(errorResponse("Error fetching users", err.message));
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: false });
    if (!user) return res.status(404).json(errorResponse("User not found"));
    res.json(successResponse("User fetched", user));
  } catch (err) {
    res.status(500).json(errorResponse("Error fetching user", err.message));
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, role, status, avatar } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json(errorResponse("Email already in use"));
    const newUser = await User.create({ name, email, phone, role, status, avatar });
    res.status(201).json(successResponse("User created", newUser));
  } catch (err) {
    res.status(500).json(errorResponse("Error creating user", err.message));
  }
};

exports.updateUser = async (req, res) => {
  try {
    const update = (({ name, email, phone, role, status, avatar }) => ({ name, email, phone, role, status, avatar }))(req.body);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json(errorResponse("User not found"));
    res.json(successResponse("User updated", user));
  } catch (err) {
    res.status(500).json(errorResponse("Error updating user", err.message));
  }
};

// exports.softDeleteUser = async (req, res) => {
//   try {
//     const user = await User.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
//     if (!user) return res.status(404).json(errorResponse("User not found"));
//     res.json(successResponse("User deleted (soft)", user));
//   } catch (err) {
//     res.status(500).json(errorResponse("Error deleting user", err.message));
//   }
// };

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!user) return res.status(404).json(errorResponse("User not found"));
    res.json(successResponse("User deleted (soft)", user));
  } catch (err) {
    res.status(500).json(errorResponse("Error deleting user", err.message));
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { status } = req.body; // active | inactive | suspended
    if (!["active", "inactive", "suspended"].includes(status)) return res.status(400).json(errorResponse("Invalid status"));
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json(errorResponse("User not found"));
    res.json(successResponse("Status updated", user));
  } catch (err) {
    res.status(500).json(errorResponse("Error changing status", err.message));
  }
};

exports.exportUsersCSV = async (req, res) => {
  try {
    const filter = buildFilters(req.query);
    const users = await User.find(filter).sort("-createdAt");

    // build CSV manually
    const header = ["_id", "name", "email", "phone", "role", "status", "createdAt"];
    const rows = users.map(u => [
      u._id,
      '"' + (u.name?.replace(/"/g, '""') || "") + '"',
      '"' + (u.email || "") + '"',
      '"' + (u.phone || "") + '"',
      u.role,
      u.status,
      new Date(u.createdAt).toISOString()
    ].join(","));

    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="users-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json(errorResponse("Error exporting CSV", err.message));
  }
};
