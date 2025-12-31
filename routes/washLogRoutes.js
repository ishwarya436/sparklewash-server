const express = require("express");
const router = express.Router();
const {
  completeWash,
  getWashHistory,
  getWasherHistory,
  getAllWashLogs
} = require("../Controller/WashLogController");

// cancelWash exported below - require it by destructuring to avoid circular issues
const { cancelWash } = require("../Controller/WashLogController");

// POST /api/washlog/complete - Mark a wash as completed
router.post("/complete", completeWash);

// GET /api/washlog/customer/:customerId - Get wash history for specific customer
router.get("/customer/:customerId", getWashHistory);
// GET /api/washlog/washer/:washerId - Get wash history for a washer
router.get("/washer/:washerId", getWasherHistory);
// GET /api/washlog/all - Get all wash logs (admin view)
router.get("/all", getAllWashLogs);

// POST /api/washlog/:id/cancel - Cancel a recently completed wash (admin)
router.post('/:id/cancel', cancelWash);

module.exports = router;