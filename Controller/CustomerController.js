// customerController.js
const Customer = require("../models/Customer");
const Package = require('../models/Package');
const WashLog = require("../models/WashLog");
const Washer = require("../models/Washer");
const mongoose = require("mongoose");
const XLSX = require('xlsx');

// Helper function to calculate wash counts for a customer
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

// Helper function to calculate wash counts for individual vehicles
const calculateVehicleWashCounts = async (customerId, vehicle) => {
  try {
    if (!vehicle.packageId) return { completed: 0, pending: 0, total: 0 };
    
    // Calculate total washes for current month based on package
    let totalMonthlyWashes = 0;
    const packageName = vehicle.packageId.name;
    
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
    
    // Count completed washes this month for this specific vehicle
    const completedWashes = await WashLog.countDocuments({
      customerId: customerId,
      vehicleId: vehicle._id,
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
    console.error('Error calculating vehicle wash counts:', error);
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
              const vehicleWashCounts = await calculateVehicleWashCounts(customer._id, vehicle);
              aggregateWashCounts.completed += vehicleWashCounts.completed;
              aggregateWashCounts.pending += vehicleWashCounts.pending;
              aggregateWashCounts.total += vehicleWashCounts.total;
              
              return {
                _id: vehicle._id,
                carModel: vehicle.carModel,
                vehicleNo: vehicle.vehicleNo,
                carType: vehicle.carType,
                packageId: vehicle.packageId,
                packageName: vehicle.packageId ? vehicle.packageId.name : null,
                washerId: vehicle.washerId,
                washingSchedule: vehicle.washingSchedule,
                subscriptionStart: vehicle.subscriptionStart,
                subscriptionEnd: vehicle.subscriptionEnd,
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
            subscriptionStart: customer.subscriptionStart,
            subscriptionEnd: customer.subscriptionEnd,
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

    const customer = await Customer.findById(id)
      .populate("packageId")
      .populate("washerId");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const washCounts = await calculateWashCounts(customer);

    const customerWithWashCounts = {
      ...customer.toObject(),
      packageName: customer.packageId ? customer.packageId.name : null, // Add package name
      pendingWashes: washCounts.pending,
      completedWashes: washCounts.completed,
      totalMonthlyWashes: washCounts.total,
      price: customer.packageId ? customer.packageId.pricePerMonth : 0
    };

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

          // Calculate subscription dates
          const subscriptionStart = new Date();
          const subscriptionEnd = new Date();
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

          // Determine washing schedule
          let washingDays = [];
          let washFrequencyPerMonth = 8;
          
          const selectedScheduleType = vehicle.scheduleType || 'schedule1';
          
          if (selectedPackage.name === 'Basic') {
            washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
            washFrequencyPerMonth = 8;
          } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic') {
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
            subscriptionStart,
            subscriptionEnd,
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
        subscriptionStart: undefined,
        subscriptionEnd: undefined
      });

      const savedCustomer = await newCustomer.save();
      
      // Populate vehicle package and washer details
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
      const subscriptionStart = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

      let washingDays = [];
      let washFrequencyPerMonth = 8;
      
      const selectedScheduleType = scheduleType || 'schedule1';
      
      if (selectedPackage.name === 'Basic') {
        washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
        washFrequencyPerMonth = 8;
      } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic') {
        washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
        washFrequencyPerMonth = 12;
      }

      // Create single vehicle customer
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
        subscriptionStart,
        subscriptionEnd,
        status: 'active'
      });

      const savedCustomer = await newCustomer.save();
      
      const populatedCustomer = await Customer.findById(savedCustomer._id)
        .populate('packageId')
        .populate('washerId');

      res.status(201).json({ 
        message: "Customer created successfully", 
        customer: populatedCustomer 
      });
    }

  } catch (error) {
    console.error('Error creating customer:', error);
    
    if (error.code === 11000) {
      // Handle duplicate key error
      const duplicateField = Object.keys(error.keyValue)[0];
      const duplicateValue = error.keyValue[duplicateField];
      
      return res.status(400).json({ 
        message: `${duplicateField === 'vehicleNo' ? 'Vehicle number' : duplicateField} '${duplicateValue}' already exists` 
      });
    }
    
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

    // Validate required fields
    if (!name || !mobileNo || !apartment || !doorNo || !carModel || !vehicleNo || !packageId) {
      return res.status(400).json({ 
        message: "All required fields must be provided" 
      });
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
    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage) {
      return res.status(400).json({ 
        message: "Selected package not found" 
      });
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
      } else if (packageName === 'Moderate' || packageName === 'Classic') {
        // Moderate/Classic: 3 times a week
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
      carModel,
      carType: selectedPackage.carType, // Update carType from selected package
      vehicleNo,
      packageId,
      packageName, // Update package name directly
      updatedAt: new Date(),
      ...washingScheduleUpdate // Include washing schedule updates
    };

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
      washerName: wash.washerId ? wash.washerId.name : 'Unknown'
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

// ✅ Complete a wash for a customer
exports.completeWash = async (req, res) => {
  try {
    const { customerId, washerId, washerName } = req.body;

    // Validate required fields
    if (!customerId || !washerId) {
      return res.status(400).json({ message: "Customer ID and Washer ID are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(washerId)) {
      return res.status(400).json({ message: "Invalid Customer ID or Washer ID" });
    }

    // Check if customer exists and is assigned to this washer
    const customer = await Customer.findById(customerId).populate('packageId');
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (customer.washerId && customer.washerId.toString() !== washerId) {
      return res.status(403).json({ message: "Customer is not assigned to this washer" });
    }

    // Calculate current wash counts
    const washCounts = await calculateWashCounts(customer);
    
    // Check if customer has pending washes
    if (washCounts.pending <= 0) {
      return res.status(400).json({ message: "Customer has no pending washes for this month" });
    }

    // Determine wash type based on package
    let washType = "exterior"; // default
    if (customer.packageId?.name) {
      const packageName = customer.packageId.name.toLowerCase();
      if (packageName.includes("classic") || packageName.includes("premium")) {
        washType = "both";
      } else if (packageName.includes("moderate")) {
        washType = "exterior";
      }
    }

    // Create wash log entry with all required fields
    const washLog = new WashLog({
      customerId: customerId,
      washerId: washerId,
      packageId: customer.packageId?._id,
      washDate: new Date(),
      washType: washType,
      apartment: customer.apartment || 'Not specified',
      doorNo: customer.doorNo || 'Not specified',
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

    // Update customer's last wash date
    customer.washingSchedule.lastWashDate = new Date();
    await customer.save();

    // Calculate updated wash counts
    const updatedWashCounts = await calculateWashCounts(customer);

    res.status(200).json({
      message: "Wash completed successfully",
      washId: washLog._id,
      pendingWashes: updatedWashCounts.pending,
      completedWashes: updatedWashCounts.completed,
      totalMonthlyWashes: updatedWashCounts.total
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

    // Create template data structure - use actual values for the sample row
    const templateData = [
      {
        name: 'John Doe',
        mobileNo: '1234567890',
        email: 'john@example.com',
        apartment: 'ABC Apartments',
        doorNo: '101',
        carModel: 'Honda City',
        carType: 'sedan',
        vehicleNo: 'TN01AB1234',
        packageName: 'Basic',
        scheduleType: 'schedule1'
      }
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Auto-size columns to make headers fully visible
    const columnWidths = [
      { wch: 15 }, // name
      { wch: 12 }, // mobileNo
      { wch: 25 }, // email
      { wch: 20 }, // apartment
      { wch: 10 }, // doorNo
      { wch: 15 }, // carModel
      { wch: 12 }, // carType
      { wch: 15 }, // vehicleNo
      { wch: 15 }, // packageName
      { wch: 15 }  // scheduleType
    ];
    worksheet['!cols'] = columnWidths;

    // Add Excel Data Validation for dropdowns
    if (!worksheet['!dataValidation']) {
      worksheet['!dataValidation'] = {};
    }

    // CarType dropdown validation for rows 2 to 1000 (column G)
    for (let i = 2; i <= 1000; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: i - 1, c: 6 }); // Column G (0-indexed: 6)
      worksheet['!dataValidation'][cellAddress] = {
        type: 'list',
        allowBlank: false,
        showDropDown: true,
        formula1: '"sedan,suv,premium"'
      };
    }

    // PackageName dropdown validation for rows 2 to 1000 (column I)
    for (let i = 2; i <= 1000; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: i - 1, c: 8 }); // Column I (0-indexed: 8)
      worksheet['!dataValidation'][cellAddress] = {
        type: 'list',
        allowBlank: false,
        showDropDown: true,
        formula1: '"Basic,Moderate,Classic"'
      };
    }

    // ScheduleType dropdown validation for rows 2 to 1000 (column J)
    for (let i = 2; i <= 1000; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: i - 1, c: 9 }); // Column J (0-indexed: 9)
      worksheet['!dataValidation'][cellAddress] = {
        type: 'list',
        allowBlank: false,
        showDropDown: true,
        formula1: '"schedule1,schedule2"'
      };
    }

    // Create dropdown options sheets
    const carTypeOptions = [
      { "Car Types": "sedan" },
      { "Car Types": "suv" },
      { "Car Types": "premium" }
    ];
    const carTypeSheet = XLSX.utils.json_to_sheet(carTypeOptions);

    const packageOptions = [
      { "Package Names": "Basic" },
      { "Package Names": "Moderate" },
      { "Package Names": "Classic" }
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
        Description: 'DROPDOWN: Click cell to see dropdown with sedan, suv, premium',
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
        Description: 'DROPDOWN: Click cell to see dropdown with Basic, Moderate, Classic',
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

// ✅ Bulk import customers from Excel
exports.bulkImportCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return res.status(400).json({ message: "No data found in the uploaded file" });
    }

    const results = {
      total: jsonData.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Get all packages for reference (removed washers since we don't need them)
    const packages = await Package.find();

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (accounting for header)

      try {
        // Validate required fields
        if (!row.name || !row.mobileNo || !row.apartment || !row.doorNo || 
            !row.carModel || !row.vehicleNo || !row.packageName) {
          throw new Error('Missing required fields');
        }

        // Validate mobile number
        if (!/^\d{10}$/.test(row.mobileNo.toString().trim())) {
          throw new Error('Mobile number must be 10 digits');
        }

        // Validate email if provided
        if (row.email && !/\S+@\S+\.\S+/.test(row.email)) {
          throw new Error('Invalid email format');
        }

        // Find package
        const selectedPackage = packages.find(pkg => 
          pkg.name.toLowerCase() === row.packageName.toLowerCase()
        );
        if (!selectedPackage) {
          throw new Error(`Package '${row.packageName}' not found`);
        }

        // Validate carType
        if (!['sedan', 'suv', 'premium'].includes(row.carType?.toLowerCase())) {
          throw new Error('carType must be sedan, suv, or premium');
        }

        // Validate scheduleType
        if (!['schedule1', 'schedule2'].includes(row.scheduleType)) {
          throw new Error('scheduleType must be schedule1 or schedule2');
        }

        // Check if vehicle number already exists
        const existingVehicle = await Customer.findOne({ vehicleNo: row.vehicleNo.trim() });
        if (existingVehicle) {
          throw new Error(`Vehicle number ${row.vehicleNo} already exists`);
        }

        // Calculate subscription dates
        const subscriptionStart = new Date();
        const subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

        // Determine washing schedule
        let washingDays = [];
        let washFrequencyPerMonth = 8;
        
        if (row.packageName === 'Basic') {
          washingDays = row.scheduleType === 'schedule1' ? [1, 4] : [2, 6];
          washFrequencyPerMonth = 8;
        } else if (row.packageName === 'Moderate' || row.packageName === 'Classic') {
          washingDays = row.scheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
          washFrequencyPerMonth = 12;
        }

        // Create customer data
        const customerData = {
          name: row.name.trim(),
          mobileNo: row.mobileNo.toString().trim(),
          email: row.email?.trim() || '',
          apartment: row.apartment.trim(),
          doorNo: row.doorNo.toString().trim(),
          carModel: row.carModel.trim(),
          carType: row.carType.toLowerCase(),
          vehicleNo: row.vehicleNo.trim(),
          packageId: selectedPackage._id,
          packageName: selectedPackage.name,
          subscriptionStart,
          subscriptionEnd,
          washingSchedule: {
            scheduleType: row.scheduleType,
            washingDays: washingDays,
            washFrequencyPerMonth: washFrequencyPerMonth,
            lastWashDate: null,
            nextWashDate: null
          }
        };

        // Save customer
        const newCustomer = new Customer(customerData);
        await newCustomer.save();

        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          vehicleNo: row.vehicleNo || 'N/A',
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: "Bulk import completed",
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

    // Create vehicle object
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    let washingDays = [];
    let washFrequencyPerMonth = 8;
    
    const selectedScheduleType = scheduleType || 'schedule1';
    
    if (selectedPackage.name === 'Basic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
      washFrequencyPerMonth = 8;
    } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic') {
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
      subscriptionStart,
      subscriptionEnd,
      status: 'active'
    };

    // Add vehicle to customer
    if (!customer.vehicles) {
      customer.vehicles = [];
    }
    customer.vehicles.push(newVehicle);
    
    const updatedCustomer = await customer.save();
    
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
exports.addVehicleToCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { vehicleNo, carModel, carType, packageId, scheduleType } = req.body;

    // Validate required fields
    if (!vehicleNo || !carModel || !packageId) {
      return res.status(400).json({ 
        message: "Vehicle number, car model, and package are required" 
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
      return res.status(404).json({ message: "Package not found" });
    }

    // Calculate subscription dates
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    // Determine washing schedule
    let washingDays = [];
    let washFrequencyPerMonth = 8;
    
    const selectedScheduleType = scheduleType || 'schedule1';
    
    if (selectedPackage.name === 'Basic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 4] : [2, 6];
      washFrequencyPerMonth = 8;
    } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
      washFrequencyPerMonth = 12;
    }

    // Create new vehicle object
    const newVehicle = {
      carModel: carModel.trim(),
      vehicleNo: vehicleNo.trim().toUpperCase(),
      carType: carType || 'sedan',
      packageId: packageId,
      packageName: selectedPackage.name,
      washerId: null,
      washingSchedule: {
        scheduleType: selectedScheduleType,
        washingDays: washingDays,
        washFrequencyPerMonth: washFrequencyPerMonth
      },
      subscriptionStart,
      subscriptionEnd,
      status: 'active'
    };

    // Add vehicle to customer's vehicles array
    customer.vehicles.push(newVehicle);
    
    const updatedCustomer = await customer.save();
    
    // Populate vehicle package details
    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .populate('vehicles.packageId')
      .populate('vehicles.washerId');

    res.status(201).json({ 
      message: "Vehicle added successfully", 
      customer: populatedCustomer 
    });

  } catch (error) {
    console.error('Error adding vehicle:', error);
    res.status(500).json({ message: "Error adding vehicle", error: error.message });
  }
};

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
    } else if (selectedPackage.name === 'Moderate' || selectedPackage.name === 'Classic') {
      washingDays = selectedScheduleType === 'schedule1' ? [1, 3, 5] : [2, 4, 6];
      washFrequencyPerMonth = 12;
    }

    // Update vehicle details
    customer.vehicles[vehicleIndex].carModel = carModel.trim();
    customer.vehicles[vehicleIndex].vehicleNo = vehicleNo.trim().toUpperCase();
    customer.vehicles[vehicleIndex].carType = carType || customer.vehicles[vehicleIndex].carType;
    customer.vehicles[vehicleIndex].packageId = packageId;
    customer.vehicles[vehicleIndex].packageName = selectedPackage.name;
    customer.vehicles[vehicleIndex].washingSchedule = {
      scheduleType: selectedScheduleType,
      washingDays: washingDays,
      washFrequencyPerMonth: washFrequencyPerMonth
    };

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