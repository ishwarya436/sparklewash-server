// customerController.js
const Customer = require("../models/Customer");
const Package = require('../models/Package');
const WashLog = require("../models/WashLog");
const Washer = require("../models/Washer");
const mongoose = require("mongoose");
const XLSX = require('xlsx');

const { EXTService, IntExtService } = require("../utils/SMSService");
const renewalService = require('../services/renewalService');

// Start package for a vehicle
exports.startVehiclePackage = async (req, res) => {
    try {
        const { customerId, vehicleId } = req.params;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(vehicleId)) {
            return res.status(400).json({ message: "Invalid customer or vehicle ID" });
        }

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // Find the vehicle
        const vehicle = customer.vehicles.id(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }

        // Check if package is already started
        if (vehicle.hasStarted) {
            return res.status(400).json({ message: "Package is already started for this vehicle" });
        }

        // Set start date to now and end date to 29 days later
        const now = new Date();
        vehicle.packageStartDate = now;
        vehicle.packageEndDate = new Date(now);
        vehicle.packageEndDate.setDate(vehicle.packageEndDate.getDate() + 29); // Always 29 days
        vehicle.hasStarted = true;
        // Enable auto-renew by default after the first manual start
        if (typeof vehicle.autoRenew === 'undefined') vehicle.autoRenew = true;

        // Add to package history
        if (!vehicle.packageHistory) vehicle.packageHistory = [];
        vehicle.packageHistory.push({
            packageId: vehicle.packageId,
            packageName: vehicle.packageName,
            startDate: vehicle.packageStartDate,
            endDate: vehicle.packageEndDate,
          autoRenewed: false
        });

        await customer.save();

        res.status(200).json({
            message: "Package started successfully",
            startDate: vehicle.packageStartDate,
            endDate: vehicle.packageEndDate,
            vehicle: vehicle
        });

    } catch (error) {
        console.error("Error starting package:", error);
        res.status(500).json({ message: "Error starting package", error: error.message });
    }
};

// Helper function to calculate wash counts for a customer
const calculateWashCounts = async (customer, vehicleId = null) => {
  try {
    // If vehicleId is provided, calculate for specific vehicle
    if (vehicleId) {
      let vehicle = customer.vehicles?.find(v => v._id.toString() === vehicleId.toString());
      if (!vehicle || !vehicle.packageId) {
        return { completed: 0, pending: 0, total: 0 };
      }
      // If package expired and vehicle is set to autoRenew (default true), renew now
      try {
        const now = new Date();
        if (vehicle.packageEndDate && new Date(vehicle.packageEndDate) <= now && vehicle.autoRenew !== false) {
          console.log(`Auto-renew triggered for vehicle ${vehicle._id} (customer ${customer._id})`);
          await renewalService.renewVehiclePackage(customer._id, vehicle._id);
          // reload customer and vehicle references after renewal
          const refreshed = await Customer.findById(customer._id).populate('vehicles.packageId');
          if (refreshed) {
            customer = refreshed;
            vehicle = customer.vehicles?.find(v => v._id.toString() === vehicleId.toString());
          }
        }
      } catch (renewErr) {
        console.error('Error auto-renewing vehicle package in calculateWashCounts:', renewErr);
      }
      
      // Calculate total washes for current month based on vehicle's package
      let totalMonthlyWashes = 0;
      const packageName = vehicle.packageId.name || vehicle.packageName;
      
      if (packageName === 'Basic') {
        totalMonthlyWashes = 8; // 2 times per week * 4 weeks
      } else if (packageName === 'Moderate' || packageName === 'Classic' || packageName === 'Hatch Pack') {
        totalMonthlyWashes = 12; // 3 times per week * 4 weeks
      }
      
      // Calculate date range for current month
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Count completed washes this month for this specific vehicle
      const completedWashes = await WashLog.countDocuments({
        customerId: customer._id,
        vehicleId: vehicle._id,
        washDate: {
          $gte: startOfMonth,
          $lte: endOfMonth
        },
        status: 'completed'
      });
      
      // Calculate pending washes
      const pendingWashes = Math.max(0, totalMonthlyWashes - completedWashes);
      
      console.log('🔍 Vehicle wash counts:', {
        vehicleId: vehicle._id,
        vehicleNo: vehicle.vehicleNo,
        packageName,
        totalMonthlyWashes,
        completedWashes,
        pendingWashes
      });
      
      return {
        completed: completedWashes,
        pending: pendingWashes,
        total: totalMonthlyWashes
      };
    }
    
    // Original logic for single-vehicle customers
    // If legacy single-customer package expired and autoRenew is enabled, renew now
    try {
      const now = new Date();
      if (!customer.vehicles || customer.vehicles.length === 0) {
        if (customer.packageEndDate && new Date(customer.packageEndDate) <= now && customer.autoRenew !== false) {
          console.log(`Auto-renew triggered for legacy customer ${customer._id}`);
          const prevEnd = customer.packageEndDate || now;
          const newStart = prevEnd;
          const newEnd = new Date(prevEnd);
          newEnd.setDate(newEnd.getDate() + 29);
          await Customer.updateOne(
            { _id: customer._id },
            {
              $set: { packageStartDate: newStart, packageEndDate: newEnd },
              $push: { packageHistory: { packageId: customer.packageId, packageName: customer.packageName, startDate: newStart, endDate: newEnd, autoRenewed: true, renewedOn: new Date() } }
            }
          );
          // reload customer for fresh data
          customer = await Customer.findById(customer._id);
        }
      }
    } catch (legacyRenewErr) {
      console.error('Error auto-renewing legacy single-customer package in calculateWashCounts:', legacyRenewErr);
    }

    if (!customer.packageId) return { completed: 0, pending: 0, total: 0 };
    
    // Calculate total washes for current month based on package
    let totalMonthlyWashes = 0;
    const packageName = customer.packageId.name;
    
    if (packageName === 'Basic') {
      totalMonthlyWashes = 8; // 2 times per week * 4 weeks
    } else if (packageName === 'Moderate' || packageName === 'Classic' || packageName === 'Hatch Pack') {
      totalMonthlyWashes = 12; // 3 times per week * 4 weeks
    }
    
    // Calculate date range for current month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Count completed washes this month (without vehicleId filter for single-vehicle customers)
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



// ✅ Get all customers with package & washer details + wash counts (Multi-vehicle support)
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate("packageId")   // Get package details for backward compatibility
      .populate("washerId")    // Get washer details for backward compatibility
      .populate("vehicles.packageId")  // Get package details for each vehicle
      .populate("vehicles.washerId");  // Get washer details for each vehicle

    // Add wash counts for each customer
    const customersWithWashCounts = await Promise.all(
      customers.map(async (customer) => {
        let aggregateWashCounts = { completed: 0, pending: 0, total: 0 };
        
        // Handle multi-vehicle customers
        if (customer.vehicles && customer.vehicles.length > 0) {
          // Calculate wash counts for each vehicle individually
          const vehiclesWithWashCounts = await Promise.all(
            customer.vehicles.map(async (vehicle) => {
              const vehicleWashCounts = await calculateWashCounts(customer, vehicle._id);
              aggregateWashCounts.completed += vehicleWashCounts.completed;
              aggregateWashCounts.pending += vehicleWashCounts.pending;
              aggregateWashCounts.total += vehicleWashCounts.total;
              
              return {
                _id: vehicle._id,
                carModel: vehicle.carModel,
                vehicleNo: vehicle.vehicleNo,
                carType: vehicle.carType,
                packageId: vehicle.packageId,
                // Preserve package start/end dates that live on the vehicle subdocument
                packageStartDate: vehicle.packageStartDate,
                packageEndDate: vehicle.packageEndDate,
                packageName: vehicle.packageId ? (vehicle.packageId.name || vehicle.packageName) : vehicle.packageName || null,
                washerId: vehicle.washerId,
                washingSchedule: vehicle.washingSchedule,
                status: vehicle.status,
                // Individual vehicle wash counts
                pendingWashes: vehicleWashCounts.pending,
                completedWashes: vehicleWashCounts.completed,
                totalMonthlyWashes: vehicleWashCounts.total
              };
            })
          );
          
          return {
            _id: customer._id,
            name: customer.name,
            mobileNo: customer.mobileNo,
            email: customer.email,
            apartment: customer.apartment,
            doorNo: customer.doorNo,
            // Multi-vehicle specific fields with individual wash counts
            vehicles: vehiclesWithWashCounts,
            totalVehicles: customer.totalVehicles,
            hasMultipleVehicles: customer.hasMultipleVehicles,
            primaryVehicle: customer.primaryVehicle,
            // Aggregate wash counts across all vehicles
            aggregateWashCounts: aggregateWashCounts,
            pendingWashes: aggregateWashCounts.pending,
            completedWashes: aggregateWashCounts.completed,
            totalMonthlyWashes: aggregateWashCounts.total,
            // Primary vehicle info for display compatibility
            carModel: customer.vehicles[0].carModel,
            vehicleNo: customer.vehicles[0].vehicleNo,
            packageName: customer.vehicles[0].packageId ? customer.vehicles[0].packageId.name : null,
            price: customer.vehicles[0].packageId ? customer.vehicles[0].packageId.pricePerMonth : 0
          };
        } else {
          // Handle single vehicle customers (backward compatibility)
          const washCounts = await calculateWashCounts(customer);
          
          return {
            _id: customer._id,
            name: customer.name,
            mobileNo: customer.mobileNo,
            email: customer.email,
            apartment: customer.apartment,
            doorNo: customer.doorNo,
            carModel: customer.carModel,
            carType: customer.carType,
            vehicleNo: customer.vehicleNo,
            packageId: customer.packageId,
            packageName: customer.packageId ? customer.packageId.name : null,
            washerId: customer.washerId,

            packageStartDate: customer.packageStartDate,
            packageEndDate: customer.packageEndDate,
            status: customer.status,
            washingSchedule: customer.washingSchedule,
            totalVehicles: 1,
            hasMultipleVehicles: false,
            // Wash count information
            pendingWashes: washCounts.pending,
            completedWashes: washCounts.completed,
            totalMonthlyWashes: washCounts.total,
            price: customer.packageId ? customer.packageId.pricePerMonth : 0
          };
        }
      })
    );

    res.status(200).json(customersWithWashCounts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching customers", error: error.message });
  }
};

// ✅ Get single customer with wash counts
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    console.log(`getCustomerById called for id=${id}`);

    // 1) simple lean fetch first (safe)
    let customer = await Customer.findById(id)
      .select('-__v')
      .lean();
    console.log('getCustomerById - simple fetch returned?', !!customer);

    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // 2) attempt to populate refs only if needed and wrapped in try/catch
    try {
      const populated = await Customer.findById(id)
        .populate('packageId')
        .populate('washerId')
        .populate('vehicles.packageId')
        .populate('vehicles.washerId')
        .populate('vehicles.packageHistory.packageId')
        .populate('packageHistory.packageId')
        .lean();
      console.log('getCustomerById - populated fetch succeeded');
      if (populated) customer = populated;
    } catch (popErr) {
      console.error('getCustomerById - populate failed:', popErr && popErr.stack ? popErr.stack : popErr);
      // proceed with lean customer data
    }

    // compute wash counts (works with lean or populated customer)
    const washCounts = await calculateWashCounts(customer);

    const customerWithWashCounts = {
      ...customer,
      packageName: customer.packageId ? (customer.packageId.name || customer.packageName) : null,
      packageStartDate: customer.packageStartDate,
      packageEndDate: customer.packageEndDate,
      pendingWashes: washCounts.pending,
      completedWashes: washCounts.completed,
      totalMonthlyWashes: washCounts.total,
      price: customer.packageId ? (customer.packageId.pricePerMonth || 0) : 0
    };

    // Attach recent completed wash info per vehicle (within last 3 hours) so admin can cancel
    try {
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      const now = new Date();
      if (customerWithWashCounts.vehicles && Array.isArray(customerWithWashCounts.vehicles)) {
        for (let v of customerWithWashCounts.vehicles) {
          try {
            const cutoff = new Date(now.getTime() - THREE_HOURS_MS);
            const recent = await WashLog.findOne({
              customerId: customer._id,
              vehicleId: v._id,
              status: 'completed',
              $or: [
                { completedAt: { $gte: cutoff } },
                { washDate: { $gte: cutoff } }
              ]
            }).sort({ completedAt: -1, washDate: -1 });
            if (recent) {
              v.recentWash = { _id: recent._id, completedAt: recent.completedAt || recent.washDate };
            } else {
              v.recentWash = null;
            }
          } catch (e) {
            v.recentWash = null;
          }
        }
      }
    } catch (err) {
      console.error('Error attaching recent wash info:', err && err.message);
    }

    res.status(200).json(customerWithWashCounts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching customer", error: error.message });
  }
};

// ✅ Add new customer (Multi-vehicle support)
exports.addCustomer = async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    
    const {
      name,
      mobileNo,
      email,
      apartment,
      doorNo,
      vehicles, // Array of vehicles for multi-vehicle customers
      // Backward compatibility fields for single vehicle
      carModel,
      vehicleNo,
      packageId,
      packageName,
      washerId,
      scheduleType
    } = req.body;

    // Validate required fields
    if (!name || !mobileNo || !apartment || !doorNo) {
      return res.status(400).json({ 
        message: "Name, mobile number, apartment, and door number are required" 
      });
    }

    // Handle multi-vehicle creation
    if (vehicles && vehicles.length > 0) {
      // Validate vehicle data
      for (const vehicle of vehicles) {
        if (!vehicle.carModel || !vehicle.vehicleNo || !vehicle.packageId) {
          return res.status(400).json({ 
            message: "Each vehicle must have car model, vehicle number, and package" 
          });
        }

        // Check if vehicle number already exists
        const existingVehicle = await Customer.findOne({ 
          $or: [
            { vehicleNo: vehicle.vehicleNo.trim() },
            { "vehicles.vehicleNo": vehicle.vehicleNo.trim() }
          ]
        });
        
        if (existingVehicle) {
          return res.status(400).json({ 
            message: `Vehicle number ${vehicle.vehicleNo} already exists` 
          });
        }
      }

      // Process each vehicle
      const processedVehicles = await Promise.all(
        vehicles.map(async (vehicle) => {
          const Package = require('../models/Package');
          const selectedPackage = await Package.findById(vehicle.packageId);
          if (!selectedPackage) {
            throw new Error(`Package not found for vehicle ${vehicle.vehicleNo}`);
          }
          // Initialize dates as null - will be set when package is started
          const packageStartDate = null;
          const packageEndDate = null;
         
          // Determine washing schedule
          let washingDays = [];
          let washFrequencyPerMonth = 8;
          const selectedScheduleType = vehicle.scheduleType || 'schedule1';
          if (selectedPackage.name === 'Basic') {
            washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
            washFrequencyPerMonth = 8;
          } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic' || selectedPackage.name === 'Hatch Pack') {
            washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
            washFrequencyPerMonth = 12;
          }
          return {
            carModel: vehicle.carModel.trim(),
            vehicleNo: vehicle.vehicleNo.trim().toUpperCase(),
            carType: selectedPackage.carType || 'sedan',
            packageId: vehicle.packageId,
            packageName: selectedPackage.name,
            washerId: vehicle.washerId || null,
            washingSchedule: {
              scheduleType: selectedScheduleType,
              washingDays: washingDays,
              washFrequencyPerMonth: washFrequencyPerMonth
            },
            
            packageStartDate,
            packageEndDate,
            status: 'active'
          };
        })
      );

      // Create multi-vehicle customer
      const newCustomer = new Customer({
        name: name.trim(),
        mobileNo: mobileNo.trim(),
        email: email ? email.trim() : '',
        apartment: apartment.trim(),
        doorNo: doorNo.trim(),
        vehicles: processedVehicles,
        status: 'active',
        // Explicitly set old schema fields to undefined for multi-vehicle customers
        vehicleNo: undefined,
        carModel: undefined,
        carType: undefined,
        packageId: undefined,
        packageName: undefined,
        washerId: undefined,
        washingSchedule: undefined,
        
      });

      const savedCustomer = await newCustomer.save();

      // Record package history for each vehicle
      for (const vehicle of savedCustomer.vehicles) {
        if (!vehicle.packageHistory) vehicle.packageHistory = [];
        vehicle.packageHistory.push({
          packageId: vehicle.packageId,
          packageName: vehicle.packageName,
          startDate: vehicle.packageStartDate,
          endDate: vehicle.packageEndDate,
          autoRenewed: false
        });
      }
      await savedCustomer.save();

      // Populate vehicle package and washer details (ensure all fields are present)
      const populatedCustomer = await Customer.findById(savedCustomer._id)
        .populate('vehicles.packageId')
        .populate('vehicles.washerId');

      res.status(201).json({ 
        message: "Multi-vehicle customer created successfully", 
        customer: populatedCustomer 
      });

    } else {
      // Handle single vehicle creation (backward compatibility)
      if (!carModel || !vehicleNo || !packageId) {
        return res.status(400).json({ 
          message: "Car model, vehicle number, and package are required" 
        });
      }

      // Check if vehicle number already exists
      const existingVehicle = await Customer.findOne({ 
        $or: [
          { vehicleNo: vehicleNo.trim() },
          { "vehicles.vehicleNo": vehicleNo.trim() }
        ]
      });
      
      if (existingVehicle) {
        return res.status(400).json({ 
          message: `Vehicle number ${vehicleNo} already exists` 
        });
      }

      // Get package details
      const Package = require('../models/Package');
      const selectedPackage = await Package.findById(packageId);
      
      if (!selectedPackage) {
        return res.status(400).json({ 
          message: "Selected package not found" 
        });
      }

      // Calculate subscription dates and washing schedule
     

      let washingDays = [];
      let washFrequencyPerMonth = 8;
      
      const selectedScheduleType = scheduleType || 'schedule1';
      
      if (selectedPackage.name === 'Basic') {
        washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
        washFrequencyPerMonth = 8;
      } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic' || selectedPackage.name === 'Hatch Pack') {
        washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
        washFrequencyPerMonth = 12;
      }

      // Create single vehicle customer
      const now = new Date();
      const packageStartDate = now;
      const packageEndDate = new Date(now);
      packageEndDate.setMonth(packageEndDate.getMonth() + 1);
      const newCustomer = new Customer({
        name: name.trim(),
        mobileNo: mobileNo.trim(),
        email: email ? email.trim() : '',
        apartment: apartment.trim(),
        doorNo: doorNo.trim(),
        carModel: carModel.trim(),
        vehicleNo: vehicleNo.trim().toUpperCase(),
        carType: selectedPackage.carType || 'sedan',
        packageId,
        packageName: selectedPackage.name,
        washerId: washerId || null,
        washingSchedule: {
          scheduleType: selectedScheduleType,
          washingDays: washingDays,
          washFrequencyPerMonth: washFrequencyPerMonth
        },
        
        packageStartDate,
        packageEndDate,
        status: 'active'
      });

      const savedCustomer = await newCustomer.save();
      
      // Record package history (legacy single-vehicle fields)
      if (!savedCustomer.packageHistory) savedCustomer.packageHistory = [];
      savedCustomer.packageHistory.push({
        packageId: savedCustomer.packageId,
        packageName: savedCustomer.packageName,
        startDate: savedCustomer.packageStartDate,
        endDate: savedCustomer.packageEndDate,
        autoRenewed: false
      });
      await savedCustomer.save();

      const populatedCustomer = await Customer.findById(savedCustomer._id)
        .populate('packageId')
        .populate('washerId');

      // Add packageStartDate and packageEndDate to response
      const responseCustomer = {
        ...populatedCustomer.toObject(),
        packageStartDate: savedCustomer.packageStartDate,
        packageEndDate: savedCustomer.packageEndDate
      };

      res.status(201).json({ 
        message: "Customer created successfully", 
        customer: populatedCustomer 
      });
    }

  } catch (error) {
    // Log full error for debugging
    console.error('Error creating customer:', error && (error.stack || error));

    if (error && error.code === 11000) {
      // Handle duplicate key error
      const duplicateField = Object.keys(error.keyValue)[0];
      const duplicateValue = error.keyValue[duplicateField];

      return res.status(400).json({
        message: `${duplicateField === 'vehicleNo' ? 'Vehicle number' : duplicateField} '${duplicateValue}' already exists`,
        error: error.message,
        stack: error.stack
      });
    }

    // Return a concise error to client
    res.status(500).json({
      message: "Error creating customer",
      error: error.message
    });
  }
};

// ✅ Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Delete associated wash logs
    await WashLog.deleteMany({ customerId: id });

    // Delete the customer
    await Customer.findByIdAndDelete(id);

    res.status(200).json({ 
      message: "Customer and associated data deleted successfully",
      deletedCustomer: customer.name
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting customer", error: error.message });
  }
};

// Manual trigger to run auto-renew logic (can be called by cron or admin)
exports.triggerAutoRenew = async (req, res) => {
  try {
    const result = await renewalService.runAutoRenewOnce();
    res.status(200).json({ message: 'Auto-renew run completed', result });
  } catch (error) {
    console.error('Error running auto-renew:', error);
    res.status(500).json({ message: 'Error running auto-renew', error: error.message });
  }
};

// Get package history for a customer or specific vehicle
exports.getPackageHistory = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;
    console.log(`getPackageHistory called - path=${req.path} customerId=${customerId} vehicleId=${vehicleId}`);
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: 'Invalid or missing customerId' });
    }

    // If vehicleId provided, validate it too
    if (vehicleId && !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ message: 'Invalid vehicleId' });
    }

    // First, try a simple lean fetch without populate (cheaper and safer)
    console.log('getPackageHistory - simple findById (no populate) for', customerId);
    let customer = await Customer.findById(customerId).select('vehicles packageHistory name').lean();
    console.log('getPackageHistory - simple fetch returned?', !!customer);

    // If we found the customer and requested a vehicle, try to return any inline packageHistory right away
    if (customer && vehicleId) {
      const vehicle = Array.isArray(customer.vehicles) ? customer.vehicles.find(v => String(v._id) === String(vehicleId)) : null;
      if (vehicle && vehicle.packageHistory && vehicle.packageHistory.length > 0) {
        console.log('getPackageHistory - returning inline vehicle.packageHistory');
        return res.status(200).json({ packageHistory: vehicle.packageHistory });
      }
    }

    // If inline data not present, attempt a populated fetch as a second step
    try {
      console.log('getPackageHistory - attempting populated fetch for', customerId);
      const populated = await Customer.findById(customerId)
        .select('vehicles packageHistory name')
        .populate('vehicles.packageHistory.packageId')
        .populate('packageHistory.packageId')
        .lean();
      console.log('getPackageHistory - populated fetch returned?', !!populated);
      customer = populated || customer;
    } catch (populateErr) {
      console.error('getPackageHistory - populate failed:', populateErr && populateErr.stack ? populateErr.stack : populateErr);
      // proceed with whatever simple customer we have (could be null)
    }

    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // If vehicleId requested, find the vehicle subdocument safely
    if (vehicleId) {
      const vehicle = Array.isArray(customer.vehicles) ? customer.vehicles.find(v => String(v._id) === String(vehicleId)) : null;
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      return res.status(200).json({ packageHistory: vehicle.packageHistory || [] });
    }

    // Return customer-level packageHistory (legacy single-vehicle)
    return res.status(200).json({ packageHistory: customer.packageHistory || [] });
  } catch (error) {
    console.error('Error fetching package history:', error && error.stack ? error.stack : error);
    res.status(500).json({ message: 'Error fetching package history', error: error && error.message ? error.message : String(error) });
  }
};

// Admin endpoint: backfill packageHistory from existing packageStartDate/packageEndDate
exports.backfillPackageHistory = async (req, res) => {
  try {
    const customers = await Customer.find();
    let updatedCount = 0;

    for (const c of customers) {
      let changed = false;

      // Legacy single-vehicle
      if (!c.vehicles || c.vehicles.length === 0) {
        if ((c.packageStartDate || c.packageEndDate) && (!c.packageHistory || c.packageHistory.length === 0)) {
          c.packageHistory = c.packageHistory || [];
          c.packageHistory.push({
            packageId: c.packageId,
            packageName: c.packageName,
            startDate: c.packageStartDate,
            endDate: c.packageEndDate,
            autoRenewed: false
          });
          changed = true;
        }
      } else {
        for (const v of c.vehicles) {
          if ((v.packageStartDate || v.packageEndDate) && (!v.packageHistory || v.packageHistory.length === 0)) {
            v.packageHistory = v.packageHistory || [];
            v.packageHistory.push({
              packageId: v.packageId,
              packageName: v.packageName,
              startDate: v.packageStartDate,
              endDate: v.packageEndDate,
              autoRenewed: false
            });
            changed = true;
          }
        }
      }

      if (changed) {
        await c.save();
        updatedCount++;
      }
    }

    res.status(200).json({ message: 'Backfill completed', updatedCustomers: updatedCount });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ message: 'Backfill failed', error: error.message });
  }
};

// ✅ Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      mobileNo,
      email,
      apartment,
      doorNo,
      carModel,
      vehicleNo,
      packageId,
      packageName,
      washerId,
      scheduleType // Add scheduleType support
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    // Validate required fields (handle multi-vehicle customers differently)
    // Fetch existing customer to know if this is a multi-vehicle customer
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) return res.status(404).json({ message: 'Customer not found' });

    const isMultiVehicleCustomer = existingCustomer.vehicles && existingCustomer.vehicles.length > 0;

    if (!name || !mobileNo || !apartment || !doorNo) {
      return res.status(400).json({ message: "Name, mobileNo, apartment and doorNo are required" });
    }

    // For single-vehicle customers, require carModel, vehicleNo and packageId
    if (!isMultiVehicleCustomer) {
      if (!carModel || !vehicleNo || !packageId) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }
    }

    // Check if vehicle number already exists (exclude current customer)
    const existingVehicle = await Customer.findOne({ 
      vehicleNo: vehicleNo.trim(),
      _id: { $ne: id }
    });
    if (existingVehicle) {
      return res.status(400).json({ 
        message: `Vehicle number ${vehicleNo} already exists. Please check and update.` 
      });
    }

    // Get package details to determine carType and calculate washing schedule
    const Package = require('../models/Package');
    let selectedPackage = null;
    if (packageId) {
      selectedPackage = await Package.findById(packageId);
      if (!selectedPackage && !isMultiVehicleCustomer) {
        // For single-vehicle customers packageId is required and must exist
        return res.status(400).json({ message: "Selected package not found" });
      }
    }

    // Calculate washing schedule if scheduleType is provided
    let washingScheduleUpdate = {};
    if (scheduleType) {
      let washingDays = [];
      let washFrequencyPerMonth = 8; // Default for Basic
      
      if (packageName === 'Basic') {
        // Basic: 2 times a week
        washingDays = scheduleType === 'schedule1' ? [1, 4] : [2, 6]; // Mon+Thu or Tue+Sat
        washFrequencyPerMonth = 8;
      } else if (packageName === 'Moderate' || packageName === 'Classic' || packageName === 'Hatch Pack') {
        // Moderate/Classic/Hatch Pack: 3 times a week
        washingDays = scheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6]; // Mon+Wed+Fri or Tue+Thu+Sat
        washFrequencyPerMonth = 12;
      }

      washingScheduleUpdate = {
        'washingSchedule.scheduleType': scheduleType,
        'washingSchedule.washingDays': washingDays,
        'washingSchedule.washFrequencyPerMonth': washFrequencyPerMonth
      };
    }

    // Prepare update data - handle empty washerId
    const updateData = {
      name,
      mobileNo,
      email,
      apartment,
      doorNo,
      updatedAt: new Date(),
      ...washingScheduleUpdate // Include washing schedule updates
    };

    // Only set single-vehicle fields for customers that are single-vehicle
    if (!isMultiVehicleCustomer) {
      updateData.carModel = carModel;
      updateData.carType = selectedPackage ? selectedPackage.carType : undefined;
      updateData.vehicleNo = vehicleNo;
      updateData.packageId = packageId;
      updateData.packageName = packageName; // Update package name directly
    }

    // Only add washerId if it's not empty
    if (washerId && washerId.trim() !== '') {
      updateData.washerId = washerId;
    } else {
      // Remove washerId if empty
      updateData.$unset = { washerId: 1 };
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("packageId").populate("washerId");

    if (!updatedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Calculate wash counts for the updated customer
    const washCounts = await calculateWashCounts(updatedCustomer);

    const customerWithWashCounts = {
      ...updatedCustomer.toObject(),
      packageName: updatedCustomer.packageName || (updatedCustomer.packageId ? updatedCustomer.packageId.name : null),
      pendingWashes: washCounts.pending,
      completedWashes: washCounts.completed,
      totalMonthlyWashes: washCounts.total,
      price: updatedCustomer.packageId ? updatedCustomer.packageId.pricePerMonth : 0
    };

    res.status(200).json({
      message: "Customer updated successfully",
      customer: customerWithWashCounts
    });
    
    // If package or package dates were provided in the request, append a packageHistory entry
    try {
      const shouldAppendHistory = packageId || req.body.packageStartDate || req.body.packageEndDate;
      if (shouldAppendHistory) {
        const cust = await Customer.findById(updatedCustomer._id);
        if (!cust.packageHistory) cust.packageHistory = [];
        cust.packageHistory.push({
          packageId: cust.packageId,
          packageName: cust.packageName,
          startDate: cust.packageStartDate,
          endDate: cust.packageEndDate,
          autoRenewed: false
        });
        await cust.save();
      }
    } catch (err) {
      console.error('Error appending package history after updateCustomer:', err.message);
    }
  } catch (error) {
    res.status(500).json({ message: "Error updating customer", error: error.message });
  }
};

// ✅ Allocate washer to customer
exports.allocateWasher = async (req, res) => {
  try {
    const { customerId, washerId } = req.body;

    if (!customerId || !washerId) {
      return res.status(400).json({ message: "Customer ID and Washer ID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(washerId)) {
      return res.status(400).json({ message: "Invalid customer or washer ID" });
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Verify washer exists
    const washer = await Washer.findById(washerId);
    if (!washer) {
      return res.status(404).json({ message: "Washer not found" });
    }

    // Update customer with washer assignment
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { washerId: washerId },
      { new: true, runValidators: true }
    ).populate("packageId").populate("washerId");

    // Calculate wash counts for the updated customer
    const washCounts = await calculateWashCounts(updatedCustomer);

    const customerWithWashCounts = {
      ...updatedCustomer.toObject(),
      packageName: updatedCustomer.packageName || (updatedCustomer.packageId ? updatedCustomer.packageId.name : null),
      pendingWashes: washCounts.pending,
      completedWashes: washCounts.completed,
      totalMonthlyWashes: washCounts.total,
      price: updatedCustomer.packageId ? updatedCustomer.packageId.pricePerMonth : 0
    };

    res.status(200).json({
      message: `Washer ${washer.name} allocated to customer ${customer.name} successfully`,
      customer: customerWithWashCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Error allocating washer", error: error.message });
  }
};

// ✅ Get customer wash history
exports.getCustomerWashHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query; // Format: YYYY-MM

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    // Parse month filter
    let startDate, endDate;
    if (month) {
      const [year, monthNum] = month.split('-');
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0, 23, 59, 59);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const washHistory = await WashLog.find({
      customerId: id,
      washDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('washerId', 'name')
    .sort({ washDate: -1 });

    // Format the response
    const formattedHistory = washHistory.map(wash => ({
      _id: wash._id,
      washDate: wash.washDate,
      washType: wash.washType,
      status: wash.status,
      location: wash.location,
      notes: wash.notes,
      // Prefer explicit washerName stored on the log (set when admin completes using assigned washer),
      // otherwise use the populated washerId's name, else Unknown
      washerName: (wash.washerName && String(wash.washerName).trim().length > 0) ? wash.washerName : (wash.washerId ? wash.washerId.name : 'Unknown'),
      washerId: wash.washerId ? (wash.washerId._id || wash.washerId) : null,
      vehicleId: wash.vehicleId || null,
      vehicleNo: wash.vehicleNo || null
    }));

    res.status(200).json({
      washHistory: formattedHistory,
      totalWashes: formattedHistory.length,
      month: month || `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching wash history", error: error.message });
  }
};

// ✅ Get pending scheduled washes for a customer (by vehicle)
exports.getPendingWashesForCustomer = async (req, res) => {
  try {
    // Support both /:id and /:customerId route parameter names
    const id = req.params.customerId || req.params.id;
    const { month } = req.query; // optional YYYY-MM or 'all' to view full package window

    console.debug('getPendingWashesForCustomer - customerId:', id, 'month:', month);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    // Determine whether the caller wants to view the full package duration
    const viewPackageWindow = (typeof month === 'string' && month.toLowerCase() === 'all');

    // Default to calendar month unless package window requested
    let startDate = null, endDate = null;
    if (!viewPackageWindow) {
      if (!month) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        // Accept either YYYY-MM or human-readable month strings (e.g. "January, 2026")
        const ymdMatch = String(month).trim().match(/^(\d{4})-(\d{1,2})$/);
        if (ymdMatch) {
          const targetYear = Number(ymdMatch[1]);
          const targetMonth = Number(ymdMatch[2]) - 1; // 0-based
          startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0);
          endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
        } else {
          // Try to parse other common formats (like "January, 2026")
          const parsed = new Date(month);
          if (isNaN(parsed.getTime())) {
            console.warn('getPendingWashesForCustomer - invalid month format:', month);
            return res.status(400).json({ message: 'Invalid month format. Pass YYYY-MM or the literal "all".' });
          }
          startDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1, 0, 0, 0);
          endDate = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0, 23, 59, 59);
        }
      }
    }

    // Utility: generate dates between arbitrary start/end matching washingDays
    const generateDatesForRange = (washingDays = [], rangeStart = startDate, rangeEnd = endDate) => {
      const dates = [];
      if (!rangeStart || !rangeEnd) return dates;
      for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay(); // 0 (Sun) - 6 (Sat)
        const scheduleDay = jsDay === 0 ? 7 : jsDay; // 1..7 mapping
        if (washingDays.includes(scheduleDay)) {
          dates.push(new Date(d));
        }
      }
      return dates;
    };

    // Fetch customer and populate package info for vehicles
    const customer = await Customer.findById(id).populate('packageId').populate('vehicles.packageId');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Utilities for interior detection (mirror WasherDashboard heuristics)
    const { hasInteriorFromPackage, parseInteriorCleaningValue } = require('../utils/packageHelpers');
    const entityHasInterior = (obj, pkg) => {
      if (!obj && !pkg) return false;
      // Business rule: any package named 'Moderate' explicitly disallows interior
      const pkgName = (pkg && pkg.name) ? String(pkg.name).toLowerCase() : (obj && obj.packageName ? String(obj.packageName).toLowerCase() : '');
      if (pkgName && pkgName.includes('moderate')) return false;

      // 1) packageSpecs on vehicle/customer (new format)
      if (obj && obj.packageSpecs && typeof obj.packageSpecs.interiorPerMonth === 'number') {
        return obj.packageSpecs.interiorPerMonth > 0;
      }
      // 2) explicit fields on vehicle/customer
      const val = (obj && (typeof obj.interiorCleaning !== 'undefined' ? obj.interiorCleaning : obj.interiorCount));
      const parsed = parseInteriorCleaningValue(val);
      if (typeof parsed === 'number') return parsed > 0;
      if (obj && obj.interiorCleaning === true) return true;
      // 3) fallback to package-level interpretation (package doc)
      if (pkg) return hasInteriorFromPackage(pkg);
      // 4) packageName heuristics (legacy compatibility)
      const pn = (obj && obj.packageName) ? String(obj.packageName).toLowerCase() : '';
      if (!pn) return false;
      return pn.includes('classic') || pn.includes('premium') || pn.includes('basic');
    };

    // Helper: generate dates in the target month matching washingDays (washingDays: [1..7] Monday=1)
    const generateDatesForMonth = (washingDays = []) => {
      const dates = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay(); // 0 (Sun) - 6 (Sat)
        const scheduleDay = jsDay === 0 ? 7 : jsDay; // convert to 1..7 (Mon..Sun expects 1..7 mapping with Sunday=7)
        if (washingDays.includes(scheduleDay)) {
          dates.push(new Date(d));
        }
      }
      return dates;
    };

    const results = [];

    // Handle vehicle-level schedules
    const vehicles = Array.isArray(customer.vehicles) && customer.vehicles.length > 0 ? customer.vehicles : [];

    for (const vehicle of vehicles) {
      const washingDays = (vehicle.washingSchedule && vehicle.washingSchedule.washingDays && vehicle.washingSchedule.washingDays.length > 0) ? vehicle.washingSchedule.washingDays : (customer.washingSchedule?.washingDays || []);

      // Re-evaluate interior availability using vehicle-level fields, packageSpecs and package fallback
      const pkg = vehicle.packageId || customer.packageId || null;
      const vehicleHasInterior = entityHasInterior(vehicle, pkg);

      // Compute scheduled dates either for the selected calendar month or for the package window
      let scheduledDates;
      if (viewPackageWindow) {
        const vehicleStart = vehicle.packageStartDate ? new Date(vehicle.packageStartDate) : (vehicle.subscriptionStart ? new Date(vehicle.subscriptionStart) : (customer.packageStartDate ? new Date(customer.packageStartDate) : null));
        const vehicleEnd = vehicle.packageEndDate ? new Date(vehicle.packageEndDate) : (vehicle.subscriptionEnd ? new Date(vehicle.subscriptionEnd) : (customer.packageEndDate ? new Date(customer.packageEndDate) : null));
        if (!vehicleStart || !vehicleEnd) {
          scheduledDates = [];
        } else {
          scheduledDates = [];
          for (let d = new Date(vehicleStart); d <= vehicleEnd; d.setDate(d.getDate() + 1)) scheduledDates.push(new Date(d));
        }
      } else {
        scheduledDates = generateDatesForRange(washingDays || [], startDate, endDate);
      }

      // Determine package total for this vehicle so we don't allow more completions than package allows
      const vehicleCounts = await calculateWashCounts(customer, vehicle._id);
      const packageTotal = (vehicleCounts && typeof vehicleCounts.total === 'number') ? vehicleCounts.total : scheduledDates.length;

      // Respect package start/end dates and build an in-range list first
      const inRangeDates = scheduledDates.filter(d => {
        const vehicleStart = vehicle.packageStartDate ? new Date(vehicle.packageStartDate) : (vehicle.subscriptionStart ? new Date(vehicle.subscriptionStart) : (customer.packageStartDate ? new Date(customer.packageStartDate) : null));
        const vehicleEnd = vehicle.packageEndDate ? new Date(vehicle.packageEndDate) : (vehicle.subscriptionEnd ? new Date(vehicle.subscriptionEnd) : (customer.packageEndDate ? new Date(customer.packageEndDate) : null));
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        if (vehicleStart && dayEnd < new Date(vehicleStart.getFullYear(), vehicleStart.getMonth(), vehicleStart.getDate(), 0, 0, 0)) return false;
        if (vehicleEnd && dayStart > new Date(vehicleEnd.getFullYear(), vehicleEnd.getMonth(), vehicleEnd.getDate(), 23, 59, 59)) return false;
        return true;
      });

      // Fetch completed washes for this vehicle within the in-range window once
      let completedDocs = [];
      if (inRangeDates.length > 0) {
        const first = new Date(inRangeDates[0].getFullYear(), inRangeDates[0].getMonth(), inRangeDates[0].getDate(), 0, 0, 0);
        const last = new Date(inRangeDates[inRangeDates.length - 1].getFullYear(), inRangeDates[inRangeDates.length - 1].getMonth(), inRangeDates[inRangeDates.length - 1].getDate(), 23, 59, 59);
        completedDocs = await WashLog.find({ customerId: id, vehicleId: vehicle._id, status: 'completed', washDate: { $gte: first, $lte: last } }).lean();
      }

      // Map completed dates for quick lookup
      const completedByDate = {};
      for (const cd of completedDocs) {
        const key = new Date(cd.washDate).toISOString().slice(0,10);
        if (!completedByDate[key]) completedByDate[key] = [];
        completedByDate[key].push(cd);
      }

      // Build packageDays list (each day in window with completion info)
      const days = inRangeDates.map(d => {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        const key = d.toISOString().slice(0,10);
        const completedDocsForDay = completedByDate[key] || [];
        const completed = completedDocsForDay.length > 0;
        const washType = completed ? (completedDocsForDay[0].washType || (vehicleHasInterior ? 'both' : 'exterior')) : (vehicleHasInterior ? 'both' : 'exterior');
        return {
          scheduledDate: new Date(d),
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          missed: d < new Date(),
          completed,
          washType,
          completedCountForDay: completedDocsForDay.length
        };
      });

      const completedCount = Object.values(completedByDate).reduce((acc, arr) => acc + arr.length, 0);
      const remaining = Math.max(0, packageTotal - completedCount);

      results.push({
        vehicleId: vehicle._id,
        vehicleNo: vehicle.vehicleNo,
        packageDays: days,
        packageTotal: packageTotal,
        completedCount: completedCount,
        remaining: remaining,
        totalScheduled: inRangeDates.length,
        hasInterior: vehicleHasInterior,
        packageId: vehicle.packageId ? (vehicle.packageId._id || vehicle.packageId) : (customer.packageId ? (customer.packageId._id || customer.packageId) : null),
        packageName: vehicle.packageId ? (vehicle.packageId.name || vehicle.packageName) : (customer.packageId ? (customer.packageId.name || customer.packageName) : (vehicle.packageName || customer.packageName || null)),
        packageInterior: (vehicle.packageId && vehicle.packageId.interiorCleaning) || (customer.packageId && customer.packageId.interiorCleaning) || null
      });
    }

    // Legacy: if customer has no vehicles, handle single vehicle fields
    if (vehicles.length === 0) {
      const washingDays = (customer.washingSchedule && customer.washingSchedule.washingDays && customer.washingSchedule.washingDays.length > 0) ? customer.washingSchedule.washingDays : [];
      // Compute scheduled dates either for the selected month or for the package window
      let scheduledDates;
      if (viewPackageWindow) {
        const custStart = customer.packageStartDate ? new Date(customer.packageStartDate) : null;
        const custEnd = customer.packageEndDate ? new Date(customer.packageEndDate) : null;
        if (!custStart || !custEnd) scheduledDates = [];
        else {
          scheduledDates = [];
          for (let d = new Date(custStart); d <= custEnd; d.setDate(d.getDate() + 1)) scheduledDates.push(new Date(d));
        }
      } else {
        scheduledDates = generateDatesForRange(washingDays || [], startDate, endDate);
      }

      // Determine customer-level package total so we don't allow more completions than package allows
      const counts = await calculateWashCounts(customer);
      const packageTotal = (counts && typeof counts.total === 'number') ? counts.total : scheduledDates.length;

      // Respect customer-level package start/end dates and filter in-range
      const inRangeDates = scheduledDates.filter(d => {
        const custStart = customer.packageStartDate ? new Date(customer.packageStartDate) : null;
        const custEnd = customer.packageEndDate ? new Date(customer.packageEndDate) : null;
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        if (custStart && dayEnd < new Date(custStart.getFullYear(), custStart.getMonth(), custStart.getDate(), 0, 0, 0)) return false;
        if (custEnd && dayStart > new Date(custEnd.getFullYear(), custEnd.getMonth(), custEnd.getDate(), 23, 59, 59)) return false;
        return true;
      });

      // Fetch completed washes for the customer within in-range window
      let completedDocs = [];
      if (inRangeDates.length > 0) {
        const first = new Date(inRangeDates[0].getFullYear(), inRangeDates[0].getMonth(), inRangeDates[0].getDate(), 0, 0, 0);
        const last = new Date(inRangeDates[inRangeDates.length - 1].getFullYear(), inRangeDates[inRangeDates.length - 1].getMonth(), inRangeDates[inRangeDates.length - 1].getDate(), 23, 59, 59);
        completedDocs = await WashLog.find({ customerId: id, status: 'completed', washDate: { $gte: first, $lte: last } }).lean();
      }

      const completedByDate = {};
      for (const cd of completedDocs) {
        const key = new Date(cd.washDate).toISOString().slice(0,10);
        if (!completedByDate[key]) completedByDate[key] = [];
        completedByDate[key].push(cd);
      }

      const days = inRangeDates.map(d => {
        const key = d.toISOString().slice(0,10);
        const completedDocsForDay = completedByDate[key] || [];
        const completed = completedDocsForDay.length > 0;
        const washType = completed ? (completedDocsForDay[0].washType || (customerHasInterior ? 'both' : 'exterior')) : (customerHasInterior ? 'both' : 'exterior');
        return { scheduledDate: new Date(d), day: d.toLocaleDateString('en-US', { weekday: 'short' }), missed: d < new Date(), completed, washType, completedCountForDay: completedDocsForDay.length };
      });

      const completedCount = Object.values(completedByDate).reduce((acc, arr) => acc + arr.length, 0);
      const remaining = Math.max(0, packageTotal - completedCount);

      results.push({ vehicleId: null, vehicleNo: customer.vehicleNo || null, packageDays: days, packageTotal, completedCount, remaining, totalScheduled: inRangeDates.length, hasInterior: customerHasInterior, packageId: customer.packageId ? (customer.packageId._id || customer.packageId) : null, packageName: customer.packageId ? (customer.packageId.name || customer.packageName) : (customer.packageName || null), packageInterior: (customer.packageId && customer.packageId.interiorCleaning) || null });
    }

    const responseMonth = viewPackageWindow ? 'package' : (startDate ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` : null);
    res.status(200).json({ vehicles: results, month: responseMonth });
  } catch (error) {
    console.error('Error fetching pending washes for customer:', error);
    res.status(500).json({ message: 'Error fetching pending washes', error: error.message });
  }
};

// ✅ Complete a scheduled/pending wash by admin (no SMS)
exports.completePendingWashByAdmin = async (req, res) => {
  try {
    // Support both /:customerId and /:id route param names
    const id = req.params.customerId || req.params.id;
    const { vehicleId, scheduledDate } = req.body; // scheduledDate expected as ISO string

    console.debug('completePendingWashByAdmin - customerId:', id, 'vehicleId:', vehicleId, 'scheduledDate:', scheduledDate);

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid customer ID' });
    if (vehicleId && !mongoose.Types.ObjectId.isValid(vehicleId)) return res.status(400).json({ message: 'Invalid vehicle ID' });
    if (!scheduledDate) return res.status(400).json({ message: 'scheduledDate is required' });

    // Populate package and washer refs so we can attribute the completed wash to the assigned washer when available
    const customer = await Customer.findById(id)
      .populate('packageId')
      .populate('washerId')
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Determine washType (honor explicit request from UI when provided)
    const { washType: requestedWashType } = req.body; // 'both' or 'exterior'
    let pkg = null;
    if (vehicleId) {
      const vehicle = customer.vehicles.find(v => String(v._id) === String(vehicleId));
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found on customer' });
      pkg = vehicle.packageId || customer.packageId || null;
    } else {
      pkg = customer.packageId || null;
    }

    const { hasInteriorFromPackage } = require('../utils/packageHelpers');
    const hasInterior = hasInteriorFromPackage(pkg);

    // Precedence: explicit requestedWashType ('both'|'exterior') > package-derived default
    let washType = 'exterior';
    if (requestedWashType === 'both') washType = 'both';
    else if (requestedWashType === 'exterior') washType = 'exterior';
    else washType = hasInterior ? 'both' : 'exterior';

    // Determine assigned washer (use vehicle assignment if available, otherwise customer-level washer)
    let assignedWasherId = null;
    let assignedWasherName = 'Unknown';
    if (vehicleId) {
      const vehicle = customer.vehicles.find(v => String(v._id) === String(vehicleId));
      if (vehicle) {
        assignedWasherId = vehicle.washerId ? (vehicle.washerId._id || vehicle.washerId) : null;
      }
    } else {
      assignedWasherId = customer.washerId ? (customer.washerId._id || customer.washerId) : null;
    }
    if (assignedWasherId) {
      try {
        const washerDoc = await Washer.findById(assignedWasherId).lean();
        if (washerDoc && washerDoc.name) assignedWasherName = washerDoc.name;
      } catch (e) {
        console.error('Error fetching washer for assignedWasherId:', assignedWasherId, e);
      }
    }

    // Validate scheduledDate within package window and ensure package count not exceeded
    const schedDate = new Date(scheduledDate);
    let pkgStart = null, pkgEnd = null, packageName = null;
    if (vehicleId) {
      const vehicle = customer.vehicles.find(v => String(v._id) === String(vehicleId));
      pkgStart = vehicle.packageStartDate ? new Date(vehicle.packageStartDate) : (vehicle.subscriptionStart ? new Date(vehicle.subscriptionStart) : (customer.packageStartDate ? new Date(customer.packageStartDate) : null));
      pkgEnd = vehicle.packageEndDate ? new Date(vehicle.packageEndDate) : (vehicle.subscriptionEnd ? new Date(vehicle.subscriptionEnd) : (customer.packageEndDate ? new Date(customer.packageEndDate) : null));
      packageName = vehicle.packageId ? (vehicle.packageId.name || vehicle.packageName) : (vehicle.packageName || (customer.packageId ? customer.packageId.name : null));
    } else {
      pkgStart = customer.packageStartDate ? new Date(customer.packageStartDate) : null;
      pkgEnd = customer.packageEndDate ? new Date(customer.packageEndDate) : null;
      packageName = customer.packageId ? (customer.packageId.name || customer.packageName) : customer.packageName;
    }

    if (pkgStart && pkgEnd) {
      const dayStart = new Date(schedDate.getFullYear(), schedDate.getMonth(), schedDate.getDate(), 0, 0, 0);
      const dayEnd = new Date(schedDate.getFullYear(), schedDate.getMonth(), schedDate.getDate(), 23, 59, 59);
      if (dayEnd < new Date(pkgStart.getFullYear(), pkgStart.getMonth(), pkgStart.getDate(), 0, 0, 0) || dayStart > new Date(pkgEnd.getFullYear(), pkgEnd.getMonth(), pkgEnd.getDate(), 23, 59, 59)) {
        return res.status(400).json({ message: 'Scheduled date is outside the package duration' });
      }

      // Determine package total based on package name
      let packageTotal = 8;
      const pkgNameLower = packageName ? String(packageName).toLowerCase() : '';
      if (pkgNameLower === 'basic') packageTotal = 8;
      else if (pkgNameLower.includes('moderate') || pkgNameLower.includes('classic') || pkgNameLower.includes('hatch')) packageTotal = 12;

      const completedCount = await WashLog.countDocuments({
        customerId: id,
        vehicleId: vehicleId || null,
        status: 'completed',
        washDate: { $gte: new Date(pkgStart.getFullYear(), pkgStart.getMonth(), pkgStart.getDate(), 0,0,0), $lte: new Date(pkgEnd.getFullYear(), pkgEnd.getMonth(), pkgEnd.getDate(), 23,59,59) }
      });

      if (completedCount >= packageTotal) {
        return res.status(400).json({ message: 'Your wash count completed for this package' });
      }

      // Also check if this scheduled date already has a completed wash
      const alreadyDone = await WashLog.exists({ customerId: id, vehicleId: vehicleId || null, status: 'completed', washDate: { $gte: dayStart, $lte: dayEnd } });
      if (alreadyDone) {
        return res.status(400).json({ message: 'Scheduled date is already completed' });
      }
    }

    // Create WashLog entry (admin completed - attribute to assigned washer when possible)
    const washLog = new WashLog({
      customerId: id,
      vehicleId: vehicleId || null,
      washerId: assignedWasherId || null,
      washerName: assignedWasherName,
      packageId: pkg ? pkg._id : null,
      washType,
      washDate: new Date(scheduledDate),
      status: 'completed',
      completedAt: new Date(),
      notes: 'Completed by admin'
    });

    await washLog.save();

    // Update customer/vehicle last wash date (similar to cancel logic but for completed)
    if (vehicleId) {
      const vIndex = customer.vehicles.findIndex(v => String(v._id) === String(vehicleId));
      if (vIndex !== -1) {
        customer.vehicles[vIndex].washingSchedule = customer.vehicles[vIndex].washingSchedule || {};
        customer.vehicles[vIndex].washingSchedule.lastWashDate = washLog.completedAt;
      }
    } else {
      customer.washingSchedule = customer.washingSchedule || {};
      customer.washingSchedule.lastWashDate = washLog.completedAt;
    }
    await customer.save();

    // Recompute counts
    const updatedWashCounts = await calculateWashCounts(customer);
    let vehicleCompleted = 0;
    if (vehicleId) {
      vehicleCompleted = await WashLog.countDocuments({ customerId: id, vehicleId: vehicleId, status: 'completed' });
    }

    res.status(200).json({
      message: 'Scheduled wash marked completed by admin',
      washLog,
      updatedCounts: {
        pending: updatedWashCounts.pending,
        completed: updatedWashCounts.completed,
        total: updatedWashCounts.total,
        vehicleCompleted
      }
    });

  } catch (error) {
    console.error('Error completing pending wash by admin:', error);
    res.status(500).json({ message: 'Error completing pending wash', error: error.message });
  }
};

// ✅ Complete a wash for a customer (supports both single and multi-vehicle)
exports.completeWash = async (req, res) => {
  try {
    const { customerId, washerId, washerName, vehicleId, washType } = req.body;

    console.log('🔍 Complete wash request:', { customerId, washerId, washerName, vehicleId, washType });

    // Validate required fields
    if (!customerId || !washerId) {
      return res.status(400).json({ message: "Customer ID and Washer ID are required" });
    }

    // For multi-vehicle customers, the customerId might be in format "customerId-vehicleId"
    let actualCustomerId = customerId;
    let actualVehicleId = vehicleId;
    
    // Check if customerId contains vehicle ID (format: "customerId-vehicleId")
    if (customerId.includes('-') && !vehicleId) {
      const parts = customerId.split('-');
      if (parts.length === 2) {
        actualCustomerId = parts[0];
        actualVehicleId = parts[1];
        console.log('🔍 Detected multi-vehicle format:', { actualCustomerId, actualVehicleId });
      }
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(actualCustomerId) || !mongoose.Types.ObjectId.isValid(washerId)) {
      return res.status(400).json({ message: "Invalid Customer ID or Washer ID" });
    }

    if (actualVehicleId && !mongoose.Types.ObjectId.isValid(actualVehicleId)) {
      return res.status(400).json({ message: "Invalid Vehicle ID" });
    }

    // Check if customer exists
    const customer = await Customer.findById(actualCustomerId).populate('packageId').populate('vehicles.packageId');
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    console.log('🔍 Customer found:', { name: customer.name, vehiclesCount: customer.vehicles?.length || 0 });

    let targetVehicle = null;
    let packageInfo = null;
    
    // Handle multi-vehicle customers
    if (actualVehicleId) {
      console.log('🔍 Multi-vehicle customer - looking for vehicle:', actualVehicleId);
      targetVehicle = customer.vehicles?.find(v => v._id.toString() === actualVehicleId);
      if (!targetVehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Check if this vehicle is assigned to this washer
      const vehicleWasherId = targetVehicle.washerId?.toString();
      if (!vehicleWasherId || vehicleWasherId !== washerId) {
        console.log('🔍 Vehicle washer mismatch:', { vehicleWasherId, washerId });
        return res.status(403).json({ message: "Vehicle is not assigned to this washer" });
      }
      
      packageInfo = targetVehicle.packageId || targetVehicle.packageName;
      console.log('🔍 Multi-vehicle wash completion for:', targetVehicle.vehicleNo);
    } else {
      // Handle single-vehicle customers (backward compatibility)
      console.log('🔍 Single-vehicle customer');
      if (customer.washerId && customer.washerId.toString() !== washerId) {
        console.log('🔍 Customer washer mismatch:', { customerWasherId: customer.washerId?.toString(), washerId });
        return res.status(403).json({ message: "Customer is not assigned to this washer" });
      }
      packageInfo = customer.packageId;
    }

    // Calculate current wash counts (for specific vehicle if multi-vehicle)
    const washCounts = targetVehicle 
      ? await calculateWashCounts(customer, actualVehicleId)
      : await calculateWashCounts(customer);
    
    // Check if has pending washes
    if (washCounts.pending <= 0) {
      return res.status(400).json({ message: "No pending washes for this month" });
    }

    const packageName = packageInfo?.name || packageInfo;
    // if (packageName) {
    //   const pkgName = packageName.toLowerCase();
    //   if (pkgName.includes("classic") || pkgName.includes("premium")) {
    //     washType = "both";
    //   } else if (pkgName.includes("moderate")) {
    //     washType = "exterior";
    //   }
    // }

    // If frontend passed scheduledDate (marking for a filtered date), parse it and determine if this is early
    let scheduledDate = null;
    let early = false;
    if (req.body && req.body.scheduledDate) {
      try {
        scheduledDate = new Date(req.body.scheduledDate);
        // if scheduledDate is in the future compared to today, this is an early completion
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const scheduledStart = new Date(scheduledDate); scheduledStart.setHours(0,0,0,0);
        if (scheduledStart.getTime() > todayStart.getTime()) early = true;
      } catch (err) {
        scheduledDate = null;
        early = false;
      }
    }

    // Create wash log entry with all required fields
    const washLog = new WashLog({
      customerId: actualCustomerId,
      vehicleId: actualVehicleId || null, // Include vehicle ID for multi-vehicle customers
      washerId: washerId,
      packageId: packageInfo?._id || packageInfo?.packageId,
      washDate: new Date(),
      completedAt: new Date(),
      scheduledDate: scheduledDate || null,
      early: early,
      washType: washType,
      apartment: customer.apartment || 'Not specified',
      doorNo: customer.doorNo || 'Not specified',
      vehicleNo: targetVehicle?.vehicleNo || customer.vehicleNo,
      carModel: targetVehicle?.carModel || customer.carModel,
      status: 'completed',
      washerNotes: `Completed by ${washerName || 'Washer'}`,
      servicesCompleted: {
        exteriorWash: true,
        interiorWash: washType === "both",
        wheelCleaning: true,
        dashboardCleaning: washType === "both"
      }
    });

    await washLog.save();

    // Update last wash information
    const lastWashInfo = {
      date: new Date(),
      washerName: washerName,
      washerId: washerId,
      washType: washType
    };

    if (targetVehicle) {
      // Update specific vehicle's last wash info
      targetVehicle.lastWash = lastWashInfo;
      if (!targetVehicle.washingSchedule) targetVehicle.washingSchedule = {};
      targetVehicle.washingSchedule.lastWashDate = new Date();
    } else {
      // Update customer's last wash info (single vehicle)
      customer.lastWash = lastWashInfo;
      if (!customer.washingSchedule) customer.washingSchedule = {};
      customer.washingSchedule.lastWashDate = new Date();
    }
    await customer.save();

    // Calculate updated wash counts
    const updatedWashCounts = targetVehicle 
      ? await calculateWashCounts(customer, actualVehicleId)
      : await calculateWashCounts(customer);

    if(washType === 'exterior'){
      await EXTService(`91${customer.mobileNo}`);
    }
    else{
      await IntExtService(`91${customer.mobileNo}`);
    }

    res.status(200).json({
      message: "Wash completed successfully",
      washId: washLog._id,
      pendingWashes: updatedWashCounts.pending,
      completedWashes: updatedWashCounts.completed,
      totalMonthlyWashes: updatedWashCounts.total,
      lastWash: {
        date: targetVehicle ? targetVehicle.lastWash.date : customer.lastWash.date,
        washerName: washerName,
        washType: washType
      }
    });

  } catch (error) {
    console.error('Error completing wash:', error);
    res.status(500).json({ message: "Error completing wash", error: error.message });
  }
};

// ✅ Export customer data template for bulk operations
exports.exportCustomerTemplate = async (req, res) => {
  try {
    // Get all packages for reference
    const packages = await Package.find();

    // Create template data structure - horizontal multi-vehicle format (exact match to image)
    const templateData = [
      {
        // Customer Info
        name: 'John Doe',
        mobileNo: '1234567890',
        email: 'john@example.com',
        apartment: 'ABC Apartments',
        doorNo: '101',
        // Vehicle 1
        vehicleNo1: 'TN01AB1234',
        carModel1: 'Honda City',
        carType1: 'sedan',
        packageName1: 'Basic',
        scheduleType1: 'schedule1',
        // Vehicle 2
        vehicleNo2: 'TN01AB5678',
        carModel2: 'Honda CRV',
        carType2: 'suv',
        packageName2: 'Moderate',
        scheduleType2: 'schedule1',
        // Vehicle 3 (empty)
        vehicleNo3: '',
        carModel3: '',
        carType3: '',
        packageName3: '',
        scheduleType3: ''
      },
      {
        // Customer Info
        name: 'Jane Smith',
        mobileNo: '9876543210',
        email: 'jane@example.com',
        apartment: 'XYZ Complex',
        doorNo: '202',
        // Vehicle 1
        vehicleNo1: 'KA02CD9999',
        carModel1: 'Maruti Swift',
        carType1: 'sedan',
        packageName1: 'Classic',
        scheduleType1: 'schedule2',
        // Vehicle 2 & 3 (empty)
        vehicleNo2: '',
        carModel2: '',
        carType2: '',
        packageName2: '',
        scheduleType2: '',
        vehicleNo3: '',
        carModel3: '',
        carType3: '',
        packageName3: '',
        scheduleType3: ''
      }
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Auto-size columns to make headers fully visible (horizontal format)
    const columnWidths = [
      { wch: 15 }, // name
      { wch: 12 }, // mobileNo
      { wch: 25 }, // email
      { wch: 20 }, // apartment
      { wch: 10 }, // doorNo
      // Vehicle 1
      { wch: 15 }, // vehicleNo1
      { wch: 15 }, // carModel1
      { wch: 12 }, // carType1
      { wch: 15 }, // packageName1
      { wch: 15 }, // scheduleType1
      // Vehicle 2
      { wch: 15 }, // vehicleNo2
      { wch: 15 }, // carModel2
      { wch: 12 }, // carType2
      { wch: 15 }, // packageName2
      { wch: 15 }, // scheduleType2
      // Vehicle 3
      { wch: 15 }, // vehicleNo3
      { wch: 15 }, // carModel3
      { wch: 12 }, // carType3
      { wch: 15 }, // packageName3
      { wch: 15 }  // scheduleType3
    ];
    worksheet['!cols'] = columnWidths;

    // Add Excel Data Validation for dropdowns
    if (!worksheet['!dataValidation']) {
      worksheet['!dataValidation'] = {};
    }

    // Add dropdowns for all 3 vehicles in horizontal format
    for (let i = 2; i <= 1000; i++) {
      // Vehicle 1 dropdowns (columns H=7, I=8, J=9)
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 7 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"sedan,suv,premium,hatch"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 8 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"Basic,Moderate,Classic,Hatch Pack"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 9 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"schedule1,schedule2"'
      };

      // Vehicle 2 dropdowns (columns M=12, N=13, O=14)
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 12 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"sedan,suv,premium,hatch"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 13 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"Basic,Moderate,Classic,Hatch Pack"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 14 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"schedule1,schedule2"'
      };

      // Vehicle 3 dropdowns (columns R=17, S=18, T=19)
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 17 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"sedan,suv,premium,hatch"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 18 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"Basic,Moderate,Classic,Hatch Pack"'
      };
      worksheet['!dataValidation'][XLSX.utils.encode_cell({ r: i - 1, c: 19 })] = {
        type: 'list', allowBlank: true, showDropDown: true, formula1: '"schedule1,schedule2"'
      };
    }

    // Create dropdown options sheets
    const carTypeOptions = [
      { "Car Types": "sedan" },
      { "Car Types": "suv" },
      { "Car Types": "premium" },
      { "Car Types": "hatch" }
    ];
    const carTypeSheet = XLSX.utils.json_to_sheet(carTypeOptions);

    const packageOptions = [
      { "Package Names": "Basic" },
      { "Package Names": "Moderate" },
      { "Package Names": "Classic" },
      { "Package Names": "Hatch Pack" }
    ];
    const packageDropdownSheet = XLSX.utils.json_to_sheet(packageOptions);

    const scheduleOptions = [
      { "Schedule Types": "schedule1" },
      { "Schedule Types": "schedule2" }
    ];
    const scheduleDropdownSheet = XLSX.utils.json_to_sheet(scheduleOptions);

    // Package reference sheet (detailed information)
    const packageReferenceSheet = XLSX.utils.json_to_sheet(
      packages.map(pkg => ({
        packageName: pkg.name,
        carType: pkg.carType,
        pricePerMonth: pkg.pricePerMonth,
        description: pkg.description || 'N/A'
      }))
    );

    // Auto-size package reference sheet columns
    packageReferenceSheet['!cols'] = [
      { wch: 15 }, // packageName
      { wch: 12 }, // carType
      { wch: 15 }, // pricePerMonth
      { wch: 30 }  // description
    ];

    const instructionSheet = XLSX.utils.json_to_sheet([
      {
        Field: 'TEMPLATE USAGE:',
        Required: '',
        Description: 'Use dropdown arrows in carType, packageName, and scheduleType columns',
        Example: ''
      },
      {
        Field: '',
        Required: '',
        Description: '',
        Example: ''
      },
      {
        Field: 'name',
        Required: 'Yes',
        Description: 'Customer full name',
        Example: 'John Doe'
      },
      {
        Field: 'mobileNo',
        Required: 'Yes', 
        Description: '10-digit mobile number',
        Example: '1234567890'
      },
      {
        Field: 'email',
        Required: 'No',
        Description: 'Valid email address',
        Example: 'john@example.com'
      },
      {
        Field: 'apartment',
        Required: 'Yes',
        Description: 'Apartment/building name',
        Example: 'ABC Apartments'
      },
      {
        Field: 'doorNo',
        Required: 'Yes',
        Description: 'Door/flat number',
        Example: '101'
      },
      {
        Field: 'carModel',
        Required: 'Yes',
        Description: 'Car model name',
        Example: 'Honda City'
      },
      {
        Field: 'carType',
        Required: 'Yes',
        Description: 'DROPDOWN: Click cell to see dropdown with sedan, suv, premium, hatch',
        Example: 'sedan'
      },
      {
        Field: 'vehicleNo',
        Required: 'Yes',
        Description: 'Unique vehicle registration number',
        Example: 'TN01AB1234'
      },
      {
        Field: 'packageName',
        Required: 'Yes',
        Description: 'DROPDOWN: Click cell to see dropdown with Basic, Moderate, Classic, Hatch Pack',
        Example: 'Basic'
      },
      {
        Field: 'scheduleType',
        Required: 'Yes',
        Description: 'DROPDOWN: Click cell to see dropdown with schedule1, schedule2',
        Example: 'schedule1'
      },
      {
        Field: '',
        Required: '',
        Description: '',
        Example: ''
      },
      {
        Field: 'SCHEDULE GUIDE:',
        Required: '',
        Description: 'Choose the right schedule for your package',
        Example: ''
      },
      {
        Field: 'Basic Package',
        Required: '',
        Description: 'schedule1: Monday & Thursday | schedule2: Tuesday & Saturday',
        Example: '2 times per week'
      },
      {
        Field: 'Moderate Package',
        Required: '',
        Description: 'schedule1: Mon, Wed, Fri | schedule2: Tue, Thu, Sat',
        Example: '3 times per week'
      },
      {
        Field: 'Classic Package',
        Required: '',
        Description: 'schedule1: Mon, Wed, Fri | schedule2: Tue, Thu, Sat',
        Example: '3 times per week'
      }
    ]);

    // Auto-size instruction sheet columns
    instructionSheet['!cols'] = [
      { wch: 20 }, // Field
      { wch: 10 }, // Required
      { wch: 50 }, // Description
      { wch: 20 }  // Example
    ];

    // Add worksheets to workbook (removed Washers sheet)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Template');
    XLSX.utils.book_append_sheet(workbook, carTypeSheet, 'Car Types');
    XLSX.utils.book_append_sheet(workbook, packageDropdownSheet, 'Package Names');
    XLSX.utils.book_append_sheet(workbook, scheduleDropdownSheet, 'Schedule Types');
    XLSX.utils.book_append_sheet(workbook, packageReferenceSheet, 'Package Details');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions & Guide');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=customer_bulk_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buffer);

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: "Error generating template", error: error.message });
  }
};

// ✅ Bulk import customers from Excel (Horizontal Multi-vehicle Format)
exports.bulkImportCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read the Excel file (horizontal format)
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return res.status(400).json({ message: "No data found in the uploaded file" });
    }

    const results = {
      totalRows: jsonData.length,
      successfulCustomers: 0,
      failedRows: 0,
      totalVehicles: 0,
      errors: []
    };

    // Get all packages for reference
    const packages = await Package.find();

    // Track vehicle numbers in this batch to prevent duplicates
    const usedVehicleNumbers = new Set();

    // Process each row (horizontal format)
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (accounting for header)

      try {
        // Validate required customer fields
        if (!row.name || !row.mobileNo || !row.apartment || !row.doorNo) {
          throw new Error('Missing required customer fields: name, mobileNo, apartment, doorNo');
        }

        // Validate mobile number
        const mobileNo = row.mobileNo.toString().trim();
        if (!/^\d{10}$/.test(mobileNo)) {
          throw new Error('Mobile number must be 10 digits');
        }

        // Validate email if provided
        if (row.email && !/\S+@\S+\.\S+/.test(row.email)) {
          throw new Error('Invalid email format');
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ mobileNo: mobileNo });
        if (existingCustomer) {
          throw new Error(`Customer with mobile number ${mobileNo} already exists`);
        }

        console.log(`Processing customer: ${row.name} (${mobileNo}) - Row ${rowNumber}`);

        // Process vehicles from horizontal format (vehicleNo1, vehicleNo2, vehicleNo3)
        const processedVehicles = [];
        
        // Check each vehicle column (1, 2, 3)
        for (let vehicleNum = 1; vehicleNum <= 3; vehicleNum++) {
          const vehicleNoField = `vehicleNo${vehicleNum}`;
          const carModelField = `carModel${vehicleNum}`;
          const carTypeField = `carType${vehicleNum}`;
          const packageNameField = `packageName${vehicleNum}`;
          const scheduleTypeField = `scheduleType${vehicleNum}`;
          
          const vehicleNo = row[vehicleNoField]?.toString().trim();
          
          // Skip if no vehicle number (vehicle columns can be empty)
          if (!vehicleNo) {
            console.log(`  Vehicle ${vehicleNum}: Skipped (no vehicle number)`);
            continue;
          }
          
          const normalizedVehicleNo = vehicleNo.toUpperCase().trim();
          console.log(`  Processing Vehicle ${vehicleNum}: ${vehicleNo} -> ${normalizedVehicleNo}`);
          
          // Check for duplicates within this batch
          if (usedVehicleNumbers.has(normalizedVehicleNo)) {
            throw new Error(`Vehicle ${vehicleNum}: Vehicle number ${vehicleNo} appears multiple times in this import batch`);
          }
          usedVehicleNumbers.add(normalizedVehicleNo);
          
          const carModel = row[carModelField]?.toString().trim();
          const carType = row[carTypeField]?.toString().trim().toLowerCase();
          const packageName = row[packageNameField]?.toString().trim();
          const scheduleType = row[scheduleTypeField]?.toString().trim();
          
          // Validate required vehicle fields
          if (!carModel || !packageName || !scheduleType) {
            throw new Error(`Vehicle ${vehicleNum}: Missing required fields (carModel, packageName, scheduleType)`);
          }

          // Find package
          const selectedPackage = packages.find(pkg => 
            pkg.name.toLowerCase() === packageName.toLowerCase()
          );
          if (!selectedPackage) {
            throw new Error(`Vehicle ${vehicleNum}: Package '${packageName}' not found`);
          }

          // Validate carType (include hatch)
          if (!['sedan', 'suv', 'premium', 'hatch'].includes(carType)) {
            throw new Error(`Vehicle ${vehicleNum}: carType must be sedan, suv, premium, or hatch`);
          }

          // Validate scheduleType
          if (!['schedule1', 'schedule2'].includes(scheduleType)) {
            throw new Error(`Vehicle ${vehicleNum}: scheduleType must be schedule1 or schedule2`);
          }

          // Check if vehicle number already exists in database (case-insensitive and trimmed)
          console.log(`    Checking database for existing vehicle: ${normalizedVehicleNo}`);
          const existingVehicle = await Customer.findOne({ 
            $or: [
              { vehicleNo: { $regex: new RegExp(`^${normalizedVehicleNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
              { "vehicles.vehicleNo": { $regex: new RegExp(`^${normalizedVehicleNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
            ]
          });
          if (existingVehicle) {
            console.log(`    ❌ Vehicle number conflict found: ${vehicleNo} matches existing vehicle in customer: ${existingVehicle.name}`);
            throw new Error(`Vehicle ${vehicleNum}: Vehicle number ${vehicleNo} already exists in database`);
          } else {
            console.log(`    ✅ Vehicle number ${normalizedVehicleNo} is available`);
          }

          // Calculate subscription dates
         

          // Determine washing schedule
          let washingDays = [];
          let washFrequencyPerMonth = 8;
          
          if (packageName === 'Basic') {
            washingDays = scheduleType === 'schedule1' ? [1, 4] : [2, 6];
            washFrequencyPerMonth = 8;
          } else if (packageName === 'Moderate' || packageName === 'Classic' || packageName === 'Hatch Pack') {
            washingDays = scheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
            washFrequencyPerMonth = 12;
          }

          // Create vehicle data - without automatically starting the package
          const vehicleData = {
            carModel: carModel,
            vehicleNo: normalizedVehicleNo,
            carType: carType,
            packageId: selectedPackage._id,
            packageName: selectedPackage.name,
            washerId: null,
            washingSchedule: {
              scheduleType: scheduleType,
              washingDays: washingDays,
              washFrequencyPerMonth: washFrequencyPerMonth
            },
            hasStarted: false,  // Package needs to be started manually
            status: 'active'
          };

          processedVehicles.push(vehicleData);
        }

        // Ensure at least one vehicle exists
        if (processedVehicles.length === 0) {
          throw new Error('At least one vehicle is required (vehicleNo1 must be filled)');
        }

        // Create customer with vehicles
        const newCustomerData = {
          name: row.name.trim(),
          mobileNo: mobileNo,
          email: row.email?.trim() || '',
          apartment: row.apartment.trim(),
          doorNo: row.doorNo.toString().trim(),
          vehicles: processedVehicles,
          status: 'active'
        };

        // Save customer
        const newCustomer = new Customer(newCustomerData);
        const saved = await newCustomer.save();
        // Push packageHistory entries for each vehicle
        let modified = false;
        for (const v of saved.vehicles) {
          if (!v.packageHistory) v.packageHistory = [];
          v.packageHistory.push({
            packageId: v.packageId,
            packageName: v.packageName,
       
            autoRenewed: false
          });
          modified = true;
        }
        if (modified) await saved.save();

        results.successfulCustomers++;
        results.totalVehicles += processedVehicles.length;

      } catch (error) {
        results.failedRows++;
        results.errors.push({
          row: rowNumber,
          customerName: row.name || 'Unknown',
          customerMobile: row.mobileNo || 'N/A',
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: "Horizontal multi-vehicle bulk import completed",
      results: results
    });

  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: "Error processing bulk import", error: error.message });
  }
};

// ✅ Add vehicle to existing customer
exports.addVehicleToCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { carModel, vehicleNo, packageId, scheduleType, washerId } = req.body;

    // Validate required fields
    if (!carModel || !vehicleNo || !packageId) {
      return res.status(400).json({ 
        message: "Car model, vehicle number, and package are required" 
      });
    }

    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if vehicle number already exists
    const existingVehicle = await Customer.findOne({ 
      $or: [
        { vehicleNo: vehicleNo.trim() },
        { "vehicles.vehicleNo": vehicleNo.trim() }
      ]
    });
    
    if (existingVehicle) {
      return res.status(400).json({ 
        message: `Vehicle number ${vehicleNo} already exists` 
      });
    }

    // Get package details
    const Package = require('../models/Package');
    const selectedPackage = await Package.findById(packageId);
    
    if (!selectedPackage) {
      return res.status(400).json({ 
        message: "Selected package not found" 
      });
    }

    // Create vehicle object with hasStarted set to false by default
    // Package dates will be set when the package is started via the start-package endpoint
    const vehicleData = {
      carModel: carModel.trim(),
      vehicleNo: vehicleNo.trim(),
      packageId: selectedPackage._id,
      packageName: selectedPackage.name,
      carType: selectedPackage.carType,
      hasStarted: false,  // Explicitly set to false
      washingSchedule: {
        scheduleType: scheduleType || 'schedule1'
      }
    };
 

    let washingDays = [];
    let washFrequencyPerMonth = 8;
    
    const selectedScheduleType = scheduleType || 'schedule1';
    
    if (selectedPackage.name === 'Basic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
      washFrequencyPerMonth = 8;
    } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic' || selectedPackage.name === 'Hatch Pack') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
      washFrequencyPerMonth = 12;
    }

    const newVehicle = {
      carModel: carModel.trim(),
      vehicleNo: vehicleNo.trim().toUpperCase(),
      carType: selectedPackage.carType || 'sedan',
      packageId: packageId,
      packageName: selectedPackage.name,
      washerId: washerId || null,
      washingSchedule: {
        scheduleType: selectedScheduleType,
        washingDays: washingDays,
        washFrequencyPerMonth: washFrequencyPerMonth
      },
      hasStarted: false,  // Explicitly set to false - package needs to be started manually
      status: 'active'
    };

    // Add vehicle to customer
    if (!customer.vehicles) {
      customer.vehicles = [];
    }
    customer.vehicles.push(newVehicle);
    
    const updatedCustomer = await customer.save();
    
    // Push package history for the newly added vehicle
    const addedVehicle = updatedCustomer.vehicles[updatedCustomer.vehicles.length - 1];
    if (!addedVehicle.packageHistory) addedVehicle.packageHistory = [];
    addedVehicle.packageHistory.push({
      packageId: addedVehicle.packageId,
      packageName: addedVehicle.packageName,
      startDate: addedVehicle.packageStartDate,
      endDate: addedVehicle.packageEndDate,
      autoRenewed: false
    });
    await updatedCustomer.save();

    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Vehicle added successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error adding vehicle:', error);
    res.status(500).json({ message: "Error adding vehicle", error: error.message });
  }
};

// ✅ Update specific vehicle
exports.updateVehicle = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;
    const updateData = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Find and update the specific vehicle
    const vehicleIndex = customer.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Update vehicle fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        customer.vehicles[vehicleIndex][key] = updateData[key];
      }
    });

    const updatedCustomer = await customer.save();
    
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Vehicle updated successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ message: "Error updating vehicle", error: error.message });
  }
};

// ✅ Delete specific vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Remove the specific vehicle
    customer.vehicles = customer.vehicles.filter(v => v._id.toString() !== vehicleId);
    
    const updatedCustomer = await customer.save();
    
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Vehicle deleted successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: "Error deleting vehicle", error: error.message });
  }
};

// ✅ Allocate washer to specific vehicle
exports.allocateWasherToVehicle = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;
    const { washerId } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Find and update the specific vehicle's washer
    const vehicleIndex = customer.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    customer.vehicles[vehicleIndex].washerId = washerId;
    
    const updatedCustomer = await customer.save();
    
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Washer allocated successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error allocating washer:', error);
    res.status(500).json({ message: "Error allocating washer", error: error.message });
  }
};

// Add vehicle to existing customer
// Removed duplicate addVehicleToCustomer function

// Update vehicle details
exports.updateVehicle = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;
    const { vehicleNo, carModel, carType, packageId, scheduleType } = req.body;

    // Validate required fields
    if (!vehicleNo || !carModel || !packageId) {
      return res.status(400).json({ 
        message: "Vehicle number, car model, and package are required" 
      });
    }

    // Find customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Find vehicle in customer's vehicles array
    const vehicleIndex = customer.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Check if vehicle number already exists (excluding current vehicle)
    const existingVehicle = await Customer.findOne({ 
      $or: [
        { vehicleNo: vehicleNo.trim() },
        { "vehicles.vehicleNo": vehicleNo.trim() }
      ],
      $and: [
        { 
          $or: [
            { _id: { $ne: customerId } },
            { "vehicles._id": { $ne: vehicleId } }
          ]
        }
      ]
    });
    
    if (existingVehicle) {
      return res.status(400).json({ 
        message: `Vehicle number ${vehicleNo} already exists` 
      });
    }

    // Get package details
    const Package = require('../models/Package');
    const selectedPackage = await Package.findById(packageId);
    
    if (!selectedPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    // Determine washing schedule
    let washingDays = [];
    let washFrequencyPerMonth = 8;
    
    const selectedScheduleType = scheduleType || 'schedule1';
    
    if (selectedPackage.name === 'Basic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
      washFrequencyPerMonth = 8;
    } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic' || selectedPackage.name === 'Hatch Pack') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
      washFrequencyPerMonth = 12;
    }

    // Update vehicle details
    const vehicle = customer.vehicles[vehicleIndex];
    vehicle.carModel = carModel.trim();
    vehicle.vehicleNo = vehicleNo.trim().toUpperCase();
    vehicle.carType = carType || vehicle.carType;

    // Handle package renewal logic
    const isPackageChanged = vehicle.packageId?.toString() !== packageId;
    if (isPackageChanged) {
      // Set new package dates: start from previous end date (if exists), else now
      const prevEnd = vehicle.packageEndDate || new Date();
      vehicle.packageStartDate = prevEnd;
      const newEnd = new Date(prevEnd);
      newEnd.setMonth(newEnd.getMonth() + 1);
      vehicle.packageEndDate = newEnd;
      // Push history entry
      if (!vehicle.packageHistory) vehicle.packageHistory = [];
      vehicle.packageHistory.push({
        packageId: packageId,
        packageName: selectedPackage.name,
        startDate: vehicle.packageStartDate,
        endDate: vehicle.packageEndDate,
        autoRenewed: false
      });
    }
    vehicle.packageId = packageId;
    vehicle.packageName = selectedPackage.name;
    vehicle.washingSchedule = {
      scheduleType: selectedScheduleType,
      washingDays: washingDays,
      washFrequencyPerMonth: washFrequencyPerMonth
    };

    // Optional: accept manual package start/end dates (admin edits)
    if (typeof req.body.packageStartDate !== 'undefined' || typeof req.body.packageEndDate !== 'undefined') {
      const s = req.body.packageStartDate ? new Date(req.body.packageStartDate) : vehicle.packageStartDate;
      const e = req.body.packageEndDate ? new Date(req.body.packageEndDate) : vehicle.packageEndDate;

      if (s && e && s > e) {
        return res.status(400).json({ message: 'packageStartDate cannot be after packageEndDate' });
      }

      if (req.body.packageStartDate) vehicle.packageStartDate = s;
      if (req.body.packageEndDate) vehicle.packageEndDate = e;

      // Record into packageHistory for auditability
      vehicle.packageHistory = vehicle.packageHistory || [];
      vehicle.packageHistory.push({
        packageId: vehicle.packageId || packageId,
        packageName: vehicle.packageName || (selectedPackage && selectedPackage.name) || null,
        startDate: vehicle.packageStartDate,
        endDate: vehicle.packageEndDate,
        autoRenewed: false,
        updatedByAdmin: true,
        updatedAt: new Date()
      });
    }

    const updatedCustomer = await customer.save();
    
    // Populate vehicle package details
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Vehicle updated successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ message: "Error updating vehicle", error: error.message });
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const { customerId, vehicleId } = req.params;

    // Find customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if customer has only one vehicle
    if (customer.vehicles.length <= 1) {
      return res.status(400).json({ 
        message: "Cannot delete the only vehicle. Customer must have at least one vehicle." 
      });
    }

    // Find and remove vehicle
    const vehicleIndex = customer.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Remove vehicle from array
    customer.vehicles.splice(vehicleIndex, 1);
    
    const updatedCustomer = await customer.save();
    
    // Populate remaining vehicle package details
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(200).json({ 
      message: "Vehicle deleted successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: "Error deleting vehicle", error: error.message });
  }
}