const mongoose = require("mongoose");
const Package = require("../models/Package");
require("dotenv").config();

// Your SparkleWash Package Pricing Structure
const packages = [
  // BASIC PACKAGE
  {
    name: "Basic",
    carType: "sedan",
    pricePerMonth: 900,
    exteriorWashes: 8,
    interiorWashes: 2,
    washesPerWeek: 2,
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for Sedan cars"
  },
  {
    name: "Basic",
    carType: "suv",
    pricePerMonth: 1000,
    exteriorWashes: 8,
    interiorWashes: 2,
    washesPerWeek: 2,
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for SUV cars"
  },
  {
    name: "Basic",
    carType: "premium",
    pricePerMonth: 1200,
    exteriorWashes: 8,
    interiorWashes: 2,
    washesPerWeek: 2,
    washDays: ["Monday", "Thursday"],
    description: "8 Exterior washes + 2 Interior washes per month for Premium cars"
  },
  
  // MODERATE PACKAGE
  {
    name: "Moderate",
    carType: "sedan",
    pricePerMonth: 1000,
    exteriorWashes: 12,
    interiorWashes: 2,
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes + 2 Interior washes per month for Sedan cars"
  },
  {
    name: "Moderate",
    carType: "suv",
    pricePerMonth: 1200,
    exteriorWashes: 12,
    interiorWashes: 2,
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes + 2 Interior washes per month for SUV cars"
  },
  {
    name: "Moderate",
    carType: "premium",
    pricePerMonth: 1500,
    exteriorWashes: 12,
    interiorWashes: 2,
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes + 2 Interior washes per month for Premium cars"
  },
  
  // CLASSIC PACKAGE
  {
    name: "Classic",
    carType: "sedan",
    pricePerMonth: 900,
    exteriorWashes: 12,
    interiorWashes: 0, // Only exterior washes
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Sedan cars (Premium exterior only)"
  },
  {
    name: "Classic",
    carType: "suv",
    pricePerMonth: 1100,
    exteriorWashes: 12,
    interiorWashes: 0,
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for SUV cars (Premium exterior only)"
  },
  {
    name: "Classic",
    carType: "premium",
    pricePerMonth: 1300,
    exteriorWashes: 12,
    interiorWashes: 0,
    washesPerWeek: 3,
    washDays: ["Monday", "Wednesday", "Friday"],
    description: "12 Exterior washes per month for Premium cars (Premium exterior only)"
  }
];

async function seedPackages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log("MongoDB Connected for seeding...");
    
    // Clear existing packages
    await Package.deleteMany({});
    console.log("Existing packages cleared");
    
    // Insert new packages
    const createdPackages = await Package.insertMany(packages);
    console.log(`✅ ${createdPackages.length} packages created successfully!`);
    
    // Display created packages
    createdPackages.forEach(pkg => {
      console.log(`📦 ${pkg.name} - ${pkg.carType.toUpperCase()} - ₹${pkg.pricePerMonth}/month`);
    });
    
    console.log("\n🎉 SparkleWash packages seeded successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("Error seeding packages:", error);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  seedPackages();
}

module.exports = { seedPackages, packages };