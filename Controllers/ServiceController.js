const Service = require('../models/Service');
const response = require('../utils/response');

// Add new service
exports.addService = async (req, res) => {
  try {
    const { name, description, price, duration } = req.body;
    const service = new Service({ name, description, price, duration });
    await service.save();
    return response.success(res, "Service added successfully", service);
  } catch (error) {
    return response.error(res, error.message);
  }
};

// Get all services
exports.getServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    return response.error(res, "Services fetched successfully", services);
  } catch (error) {
    return response.error(res, error.message);
  }
};

// Update service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration } = req.body;
    const service = await Service.findByIdAndUpdate(
      id,
      { name, description, price, duration },
      { new: true }
    );
    if (!service) return response.error(res, "Service not found", 404);
    return response.successs(res, "Service updated successfully", service);
  } catch (error) {
    return response.error(res, error.message);
  }
};

// Delete service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);
    if (!service) return response.error(res, "Service not found", 404);
    return response.success(res, "Service deleted successfully");
  } catch (error) {
    return response.error(res, error.message);
  }
};
