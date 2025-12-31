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

// ✅ Get wash history for a washer
const getWasherHistory = async (req, res) => {
  try {
    const { washerId } = req.params;
    const { month, year } = req.query;

    if (!washerId) return res.status(400).json({ message: 'Washer ID required' });

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
      washerId,
      ...dateFilter
    })
      .populate('customerId', 'name mobileNo vehicles')
      .populate('packageId', 'name')
      .sort({ washDate: -1 });

    // Map vehicleNo if available from customer vehicles
    const mapped = washHistory.map(w => {
      const obj = (w.toObject && typeof w.toObject === 'function') ? w.toObject() : w;
      obj.vehicleNo = null;
      try {
        if (obj.vehicleId && obj.customerId && obj.customerId.vehicles && Array.isArray(obj.customerId.vehicles)) {
          const veh = obj.customerId.vehicles.find(v => String(v._id) === String(obj.vehicleId));
          if (veh) obj.vehicleNo = veh.vehicleNo || null;
        }
      } catch (e) {
        // ignore
      }
      return obj;
    });

    const completedCount = mapped.filter(m => m.status === 'completed').length;
    const cancelledCount = mapped.filter(m => m.status === 'cancelled').length;

    res.status(200).json({
      washHistory: mapped,
      counts: { completed: completedCount, cancelled: cancelledCount, total: mapped.length }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching washer history', error: error.message });
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
  getWasherHistory,
  getAllWashLogs,
  cancelWash
};

// ✅ Cancel a completed wash (admin)
async function cancelWash(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Wash ID required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid wash ID' });

    const washLog = await WashLog.findById(id);
    if (!washLog) return res.status(404).json({ message: 'Wash log not found' });
    if (washLog.status !== 'completed') return res.status(400).json({ message: 'Only completed washes can be cancelled' });

    // No time-window restriction: allow cancellation at any time per product requirement

    // Mark wash log as cancelled
    washLog.status = 'cancelled';
    washLog.cancelledAt = new Date();
    washLog.cancelledBy = req.user?.id || 'admin';
    await washLog.save();

    // Update customer lastWash (for vehicle or customer)
    try {
      const customerId = washLog.customerId;
      const vehicleId = washLog.vehicleId || null;
      const Customer = require('../models/Customer');
      const Washer = require('../models/Washer');

      const customer = await Customer.findById(customerId);
      if (customer) {
        if (vehicleId && Array.isArray(customer.vehicles)) {
          const vid = String(vehicleId);
          const vIndex = customer.vehicles.findIndex(v => String(v._id) === vid);
          if (vIndex !== -1) {
            // find previous completed wash for this vehicle
            const prev = await WashLog.findOne({
              customerId: customerId,
              vehicleId: vehicleId,
              status: 'completed',
              _id: { $ne: washLog._id }
            }).sort({ completedAt: -1, washDate: -1 });
            if (prev && prev.completedAt) {
              customer.vehicles[vIndex].washingSchedule = customer.vehicles[vIndex].washingSchedule || {};
              customer.vehicles[vIndex].washingSchedule.lastWashDate = prev.completedAt;
            } else {
              // no previous wash, clear lastWashDate
              if (customer.vehicles[vIndex].washingSchedule) customer.vehicles[vIndex].washingSchedule.lastWashDate = null;
            }
          }
        } else {
          // legacy single-customer last wash
          const prev = await WashLog.findOne({ customerId: customerId, status: 'completed', _id: { $ne: washLog._id } }).sort({ completedAt: -1, washDate: -1 });
          if (prev && prev.completedAt) {
            customer.washingSchedule = customer.washingSchedule || {};
            customer.washingSchedule.lastWashDate = prev.completedAt;
          } else {
            if (customer.washingSchedule) customer.washingSchedule.lastWashDate = null;
          }
        }
        await customer.save();
      }

      // Adjust washer totals
      if (washLog.washerId) {
        const washer = await Washer.findById(washLog.washerId);
        if (washer) {
          washer.totalWashesCompleted = Math.max(0, (washer.totalWashesCompleted || 0) - 1);
          await washer.save();
        }
      }

      // Recompute updated counts to return for UI
      const updatedWashCounts = await calculateWashCounts(customer);
      let vehicleCompleted = 0;
      if (vehicleId) {
        vehicleCompleted = await WashLog.countDocuments({ customerId: customerId, vehicleId: vehicleId, status: 'completed' });
      }

      return res.status(200).json({
        message: 'Wash cancelled',
        washId: washLog._id,
        customerId: washLog.customerId,
        vehicleId: washLog.vehicleId || null,
        updatedCounts: {
          pending: updatedWashCounts.pending,
          completed: updatedWashCounts.completed,
          total: updatedWashCounts.total,
          vehicleCompleted
        }
      });
    } catch (innerErr) {
      console.error('Error updating customer/washer after cancellation:', innerErr);
      return res.status(200).json({ message: 'Wash cancelled, but failed to update derived counts' , washId: washLog._id });
    }
  } catch (error) {
    console.error('Error cancelling wash:', error);
    return res.status(500).json({ message: 'Error cancelling wash', error: error.message });
  }
}