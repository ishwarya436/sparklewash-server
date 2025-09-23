const mongoose = require("mongoose");
const User = require("./models/User"); // adjust path if needed
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log("MongoDB connected...");

  await User.insertMany([
    { name: "Priya", email: "priya@example.com", avatar: "https://example.com/avatar1.png", status: "Available", rating: 5 },
    { name: "Dharshini", email: "dharshini@example.com", avatar: "https://example.com/avatar2.png", status: "Busy", rating: 4.5 },
    { name: "John", email: "john@example.com", avatar: "https://example.com/avatar3.png", status: "Available", rating: 4.8 }
  ]);

  console.log("3 users inserted!");
  mongoose.connection.close();
})
.catch(err => console.error(err));
