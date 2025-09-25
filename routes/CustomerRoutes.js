const express = require("express");
const router = express.Router();
const { 
  getAllCustomers, 
  getCustomerById, 
  addCustomer, 
  updateCustomer,
  deleteCustomer, 
  getCustomerWashHistory,
  allocateWasher,
  completeWash
} = require("../Controller/CustomerController");

router.get("/getcustomers", getAllCustomers); // GET /api/customer/getcustomers
router.get("/:id", getCustomerById); // GET /api/customer/:id
router.post("/add", addCustomer); // POST /api/customer/add
router.put("/update/:id", updateCustomer); // PUT /api/customer/update/:id
router.put("/allocate-washer", allocateWasher); // PUT /api/customer/allocate-washer
router.post("/complete-wash", completeWash); // POST /api/customer/complete-wash
router.delete("/deletecustomer/:id", deleteCustomer); // DELETE /api/customer/deletecustomer/:id
router.get("/:id/wash-history", getCustomerWashHistory); // GET /api/customer/:id/wash-history

module.exports = router;
