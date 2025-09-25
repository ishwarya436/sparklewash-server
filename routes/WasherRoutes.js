const express = require("express");
const router = express.Router();
const { 
  getAllWashers, 
  getAllWasherLogs, 
  getAllWashSchedules,
  authenticateWasher,
  getWasherDashboard,
  completeWash
} = require("../Controller/WasherController");

// GET all washers
router.get("/washer", getAllWashers);

// GET all washer logs
router.get("/washerlogs", getAllWasherLogs);

// GET all wash schedules
router.get("/washschedules", getAllWashSchedules);

// POST authenticate washer
router.post("/authenticate", authenticateWasher);

// GET washer dashboard data
router.get("/dashboard/:washerId", getWasherDashboard);

// POST complete a wash
router.post("/complete-wash", completeWash);

module.exports = router;
