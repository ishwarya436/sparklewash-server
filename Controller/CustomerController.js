// customerController.js
const Customer = require("../models/Customer");
const WashLog = require("../models/WashLog");
const Washer = require("../models/Washer");
const mongoose = require("mongoose");

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

// ✅ Get all customers with package & washer details + wash counts
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate("packageId")   // Get package details
      .populate("washerId");   // Get washer details if stored in customer

    // Add wash counts for each customer
    const customersWithWashCounts = await Promise.all(
      customers.map(async (customer) => {
        const washCounts = await calculateWashCounts(customer);
        
        return {
          _id: customer._id,
          name: customer.name,
          mobileNo: customer.mobileNo,
          email: customer.email,
          apartment: customer.apartment,
          doorNo: customer.doorNo,
          carModel: customer.carModel,
          vehicleNo: customer.vehicleNo,
          packageId: customer.packageId,
          packageName: customer.packageId ? customer.packageId.name : null, // Add package name
          washerId: customer.washerId,
          subscriptionStart: customer.subscriptionStart,
          subscriptionEnd: customer.subscriptionEnd,
          status: customer.status,
          // Add wash count information
          pendingWashes: washCounts.pending,
          completedWashes: washCounts.completed,
          totalMonthlyWashes: washCounts.total,
          // Add package price if available
          price: customer.packageId ? customer.packageId.pricePerMonth : 0
        };
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

// ✅ Add new customer
exports.addCustomer = async (req, res) => {
  try {
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
      washerId
    } = req.body;

    // Validate required fields
    if (!name || !mobileNo || !apartment || !doorNo || !carModel || !vehicleNo || !packageId) {
      return res.status(400).json({ 
        message: "All required fields must be provided" 
      });
    }

    // Calculate subscription dates
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // One month from start date

    // Prepare customer data - handle empty washerId
    const customerData = {
      name,
      mobileNo,
      email,
      apartment,
      doorNo,
      carModel,
      vehicleNo,
      packageId,
      packageName, // Save package name directly
      subscriptionStart,
      subscriptionEnd
    };

    // Only add washerId if it's not empty
    if (washerId && washerId.trim() !== '') {
      customerData.washerId = washerId;
    }

    const newCustomer = new Customer(customerData);

    await newCustomer.save();
    
    // Populate package details for response
    const populatedCustomer = await Customer.findById(newCustomer._id)
      .populate("packageId")
      .populate("washerId");

    // Calculate wash counts for the new customer
    const washCounts = await calculateWashCounts(populatedCustomer);

    const customerWithWashCounts = {
      ...populatedCustomer.toObject(),
      packageName: populatedCustomer.packageName || (populatedCustomer.packageId ? populatedCustomer.packageId.name : null),
      pendingWashes: washCounts.pending,
      completedWashes: washCounts.completed,
      totalMonthlyWashes: washCounts.total,
      price: populatedCustomer.packageId ? populatedCustomer.packageId.pricePerMonth : 0
    };

    res.status(201).json({
      message: "Customer added successfully",
      customer: customerWithWashCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding customer", error: error.message });
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
      washerId
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

    // Prepare update data - handle empty washerId
    const updateData = {
      name,
      mobileNo,
      email,
      apartment,
      doorNo,
      carModel,
      vehicleNo,
      packageId,
      packageName, // Update package name directly
      updatedAt: new Date()
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
