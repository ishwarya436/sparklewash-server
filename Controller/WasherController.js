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

// ✅ Get washer dashboard data with filtering
exports.getWasherDashboard = async (req, res) => {
  try {
    const { washerId } = req.params;
    const { date, apartment, carType } = req.query;

    console.log(`=== WASHER DASHBOARD REQUEST ===`);
    console.log(`Date param received: "${date}"`);
    console.log(`Date type: ${typeof date}`);
    console.log(`=================================`);

    const washer = await Washer.findById(washerId);
    if (!washer) {
      return res.status(404).json({ message: "Washer not found" });
    }

    // Base query for customers assigned to this washer
    let customerQuery = { washerId: washerId };
    
    // Apply apartment filter if provided
    if (apartment && apartment !== 'all') {
      customerQuery.apartment = apartment;
    }

    // Apply carType filter if provided
    if (carType && carType !== 'all') {
      customerQuery.carType = carType;
    }

    // Get ALL customers assigned to this washer at customer level OR vehicle level
    let allCustomers = await Customer.find({
      $or: [
        { washerId: washerId }, // Customer-level assignment
        { "vehicles.washerId": washerId } // Vehicle-level assignment
      ]
    }).populate("packageId")
      .populate("vehicles.packageId")
      .populate("vehicles.washerId");

    console.log(`🔍 Found ${allCustomers.length} customers for washer ${washerId}`);
    allCustomers.forEach(customer => {
      console.log(`🔍 Customer: ${customer.name}`);
      console.log(`🔍 - Customer-level washerId: ${customer.washerId}`);
      console.log(`🔍 - Vehicles count: ${customer.vehicles?.length || 0}`);
      if (customer.vehicles) {
        customer.vehicles.forEach((vehicle, idx) => {
          console.log(`🔍 - Vehicle ${idx + 1}: ${vehicle.vehicleNo} - washerId: ${vehicle.washerId}`);
        });
      }
    });

    // Flatten the data - create separate entries for each vehicle assigned to this washer
    let customerVehicleAssignments = [];
    
    for (const customer of allCustomers) {
      // Handle customer-level assignment (single vehicle customers)
      const customerWasherId = customer.washerId?._id ? customer.washerId._id.toString() : customer.washerId?.toString();
      if (customerWasherId && customerWasherId === washerId) {
        customerVehicleAssignments.push({
          _id: customer._id, // Customer ID for frontend compatibility
          customerId: customer._id,
          name: customer.name, // Use 'name' for frontend compatibility
          customerName: customer.name,
          mobileNo: customer.mobileNo,
          email: customer.email,
          apartment: customer.apartment,
          doorNo: customer.doorNo,
          // Vehicle info from customer level (backward compatibility)
          vehicleId: customer._id, // Use customer ID as vehicle ID for single vehicles
          carModel: customer.carModel,
          vehicleNo: customer.vehicleNo,
          carType: customer.carType,
          packageId: customer.packageId,
          packageName: customer.packageId ? customer.packageId.name : null,
          washingSchedule: customer.washingSchedule,
          subscriptionStart: customer.subscriptionStart,
          subscriptionEnd: customer.subscriptionEnd,
          assignmentType: 'customer-level'
        });
      }
      
      // Handle vehicle-level assignments (multi-vehicle customers)
      if (customer.vehicles && customer.vehicles.length > 0) {
        console.log(`🔍 Checking vehicles for customer: ${customer.name}`);
        for (const vehicle of customer.vehicles) {
          // Handle both ObjectId and populated object cases
          const vehicleWasherId = vehicle.washerId?._id ? vehicle.washerId._id.toString() : vehicle.washerId?.toString();
          console.log(`🔍 - Vehicle ${vehicle.vehicleNo}: washerId=${vehicleWasherId}, target=${washerId}`);
          console.log(`🔍 - washerId type: ${typeof vehicle.washerId}, is object: ${typeof vehicle.washerId === 'object'}`);
          if (vehicleWasherId && vehicleWasherId === washerId) {
            console.log(`🔍 ✅ Match found! Adding vehicle ${vehicle.vehicleNo} to assignments`);
            customerVehicleAssignments.push({
              _id: `${customer._id}-${vehicle._id}`, // Unique ID combining customer and vehicle
              customerId: customer._id,
              name: customer.name, // Use 'name' for frontend compatibility
              customerName: customer.name,
              mobileNo: customer.mobileNo,
              email: customer.email,
              apartment: customer.apartment,
              doorNo: customer.doorNo,
              // Vehicle-specific info
              vehicleId: vehicle._id,
              carModel: vehicle.carModel,
              vehicleNo: vehicle.vehicleNo,
              carType: vehicle.carType,
              packageId: vehicle.packageId,
              packageName: vehicle.packageId ? vehicle.packageId.name : null,
              washingSchedule: vehicle.washingSchedule,
              subscriptionStart: vehicle.subscriptionStart,
              subscriptionEnd: vehicle.subscriptionEnd,
              assignmentType: 'vehicle-level'
            });
          }
        }
      }
    }

    // Get unique apartments and car types for dropdown filters
    const apartmentList = [...new Set(customerVehicleAssignments.map(assignment => assignment.apartment))].filter(Boolean);
    const carTypeList = [...new Set(customerVehicleAssignments.map(assignment => assignment.carType))].filter(Boolean);

    // Apply filters to the flattened assignments
    let filteredAssignments = customerVehicleAssignments;

    // Apply apartment filter
    if (apartment && apartment !== 'all') {
      filteredAssignments = filteredAssignments.filter(assignment => assignment.apartment === apartment);
    }

    // Apply carType filter
    if (carType && carType !== 'all') {
      filteredAssignments = filteredAssignments.filter(assignment => assignment.carType === carType);
    }

    // Apply date filter based on washing schedule
    if (date && date !== 'all' && date !== 'today') {
      // Filter for specific date using UTC to avoid timezone issues
      const filterDate = new Date(date + 'T00:00:00.000Z');
      const dayOfWeek = filterDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Convert JavaScript day (0=Sun, 1=Mon...) to our washing schedule day (1=Mon, 2=Tue...)
      const washingScheduleDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7, keep others same
      
      console.log(`Frontend sent date: ${date}`);
      console.log(`Parsed date (UTC): ${filterDate.toUTCString()}`);
      console.log(`Final day of week: ${dayOfWeek} (JS) -> ${washingScheduleDay} (washing schedule) (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]})`);
      
      filteredAssignments = filteredAssignments.filter(assignment => {
        console.log(`Assignment ${assignment.customerName} - ${assignment.vehicleNo}:`, {
          washingSchedule: assignment.washingSchedule,
          washingDays: assignment.washingSchedule?.washingDays,
          packageName: assignment.packageName
        });
        
        if (!assignment.washingSchedule || !assignment.washingSchedule.washingDays) {
          console.log(`  ❌ No washing schedule found`);
          return false;
        }
        
        const hasWashToday = assignment.washingSchedule.washingDays.includes(washingScheduleDay);
        console.log(`  📅 Checking day ${washingScheduleDay}: ${hasWashToday ? '✅ HAS WASH' : '❌ No wash'}`);
        return hasWashToday;
      });
    } else if (date === 'today' || !date) {
      // Default: show only assignments that need wash today
      const today = new Date();
      const todayDayOfWeek = today.getDay();
      
      // Convert JavaScript day to washing schedule day
      const todayWashingScheduleDay = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;
      
      console.log(`Filtering for today: ${todayDayOfWeek} (JS) -> ${todayWashingScheduleDay} (washing schedule) (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][todayDayOfWeek]})`);
      
      filteredAssignments = filteredAssignments.filter(assignment => {
        let washingDays = [];
        
        if (!assignment.washingSchedule || !assignment.washingSchedule.washingDays || assignment.washingSchedule.washingDays.length === 0) {
          // For assignments without schedule, calculate based on package
          if (assignment.packageName === 'Basic') {
            washingDays = [1, 4]; // Monday, Thursday
          } else if (assignment.packageName === 'Moderate' || assignment.packageName === 'Classic') {
            washingDays = [1, 3, 5]; // Monday, Wednesday, Friday
          }
        } else {
          washingDays = assignment.washingSchedule.washingDays;
        }
        
        // Check if today is a washing day
        const hasWashToday = washingDays.includes(todayWashingScheduleDay);
        if (!hasWashToday) {
          return false;
        }
        
        // Check if wash already completed today for this specific vehicle
        const lastWash = assignment.washingSchedule?.lastWashDate;
        if (lastWash) {
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const lastWashStart = new Date(lastWash.getFullYear(), lastWash.getMonth(), lastWash.getDate());
          
          if (lastWashStart.getTime() === todayStart.getTime()) {
            return false; // Already washed today
          }
        }
        
        return true;
      });
    }

    // Calculate wash counts and schedule info for each assignment
    const assignmentsWithWashCounts = await Promise.all(
      filteredAssignments.map(async (assignment) => {
        // Calculate date range for current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        // Get total monthly washes from package
        let totalMonthlyWashes = 0;
        if (assignment.packageId) {
          const packageName = assignment.packageName;
          if (packageName === 'Basic') {
            totalMonthlyWashes = 8;
          } else if (packageName === 'Moderate') {
            totalMonthlyWashes = 12;
          } else if (packageName === 'Classic') {
            totalMonthlyWashes = 12;
          }
        }
        
        // Count completed washes this month for this specific vehicle
        const completedWashes = await WashLog.countDocuments({
          customerId: assignment.customerId,
          vehicleId: assignment.vehicleId,
          washDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          },
          status: 'completed'
        });
        
        const pendingWashes = Math.max(0, totalMonthlyWashes - completedWashes);

        return {
          ...assignment,
          pendingWashes,
          completedWashes,
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
      customers: assignmentsWithWashCounts,
      apartments: apartmentList,
      carTypes: carTypeList,
      totalCustomers: assignmentsWithWashCounts.length,
      filters: {
        date: date || 'today',
        apartment: apartment || 'all',
        carType: carType || 'all'
      }
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
