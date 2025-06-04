const generateError = require("../utils/generateError");

module.exports = (req, res, next) => {
  try {
    const { userId, coachId } = req.params;
    if (!req.user) {
      return next(generateError(401, "請先登入"));
    }
    //對象為學員的情況
    if (userId&&req.user.id !== userId) {
      return next(generateError(403, "權限不足，非帳號擁有者"));
    }
    //對象為教練的情況
    if (coachId&&req.user.id !== coachId) {
      return next(generateError(403, "權限不足，非帳號擁有者"));
    }
    next();
  } catch (error) {
    next(error);
  }
};
