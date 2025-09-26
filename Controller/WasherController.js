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

    // Get ALL customers assigned to this washer first
    let allCustomers = await Customer.find({ washerId: washerId })
      .populate("packageId");

    // Get unique apartments for dropdown (from all customers assigned to this washer)
    const apartmentList = [...new Set(allCustomers.map(customer => customer.apartment))].filter(Boolean);
    
    // Get unique car types for dropdown (from all customers assigned to this washer)
    const carTypeList = [...new Set(allCustomers.map(customer => customer.carType))].filter(Boolean);

    // Now get filtered customers
    let customers = await Customer.find(customerQuery)
      .populate("packageId");

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
      
      customers = customers.filter(customer => {
        console.log(`Customer ${customer.name}:`, {
          washingSchedule: customer.washingSchedule,
          washingDays: customer.washingSchedule?.washingDays,
          packageName: customer.packageName
        });
        
        if (!customer.washingSchedule || !customer.washingSchedule.washingDays || customer.washingSchedule.washingDays.length === 0) {
          // For customers without schedule, calculate based on package
          let defaultWashingDays = [];
          
          if (customer.packageName === 'Basic') {
            // Default to schedule1 for existing customers
            defaultWashingDays = [1, 4]; // Monday, Thursday
          } else if (customer.packageName === 'Moderate' || customer.packageName === 'Classic') {
            // Default to schedule1 for existing customers  
            defaultWashingDays = [1, 3, 5]; // Monday, Wednesday, Friday
          }
          
          console.log(`Using default schedule for ${customer.name}:`, defaultWashingDays);
          return defaultWashingDays.includes(washingScheduleDay);
        }
        
        const hasWashOnDay = customer.washingSchedule.washingDays.includes(washingScheduleDay);
        console.log(`${customer.name} has wash on ${washingScheduleDay}:`, hasWashOnDay);
        return hasWashOnDay;
      });
    } else if (date === 'today' || !date) {
      // Default: show only customers who need wash today
      const today = new Date();
      const todayDayOfWeek = today.getDay();
      
      // Convert JavaScript day to washing schedule day
      const todayWashingScheduleDay = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;
      
      console.log(`Filtering for today: ${todayDayOfWeek} (JS) -> ${todayWashingScheduleDay} (washing schedule) (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][todayDayOfWeek]})`);
      
      customers = customers.filter(customer => {
        let washingDays = [];
        
        if (!customer.washingSchedule || !customer.washingSchedule.washingDays || customer.washingSchedule.washingDays.length === 0) {
          // For customers without schedule, calculate based on package
          if (customer.packageName === 'Basic') {
            washingDays = [1, 4]; // Monday, Thursday
          } else if (customer.packageName === 'Moderate' || customer.packageName === 'Classic') {
            washingDays = [1, 3, 5]; // Monday, Wednesday, Friday
          }
        } else {
          washingDays = customer.washingSchedule.washingDays;
        }
        
        // Check if today is a washing day
        const hasWashToday = washingDays.includes(todayWashingScheduleDay);
        if (!hasWashToday) {
          return false;
        }
        
        // Check if wash already completed today
        const lastWash = customer.washingSchedule?.lastWashDate;
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

    // Calculate wash counts and schedule info for each customer
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

        // Calculate next wash date for customer
        const today = new Date();
        const todayDayOfWeek = today.getDay();
        const washingDays = customer.washingSchedule?.washingDays || [];
        
        // Check if customer needs wash today
        let needsWashToday = false;
        if (washingDays.includes(todayDayOfWeek)) {
          const lastWash = customer.washingSchedule?.lastWashDate;
          if (!lastWash) {
            needsWashToday = true;
          } else {
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const lastWashStart = new Date(lastWash.getFullYear(), lastWash.getMonth(), lastWash.getDate());
            needsWashToday = lastWashStart.getTime() < todayStart.getTime();
          }
        }
        
        // Get washing days as day names
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const washingDayNames = washingDays.map(day => dayNames[day]);

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
          totalMonthlyWashes,
          // Schedule information
          washingDays: washingDays,
          washingDayNames,
          nextWashDate: customer.washingSchedule?.nextWashDate,
          lastWashDate: customer.washingSchedule?.lastWashDate,
          needsWashToday: needsWashToday,
          scheduleType: customer.washingSchedule?.scheduleType || 'schedule1'
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
      customers: customersWithWashCounts,
      apartments: apartmentList, // For apartment filter dropdown
      carTypes: carTypeList, // For car type filter dropdown
      totalCustomers: customersWithWashCounts.length,
      filters: {
        date: date || 'today',
        apartment: apartment || 'all'
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
