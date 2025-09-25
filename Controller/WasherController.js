const Washer = require("../models/Washer");
const WasherLog = require("../models/WasherLog");
const WashSchedule = require("../models/WashSchedule");
const Customer = require("../models/Customer");
const WashLog = require("../models/WashLog");

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

// ✅ Authenticate washer
exports.authenticateWasher = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: "Email and name are required" });
    }

    // Find washer by email and name
    const washer = await Washer.findOne({
      email: email.trim(),
      name: name.trim()
    });

    if (!washer) {
      return res.status(401).json({ message: "Invalid credentials. Please check your email and name." });
    }

    // Update last active
    washer.lastActive = new Date();
    await washer.save();

    res.status(200).json({
      message: "Authentication successful",
      washer: {
        _id: washer._id,
        name: washer.name,
        email: washer.email,
        mobileNo: washer.mobileNo,
        assignedApartments: washer.assignedApartments,
        currentLocation: washer.currentLocation,
        isAvailable: washer.isAvailable,
        status: washer.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Authentication error", error: error.message });
  }
};

// ✅ Get washer dashboard data
exports.getWasherDashboard = async (req, res) => {
  try {
    const { washerId } = req.params;

    const washer = await Washer.findById(washerId);
    if (!washer) {
      return res.status(404).json({ message: "Washer not found" });
    }

    // Get customers assigned to this washer
    const customers = await Customer.find({ washerId: washerId })
      .populate("packageId");

    // Calculate wash counts for each customer
    const customersWithWashCounts = await Promise.all(
      customers.map(async (customer) => {
        // Calculate date range for current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        // Get total monthly washes from package
        let totalMonthlyWashes = 0;
        if (customer.packageId) {
          const packageName = customer.packageId.name;
          if (packageName === 'Basic') {
            totalMonthlyWashes = 8;
          } else if (packageName === 'Moderate') {
            totalMonthlyWashes = 12;
          } else if (packageName === 'Classic') {
            totalMonthlyWashes = 12;
          }
        }
        
        // Count completed washes this month
        const completedWashes = await WashLog.countDocuments({
          customerId: customer._id,
          washDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          },
          status: 'completed'
        });
        
        const pendingWashes = Math.max(0, totalMonthlyWashes - completedWashes);

        return {
          _id: customer._id,
          name: customer.name,
          mobileNo: customer.mobileNo,
          email: customer.email,
          apartment: customer.apartment,
          doorNo: customer.doorNo,
          carModel: customer.carModel,
          vehicleNo: customer.vehicleNo,
          packageName: customer.packageId ? customer.packageId.name : null,
          completedWashes,
          pendingWashes,
          totalMonthlyWashes
        };
      })
    );

    res.status(200).json({
      washer: {
        _id: washer._id,
        name: washer.name,
        assignedApartments: washer.assignedApartments,
        isAvailable: washer.isAvailable,
        status: washer.status
      },
      customers: customersWithWashCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching dashboard data", error: error.message });
  }
};

// ✅ Complete a wash
exports.completeWash = async (req, res) => {
  try {
    const { customerId, washerId, washType, location } = req.body;

    if (!customerId || !washerId) {
      return res.status(400).json({ message: "Customer ID and Washer ID are required" });
    }

    // Verify customer and washer exist
    const customer = await Customer.findById(customerId);
    const washer = await Washer.findById(washerId);

    if (!customer || !washer) {
      return res.status(404).json({ message: "Customer or Washer not found" });
    }

    // Create wash log entry
    const washLog = new WashLog({
      customerId,
      washerId,
      washDate: new Date(),
      washType: washType || 'exterior',
      status: 'completed',
      location: customer.apartment,
      notes: `Completed by ${washer.name}`
    });

    await washLog.save();

    // Update washer's completed washes count
    washer.totalWashesCompleted += 1;
    washer.lastActive = new Date();
    await washer.save();

    res.status(200).json({
      message: "Wash completed successfully",
      washLog
    });
  } catch (error) {
    res.status(500).json({ message: "Error completing wash", error: error.message });
  }
};
