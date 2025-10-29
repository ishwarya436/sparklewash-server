const WashLog = require("../models/WashLog");
const Customer = require("../models/Customer");
const mongoose = require("mongoose");

// Helper function to calculate wash counts (moved from Customer model)
const calculateWashCounts = async (customer) => {
  try {
    if (!customer.packageId) return { completed: 0, pending: 0, total: 0 };
    
    // Calculate total washes for current month based on package
    let totalMonthlyWashes = 0;
    const packageName = customer.packageId.name;
    
    if (packageName === 'Basic') {
      totalMonthlyWashes = 8; // 2 times per week * 4 weeks
    } else if (packageName === 'Moderate') {
      totalMonthlyWashes = 12; // 3 times per week * 4 weeks
    } else if (packageName === 'Classic') {
      totalMonthlyWashes = 12; // 3 times per week * 4 weeks (exterior only)
    }
    
    // Calculate date range for current month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Count completed washes this month
    const completedWashes = await WashLog.countDocuments({
      customerId: customer._id,
      washDate: {
        $gte: startOfMonth,
        $lte: endOfMonth
      },
      status: 'completed'
    });
    
    // Calculate pending washes
    const pendingWashes = Math.max(0, totalMonthlyWashes - completedWashes);
    
    return {
      completed: completedWashes,
      pending: pendingWashes,
      total: totalMonthlyWashes
    };
  } catch (error) {
    console.error('Error calculating wash counts:', error);
    return { completed: 0, pending: 0, total: 0 };
  }
};

// ✅ Mark a wash as completed
const completeWash = async (req, res) => {
  try {
    const {
      customerId,
      vehicleId,
      washerId,
      washType, // "exterior", "interior", "both"
      location,
      notes
    } = req.body;

    // Validate required fields
    if (!customerId || !washerId || !washType) {
      return res.status(400).json({
        message: "Customer ID, Washer ID, and wash type are required"
      });
    }

    // Get customer details to populate packageId and (optionally) infer vehicleId
    const customer = await Customer.findById(customerId).populate('packageId').populate('vehicles');
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Determine vehicleId to record on the wash log
    // Priority: explicit vehicleId from client -> if single vehicle on customer use that -> else null
    let resolvedVehicleId = null;
    if (vehicleId) {
      resolvedVehicleId = vehicleId;
    } else if (Array.isArray(customer.vehicles) && customer.vehicles.length === 1) {
      resolvedVehicleId = customer.vehicles[0]._id;
    }

    // Prefer vehicle package if available, otherwise customer's package
    const packageIdToUse = (resolvedVehicleId && customer.vehicles && customer.vehicles.length > 0)
      ? (customer.vehicles.find(v => String(v._id) === String(resolvedVehicleId))?.packageId || customer.packageId?._id)
      : (customer.packageId?._id);

    // Create wash log entry
    const washLog = new WashLog({
      customerId,
      vehicleId: resolvedVehicleId,
      washerId,
      packageId: packageIdToUse,
      washType,
      washDate: new Date(),
      location: location || customer.apartment,
      status: "completed",
      completedAt: new Date(),
      notes: notes || `${washType} wash completed successfully`
    });

    await washLog.save();

    // Get updated wash counts for the customer
    const washCounts = await calculateWashCounts(customer);

    res.status(201).json({
      message: "Wash completed successfully",
      washLog,
      customer: {
        name: customer.name,
        pendingWashes: washCounts.pending,
        completedWashes: washCounts.completed,
        totalMonthlyWashes: washCounts.total
      }
    });

    // TODO: Send notification to customer about wash completion
    // You can implement SMS/WhatsApp notification here
    
  } catch (error) {
    res.status(500).json({
      message: "Error completing wash",
      error: error.message
    });
  }
};

// ✅ Get wash history for a customer
const getWashHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { month, year } = req.query;

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      dateFilter = {
        washDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    const washHistory = await WashLog.find({
      customerId,
      ...dateFilter
    })
    .populate('washerId', 'name phone')
    .populate('packageId', 'name')
    .sort({ washDate: -1 });

    res.status(200).json({
      washHistory,
      totalWashes: washHistory.length
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching wash history",
      error: error.message
    });
  }
};

// ✅ Get all wash logs (for admin)
const getAllWashLogs = async (req, res) => {
  try {
    const { page = 1, limit = 5, status, washType } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (washType) filter.washType = washType;

    const washLogs = await WashLog.find(filter)
      .populate('customerId', 'name mobileNo apartment doorNo')
      .populate('washerId', 'name phone')
      .populate('packageId', 'name')
      .sort({ washDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WashLog.countDocuments(filter);

    res.status(200).json({
      washLogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching wash logs",
      error: error.message
    });
  }
};

module.exports = {
  completeWash,
  getWashHistory,
  getAllWashLogs
};