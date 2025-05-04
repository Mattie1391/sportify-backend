const generateError = require("../utils/generateError");

module.exports = (req, res, next) => {
  try {
    if (!req.user) {
      return next(generateError(401, "請先登入"));
    }
    if (req.user.role !== "COACH") {
      return next(generateError(403, "權限不足，請聯絡管理員"));
    }
    next();
  } catch (error) {
    next(error);
  }
};
