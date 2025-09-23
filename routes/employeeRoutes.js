const express = require("express");
const Employee = require("../models/Employee");
const { successResponse, errorResponse } = require("../utils/response");
const router = express.Router();

// CREATE Employee
router.post("/", async (req, res) => {
  try {
    const { name, email, position, salary } = req.body;
    const newEmployee = new Employee({ name, email, position, salary });
    await newEmployee.save();
    res.status(201).json(successResponse("Employee created successfully", newEmployee));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json(errorResponse("Email ID Already Exists"));
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json(errorResponse("Validation failed", messages));
    }
    res.status(500).json(errorResponse(err.message));
  }
})

// READ all employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json({message: "Employees fetched successfully", data: employees});
  } catch (err) {
    res.status(500).json(err.message);
  }
});

// READ one employee by ID
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json(errorResponse("Employee not found"));
    res.json(successResponse("Employee fetched successfully", employee));
  } catch (err) {
    res.status(500).json(errorResponse(err.message));
  }
});

// UPDATE employee
router.put("/:id", async (req, res) => {
  try {
    const { name, email, position, salary } = req.body;
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, email, position, salary },
      { new: true, runValidators: true } // runValidators ensures Mongoose validates updates
    );
    if (!updatedEmployee) return res.status(404).json(errorResponse("Employee not found"));
    res.json(successResponse("Employee updated successfully", updatedEmployee));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json(errorResponse("Email ID Already Exists"));
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json(errorResponse("Validation failed", messages));
    }
    res.status(500).json(errorResponse(err.message));
  }
});

// DELETE employee
router.delete("/:id", async (req, res) => {
  try {
    const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);
    if (!deletedEmployee) return res.status(404).json(errorResponse("Employee not found"));
    res.json(successResponse("Employee deleted successfully", null));
  } catch (err) {
    res.status(500).json(errorResponse(err.message));
  }
});

module.exports = router;