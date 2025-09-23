// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controller/UserController");
const auth = require("../middleware/authMiddleware");
const User = require("../models/userModel");
const userModel = require("../models/userModel");

// CRUD APIs
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

// router.post("/userRoutes", userRoutes);

module.exports = router;




