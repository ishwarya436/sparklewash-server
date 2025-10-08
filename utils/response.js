// utils/response.js
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


