const generateError = (statusCode, errMessage, next) => {
  const error = new Error(errMessage || "發生未知錯誤");
  error.statusCode = statusCode;
  error.status = false;
  return error;
};

module.exports = generateError;
