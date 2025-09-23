const User = require("../models/User");
const Request = require("../models/Request");
const Job = require("../models/Jobs");
const Earning = require("../models/Earning");
const dashboardController = require("./dashboardController");


// Get user info
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error fetching user" });
  }
};

// Update user status
exports.updateStatus = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error updating status" });
  }
};

// New requests
// All requests
exports.getRequests = async (req, res) => {
  try {
    const requests = await Request.find(); // 👈 no condition
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Error fetching requests" });
  }
};


exports.acceptRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: "Accepted" },
      { new: true }
    );
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: "Error accepting request" });
  }
};

exports.declineRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: "Declined" },
      { new: true }
    );
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: "Error declining request" });
  }
};

// Today’s Schedule
exports.getTodaySchedule = async (req, res) => {
  try {
    const jobs = await Job.find();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Error fetching schedule" });
  }
};

// Weekly Earnings
exports.getWeeklyEarnings = async (req, res) => {
  try {
    const earnings = await Earning.find();
    res.json(earnings);
  } catch (err) {
    res.status(500).json({ error: "Error fetching earnings" });
  }
};

// Summary
exports.getEarningsSummary = async (req, res) => {
  try {
    const thisWeek = await Earning.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
    const completedJobs = await Job.countDocuments({ status: "Completed" });
    const user = await User.findOne(); // single washer
    res.json({
      thisWeek: thisWeek[0]?.total || 0,
      pendingPayments: 78.5, // mock for now
      completedJobs,
      rating: user?.rating || 5
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching summary" });
  }
};


// controllers/dashboardController.js
exports.getDashboard = (req, res) => {
  res.send("Dashboard data here");
};
