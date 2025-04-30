module.exports = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "請先登入" });
    }
    if (req.user.role !== "COACH") {
      return res.status(403).json({ message: "權限不足，請聯絡管理員" });
    }
    next();
  } catch (error) {
    next(error);
  }
};
