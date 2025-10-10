const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// Load environment variables first
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());


// Route imports
const authRoutes = require("./routes/authRoutes");
const EmployeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const customerRoutes = require("./routes/CustomerRoutes");
const washerRoutes = require("./routes/WasherRoutes"); // <-- THIS IS THE CORRECT IMPORT
const packageRoutes = require("./routes/PackageRoutes");


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", EmployeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/washers", washerRoutes); // <-- THIS IS THE CORRECT USAGE
 


// Root endpoint
app.get("/", (req, res) => {
  res.send("SparkleWash API running...");
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));