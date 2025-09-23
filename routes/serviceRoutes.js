const express = require('express');
const router = express.Router();
const ServiceController = require('../Controllers/ServiceController');
const Service = require('../models/Service');
// Add service
router.post('/services', ServiceController.addService);

// Get all services
router.get('/services', ServiceController.getServices);

// Update service
router.put('/services/:id', ServiceController.updateService);

// Delete service
router.delete('/services/:id', ServiceController.deleteService);

module.exports = router;
