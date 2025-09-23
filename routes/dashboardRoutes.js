const express = require("express");

const {
  getUser,
  updateStatus,
  getRequests,
  acceptRequest,
  declineRequest,
  getTodaySchedule,
  getWeeklyEarnings,
  getEarningsSummary
} = require("../Controller/dashboardController"); // ✅ Fixed case

const router = express.Router();

// User
router.get("/user/:id", getUser);
router.patch("/user/:id/status", updateStatus);

// Requests
router.get("/requests", getRequests);
router.patch("/requests/:id/accept", acceptRequest);
router.patch("/requests/:id/decline", declineRequest);

// Schedule
router.get("/schedule/today", getTodaySchedule);

// Earnings
router.get("/earnings/weekly", getWeeklyEarnings);
router.get("/earnings/summary", getEarningsSummary);

module.exports = router;
