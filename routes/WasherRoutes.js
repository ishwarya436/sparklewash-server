const express = require("express");
const router = express.Router();
const { getAllWashers, getAllWasherLogs, getAllWashSchedules } = require("../Controller/WasherController");

// GET all washers
router.get("/washer", getAllWashers);

// GET all washer logs
router.get("/washerlogs", getAllWasherLogs);

// GET all wash schedules
router.get("/washschedules", getAllWashSchedules);

module.exports = router;
