const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const EmployeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes");
const Job = require("./models/Jobs");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { getAllCustomers } = require("./Controller/CustomerController");
const customerRoutes = require("./routes/CustomerRoutes");
const WasherRoutes = require("./routes/WasherRoutes");
const PackageRoutes = require("./routes/PackageRoutes");



dotenv.config();
const app = express();
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());


// Routes
app.use("/api", dashboardRoutes);



// Allow Vite frontend (port 5173 by default)

app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use("/api/auth", authRoutes);
app.use('/api/getUser', EmployeeRoutes)
// app.use("/api/employees", EmployeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customer", customerRoutes);



// ✅ Use Package Routes
app.use("/api/package", PackageRoutes);

// DB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));


app.get("/", (req, res) => {
  res.send("SparkleWash API running...");
});



// Use Washer routes
// /api/washers -> GET all washers
// /api/washers/logs -> GET all washer logs
// /api/washers/schedules -> GET all wash schedules
app.use("/api/washer", WasherRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));