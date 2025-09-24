const Washer = require("../models/Washer");
const WasherLog = require("../models/WasherLog");
const WashSchedule = require("../models/WashSchedule");

// ✅ Get all washers
exports.getAllWashers = async (req, res) => {
  try {
    const washers = await Washer.find();
    res.status(200).json(washers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching washers", error });
  }
};

// ✅ Get all washer logs
exports.getAllWasherLogs = async (req, res) => {
  try {
    const logs = await WasherLog.find().populate("washerId");
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching washer logs", error });
  }
};

// ✅ Get all wash schedules
exports.getAllWashSchedules = async (req, res) => {
  try {
    const schedules = await WashSchedule.find()
      .populate("washerId")
      .populate("customerId");
    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ message: "Error fetching wash schedules", error });
  }
};
