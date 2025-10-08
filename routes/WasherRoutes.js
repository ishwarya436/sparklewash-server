const express = require("express");
const router = express.Router();
const { 
  getAllWashers, 
  getAllWasherLogs, 
  getAllWashSchedules,
  authenticateWasher,
  getWasherDashboard,
  completeWash
} = require("../Controller/WasherController");
const washerController = require("../Controller/WasherController");

// GET all washers
router.get("/washer", getAllWashers);

// GET all washer logs
router.get("/washerlogs", getAllWasherLogs);

// GET all wash schedules
router.get("/washschedules", getAllWashSchedules);

// POST authenticate washer
router.post("/authenticate", authenticateWasher);

// GET washer dashboard data
router.get("/dashboard/:washerId", getWasherDashboard);

// POST complete a wash
router.post("/complete-wash", completeWash);



// Routes
router.post("/addwasher", washerController.addWasher);        // Add new washer
// router.get("/allwashers", washerController.getAllWashers);     // Get all washers
router.get("/getwasher", washerController.getWasherById);  // Get washer by ID
router.put("/:id", washerController.updateWasher);   // Update washer
router.delete("/:id", washerController.deleteWasher);// Delete washer
router.post("/newwasher", washerController.addnewWasher);



// ✅ Paginated route
 router.get("/getAllWasher", washerController.getAllWasher);


module.exports = router;
