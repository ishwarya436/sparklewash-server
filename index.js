const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const EmployeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes");
const Job = require("./models/Jobs");

dotenv.config();
const app = express();
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());


// Routes
const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api", dashboardRoutes);



// Allow Vite frontend (port 5173 by default)

app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use("/api/auth", authRoutes);
app.use('/api/getUser', EmployeeRoutes)
// app.use("/api/employees", EmployeeRoutes);
app.use("/api/users", userRoutes);



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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));