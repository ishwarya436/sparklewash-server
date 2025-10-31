const Customer = require('../models/Customer');
const Package = require('../models/Package');

// Renew packages that have endDate <= now and are active
async function runAutoRenewOnce() {
  const now = new Date();
  // Find customers with vehicles that have packageEndDate <= now
  const customers = await Customer.find({ 'vehicles.packageEndDate': { $lte: now } });

  let renewed = 0;

  for (const customer of customers) {
    let modified = false;
    for (const vehicle of customer.vehicles) {
      if (vehicle.packageEndDate && vehicle.packageEndDate <= now) {
        console.log(`Auto-renew candidate: customer=${customer._id} vehicle=${vehicle._id} package=${vehicle.packageName} end=${vehicle.packageEndDate}`);
        // Extend package by 1 month from previous end
        const prevEnd = vehicle.packageEndDate || now;
        const newStart = prevEnd;
        const newEnd = new Date(prevEnd);
        newEnd.setDate(newEnd.getDate() + 29); // Always use 29 days

        // Perform an atomic update on the specific vehicle subdocument to ensure persistence
        const updateResult = await Customer.updateOne(
          { _id: customer._id, 'vehicles._id': vehicle._id },
          {
            $set: {
              'vehicles.$.packageStartDate': newStart,
              'vehicles.$.packageEndDate': newEnd
            },
            $push: {
              'vehicles.$.packageHistory': {
                packageId: vehicle.packageId,
                packageName: vehicle.packageName,
                startDate: newStart,
                endDate: newEnd,
                autoRenewed: true,
                renewedOn: new Date()
              }
            }
          }
        );
        console.log(`Atomic update result for customer=${customer._id} vehicle=${vehicle._id}:`, updateResult.nModified || updateResult.modifiedCount || updateResult);
        renewed++;
      }
    }
    // no-op: updates handled atomically per vehicle
  }

  // Also handle legacy single-vehicle customers using packageEndDate on customer
  const legacyCustomers = await Customer.find({ packageEndDate: { $lte: now } });
  for (const customer of legacyCustomers) {
    // If customer has vehicles skip (already handled)
    if (customer.vehicles && customer.vehicles.length > 0) continue;

    const prevEnd = customer.packageEndDate || now;
    const newStart = prevEnd;
    const newEnd = new Date(prevEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);

    // Atomic update for legacy single-vehicle customer
    const legacyUpdate = await Customer.updateOne(
      { _id: customer._id },
      {
        $set: { packageStartDate: newStart, packageEndDate: newEnd },
        $push: { packageHistory: { packageId: customer.packageId, packageName: customer.packageName, startDate: newStart, endDate: newEnd, autoRenewed: true, renewedOn: new Date() } }
      }
    );
    console.log(`Legacy atomic update result for customer=${customer._id}:`, legacyUpdate.nModified || legacyUpdate.modifiedCount || legacyUpdate);
    renewed++;
  }

  return { renewed };
}

async function renewVehiclePackage(customerId, vehicleId) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found');
  const vehicle = customer.vehicles.id(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');

  const now = new Date();
  const prevEnd = vehicle.packageEndDate || now;
  const newStart = prevEnd;
  const newEnd = new Date(prevEnd);
  newEnd.setDate(newEnd.getDate() + 29); // Always use 29 days

  vehicle.packageStartDate = newStart;
  vehicle.packageEndDate = newEnd;
  if (!vehicle.packageHistory) vehicle.packageHistory = [];
  vehicle.packageHistory.push({
    packageId: vehicle.packageId,
    packageName: vehicle.packageName,
    startDate: newStart,
    endDate: newEnd,
    autoRenewed: true,
    renewedOn: new Date()
  });

  await customer.save();
  return vehicle;
}

module.exports = {
  runAutoRenewOnce,
  renewVehiclePackage
};
