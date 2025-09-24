// routes/packageRoutes.js
const express = require("express");
const { getAllPackages } = require("../Controller/PackageController");

const router = express.Router();

// GET all packages
router.get("/package", getAllPackages);

module.exports = router;
