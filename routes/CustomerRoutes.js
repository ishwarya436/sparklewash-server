const express = require("express");
const router = express.Router();
const multer = require('multer');
const { 
  getAllCustomers, 
  getCustomerById, 
  addCustomer, 
  updateCustomer,
  deleteCustomer, 
  getCustomerWashHistory,
  allocateWasher,
  completeWash,
  exportCustomerTemplate,
  bulkImportCustomers,
  // New multi-vehicle functions
  addVehicleToCustomer,
  updateVehicle,
  deleteVehicle,
  allocateWasherToVehicle
} = require("../Controller/CustomerController");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.get("/getcustomers", getAllCustomers); // GET /api/customer/getcustomers
router.get("/:id", getCustomerById); // GET /api/customer/:id
router.post("/add", addCustomer); // POST /api/customer/add (supports multiple vehicles)
router.put("/update/:id", updateCustomer); // PUT /api/customer/update/:id
router.put("/allocate-washer", allocateWasher); // PUT /api/customer/allocate-washer (legacy)
router.post("/complete-wash", completeWash); // POST /api/customer/complete-wash
router.delete("/deletecustomer/:id", deleteCustomer); // DELETE /api/customer/deletecustomer/:id
router.get("/:id/wash-history", getCustomerWashHistory); // GET /api/customer/:id/wash-history

// Multi-vehicle specific routes
router.post("/:customerId/vehicles", addVehicleToCustomer); // POST /api/customer/:customerId/vehicles
router.put("/:customerId/vehicles/:vehicleId", updateVehicle); // PUT /api/customer/:customerId/vehicles/:vehicleId
router.delete("/:customerId/vehicles/:vehicleId", deleteVehicle); // DELETE /api/customer/:customerId/vehicles/:vehicleId
router.put("/:customerId/vehicles/:vehicleId/allocate-washer", allocateWasherToVehicle); // PUT /api/customer/:customerId/vehicles/:vehicleId/allocate-washer

// Bulk operations routes
router.get("/bulk/export-template", exportCustomerTemplate); // GET /api/customer/bulk/export-template
router.post("/bulk/import", upload.single('file'), bulkImportCustomers); // POST /api/customer/bulk/import

module.exports = router;
