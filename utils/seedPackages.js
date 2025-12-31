const mongoose = require("mongoose");
const Package = require("../models/Package");
require("dotenv").config();

// Packages compatible with models/Package.js
const packages = [
  // Basic
  {
    name: "Basic",
    carType: "sedan",
    pricePerMonth: 900,
    washCountPerWeek: 2,
    washCountPerMonth: 8,
    interiorCleaning: "2 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for Sedan cars",
    isActive: true,
  },
  {
    name: "Basic",
    carType: "suv",
    pricePerMonth: 1000,
    washCountPerWeek: 2,
    washCountPerMonth: 8,
    interiorCleaning: "2 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for SUV cars",
    isActive: true,
  },
  {
    name: "Basic",
    carType: "premium",
    pricePerMonth: 1200,
    washCountPerWeek: 2,
    washCountPerMonth: 8,
    interiorCleaning: "2 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for Premium cars",
    isActive: true,
  },

  // Moderate (no interior per your request)
  {
    name: "Moderate",
    carType: "sedan",
    pricePerMonth: 1000,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Sedan cars (No interior)",
    isActive: true,
  },
  {
    name: "Moderate",
    carType: "suv",
    pricePerMonth: 1200,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for SUV cars (No interior)",
    isActive: true,
  },
  {
    name: "Moderate",
    carType: "premium",
    pricePerMonth: 1500,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Premium cars (No interior)",
    isActive: true,
  },

  // Classic
  {
    name: "Classic",
    carType: "sedan",
    pricePerMonth: 900,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "Yes",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Sedan cars (Premium exterior only)",
    isActive: true,
  },
  {
    name: "Classic",
    carType: "suv",
    pricePerMonth: 1100,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "Yes",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for SUV cars (Premium exterior only)",
    isActive: true,
  },
  {
    name: "Classic",
    carType: "premium",
    pricePerMonth: 1300,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "0 per month",
    exteriorWaxing: "Yes",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Premium cars (Premium exterior only)",
    isActive: true,
  }
,
  // Hatch Pack (new)
  {
    name: "Hatch Pack",
    carType: "hatch",
    pricePerMonth: 800,
    washCountPerWeek: 3,
    washCountPerMonth: 12,
    interiorCleaning: "2 per month",
    exteriorWaxing: "No",
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes + 2 Interior washes per month for Hatch cars",
    isActive: true,
  }
];

async function seedPackages() {
  try {
    // If mongoose is not already connected, establish a temporary connection
    let createdConnection = false;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log("MongoDB Connected for seeding (temporary connection)...");
      createdConnection = true;
    } else {
      console.log("Using existing mongoose connection for seeding...");
    }

    // Clear existing packages
    await Package.deleteMany({});
    console.log("Existing packages cleared");

    // Insert new packages
    const createdPackages = await Package.insertMany(packages);
    console.log(`✅ ${createdPackages.length} packages created successfully!`);

    createdPackages.forEach(pkg => {
      console.log(`📦 ${pkg.name} - ${pkg.carType.toUpperCase()} - ₹${pkg.pricePerMonth}/month`);
    });

    // If we created a temporary connection, close it. Otherwise leave connection open.
    if (createdConnection) {
      await mongoose.disconnect();
      console.log("Temporary mongoose connection closed after seeding.");
    }
    // return success (do not exit process here)
    return createdPackages;
  } catch (error) {
    console.error("Error seeding packages:", error);
    throw error;
  }
}

// Run the seeder if called directly
if (require.main === module) {
  seedPackages()
    .then(() => {
      console.log('Seeding completed (direct execution).');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed (direct execution):', err);
      process.exit(1);
    });
}

module.exports = { seedPackages, packages };  