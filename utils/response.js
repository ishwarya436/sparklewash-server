// // controllers/authController.js
// exports.login = (req, res) => {
//   res.json({ message: "Admin login successful" });
// };

// exports.register = (req, res) => {
//   res.json({ message: "User registered successfully" });
// };

// // utils/response.js
// function successResponse(res, message, data = null) {
//   res.json({
//     status: true,
//     message,
//     data,
//   });
// }

// function errorResponse(res, message, data = null) {
//   return {
 
//     status: false,
//     message,
//     data,
//   };
// }

// module.exports = { successResponse, errorResponse };
 
exports.success = (res, message, data = null, status = 200) => {
  return res.status(status).json({
    status: "success",
    message,
    data
  });
};

exports.error = (res, message, data = null, status = 500) => {
  return res.status(status).json({
    status: "error",
    message
  });
};
