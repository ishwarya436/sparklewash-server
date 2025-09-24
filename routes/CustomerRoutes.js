const express = require("express");
const router = express.Router();
const { getAllCustomers } = require("../Controller/CustomerController");

router.get("/getcustomers", getAllCustomers); // GET /api/customers

module.exports = router;
