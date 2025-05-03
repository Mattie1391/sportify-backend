const generateError = require("../utils/generateError");

module.exports = (req, res, next) => {
  try {
    if (!req.user) {
      return next(generateError(401, "請先登入"));
    }
    if (req.user.id !== req.params.userId) {
      return next(generateError(403, "權限不足，非帳號擁有者"));
    }
    next();
  } catch (error) {
    next(error);
  }
};
