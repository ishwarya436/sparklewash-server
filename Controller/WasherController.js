const Washer = require("../models/Washer");
const WasherLog = require("../models/WashLog");
const WashSchedule = require("../models/WashSchedule");
const Customer = require("../models/Customer");
const WashLog = require("../models/WashLog");

exports.addWasher = async (req, res) => {
  try {
    const { name, mobileNo, email } = req.body;
    if (!name || !mobileNo || !email) {
      return res.status(400).json({ message: "Name, mobile number, and email are required" });
    }
    const newWasher = new Washer({ name, mobileNo, email });
    const savedWasher = await newWasher.save();
    res.status(201).json({ message: "Washer added successfully", washer: savedWasher });
  } catch (error) {
    res.status(500).json({ message: "Error adding washer", error: error.message });
  }
};


exports.addWasher = async (req, res) => {
  try {
    console.log("Received washer request body:", JSON.stringify(req.body, null, 2));

    const {
      name,
      mobileNo,
      email,
      status,
      totalWashesCompleted
    } = req.body;

    // Validate required fields
    if (!name || !mobileNo || !email) {
      return res.status(400).json({ message: "Name, mobile number, and email are required" });
    }

    // Create new washer object
    const newWasher = new Washer({
      name,
      mobileNo,
      email
    });

    const savedWasher = await newWasher.save();

    res.status(201).json({
      message: "Washer added successfully",
      washer: savedWasher
    });
  } catch (error) {
    console.error("Error adding washer:", error);
    res.status(500).json({ message: "Error adding washer", error });
  }
};
 

// ✅ Get washers with pagination
exports.getAllWasher = async (req, res) => {
  try {
    // Get page and limit from query parameters (default: page=1, limit=10)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Calculate how many to skip
    const skip = (page - 1) * limit;

    // Count total washers
    const total = await Washer.countDocuments();

    // Fetch paginated washers
    const washers = await Washer.find()
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 }); // optional alphabetical sort

    // Send response
    res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      data: washers,
    });
  } catch (error) {
    console.error("Error fetching washers:", error);
    res.status(500).json({ message: "Error fetching washers", error });
  }
};



// ✅ Get single washer by ID
exports.getWasherById = async (req, res) => {
  try {
    const washer = await Washer.findById(req.params.id);
    if (!washer) return res.status(404).json({ message: "Washer not found" });
    res.status(200).json(washer);
  } catch (error) {
    res.status(500).json({ message: "Error fetching washer", error });
  }
};

// ✅ Update washer
exports.updateWasher = async (req, res) => {
  try {
    const updatedWasher = await Washer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedWasher) return res.status(404).json({ message: "Washer not found" });
    res.status(200).json({
      message: "Washer updated successfully",
      washer: updatedWasher
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating washer", error });
  }
};

// ✅ Delete washer
exports.deleteWasher = async (req, res) => {
  try {
    const deletedWasher = await Washer.findByIdAndDelete(req.params.id);
    if (!deletedWasher) return res.status(404).json({ message: "Washer not found" });
    res.status(200).json({ message: "Washer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting washer", error });
  }
};


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

    // Mark assignments that were already washed today (IST) so client can disable buttons
    try {
      const now = new Date();
      const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffsetMs);
      const istYear = istNow.getUTCFullYear();
      const istMonth = istNow.getUTCMonth();
      const istDate = istNow.getUTCDate();
      // compute IST end of day timestamp
      const istEnd = new Date(Date.UTC(istYear, istMonth, istDate, 18, 29, 59, 999));

      customerVehicleAssignments.forEach(assignment => {
        try {
          const lastWash = assignment.washingSchedule && assignment.washingSchedule.lastWashDate ? new Date(assignment.washingSchedule.lastWashDate) : null;
          if (!lastWash) return;
          const lastWashIst = new Date(lastWash.getTime() + istOffsetMs);
          if (lastWashIst.getUTCFullYear() === istYear && lastWashIst.getUTCMonth() === istMonth && lastWashIst.getUTCDate() === istDate) {
            assignment.washedToday = true;
            assignment.disabledUntil = istEnd.getTime();
          }
        } catch (e) {
          // ignore per-assignment errors
        }
      });
    } catch (e) {
      // ignore marking errors
    }

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
            // Instead of excluding the assignment, keep it visible but mark as washedToday
            // and provide a disabledUntil timestamp (IST end of day) so the client can disable buttons
            try {
              // compute IST end-of-day timestamp (ms)
              const now = new Date();
              const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
              const istNow = new Date(now.getTime() + istOffsetMs);
              const istEnd = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 18, 29, 59, 999));
              assignment.washedToday = true;
              assignment.disabledUntil = istEnd.getTime();
            } catch (e) {
              assignment.washedToday = true;
            }
            return true; // keep it in the list
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
          totalMonthlyWashes,
          washedToday: assignment.washedToday || false,
          disabledUntil: assignment.disabledUntil || null
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
    // Support two formats: assignment row id (customerId or customerId-vehicleId) or explicit fields
    const { customerId, washerId, washType, location, vehicleId } = req.body;

    if (!customerId || !washerId) {
      return res.status(400).json({ message: "Customer ID and Washer ID are required" });
    }

    // Handle combined id format: "customerId-vehicleId"
    let actualCustomerId = customerId;
    let actualVehicleId = vehicleId || null;
    if (typeof customerId === 'string' && customerId.includes('-') && !vehicleId) {
      const parts = customerId.split('-');
      if (parts.length === 2) {
        actualCustomerId = parts[0];
        actualVehicleId = parts[1];
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(actualCustomerId) || !mongoose.Types.ObjectId.isValid(washerId)) {
      return res.status(400).json({ message: "Invalid Customer ID or Washer ID" });
    }
    if (actualVehicleId && !mongoose.Types.ObjectId.isValid(actualVehicleId)) {
      return res.status(400).json({ message: "Invalid Vehicle ID" });
    }

    // Verify customer and washer exist
    const customer = await Customer.findById(actualCustomerId).populate('vehicles.packageId');
    const washer = await Washer.findById(washerId);

    if (!customer || !washer) {
      return res.status(404).json({ message: "Customer or Washer not found" });
    }

    // If actualVehicleId provided, validate it exists on the customer
    let targetVehicle = null;
    if (actualVehicleId) {
      targetVehicle = Array.isArray(customer.vehicles) ? customer.vehicles.find(v => String(v._id) === String(actualVehicleId)) : null;
      if (!targetVehicle) {
        return res.status(404).json({ message: "Vehicle not found for this customer" });
      }
    } else if (Array.isArray(customer.vehicles) && customer.vehicles.length === 1) {
      // infer vehicle for single-vehicle customers
      targetVehicle = customer.vehicles[0];
      actualVehicleId = targetVehicle._id;
    }

    // Create wash log entry with optional vehicleId
    const washLog = new WashLog({
      customerId: actualCustomerId,
      vehicleId: actualVehicleId || null,
      washerId,
      washDate: new Date(),
      washType: washType || 'exterior',
      status: 'completed',
      location: location || customer.apartment,
      notes: `Completed by ${washer.name}`
    });

    await washLog.save();

    // Update customer's washingSchedule lastWashDate for the specific vehicle or customer
    try {
      if (actualVehicleId) {
        // set vehicle's washingSchedule.lastWashDate
        const vehicleIndex = customer.vehicles.findIndex(v => String(v._id) === String(actualVehicleId));
        if (vehicleIndex !== -1) {
          customer.vehicles[vehicleIndex].washingSchedule = customer.vehicles[vehicleIndex].washingSchedule || {};
          customer.vehicles[vehicleIndex].washingSchedule.lastWashDate = new Date();
        }
      } else {
        customer.washingSchedule = customer.washingSchedule || {};
        customer.washingSchedule.lastWashDate = new Date();
      }
      await customer.save();
    } catch (e) {
      console.error('Failed to update customer lastWashDate', e && e.message);
    }

    // Compute disabledUntil (IST end of day) for client to disable buttons
    let disabledUntil = null;
    try {
      const now = new Date();
      const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffsetMs);
      const istEnd = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 18, 29, 59, 999));
      disabledUntil = istEnd.getTime();
    } catch (e) {
      disabledUntil = Date.now();
    }

    // Update washer's completed washes count
    washer.totalWashesCompleted = (washer.totalWashesCompleted || 0) + 1;
    washer.lastActive = new Date();
    await washer.save();

    res.status(200).json({
      message: "Wash completed successfully",
      washLog,
      disabledUntil
    });
  } catch (error) {
    res.status(500).json({ message: "Error completing wash", error: error.message });
  }
};



// ✅ Add new washer (backend only)
exports.addnewWasher = async (req, res) => {
  try {
    const { name, mobileNo, email } = req.body;

    // Validate required fields
    if (!name || !mobileNo || !email) {
      return res.status(400).json({ message: "Name, mobile number, and email are required" });
    }

    // Optionally, check for duplicate email or mobileNo
    const existing = await Washer.findOne({ $or: [{ email }, { mobileNo }] });
    if (existing) {
      return res.status(409).json({ message: "Washer with this email or mobile number already exists" });
    }

    // Create new washer object (without status and totalWashesCompleted)
    const newWasher = new Washer({
      name,
      mobileNo,
      email
    });

    const savedWasher = await newWasher.save();

    res.status(201).json({
      message: "Washer created successfully!",
      washer: savedWasher
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating washer", error: error.message });
  }
};