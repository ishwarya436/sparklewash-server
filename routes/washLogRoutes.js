const express = require("express");
const router = express.Router();
const {
  completeWash,
  getWashHistory,
  getAllWashLogs
} = require("../Controller/WashLogController");

// POST /api/washlog/complete - Mark a wash as completed
router.post("/complete", completeWash);

// GET /api/washlog/customer/:customerId - Get wash history for specific customer
router.get("/customer/:customerId", getWashHistory);

// GET /api/washlog/all - Get all wash logs (admin view)
router.get("/all", getAllWashLogs);

module.exports = router;