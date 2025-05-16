//檢查教練是否擁有該課程
const generateError = require("../utils/generateError");
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const { isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數

module.exports = async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程ID格式錯誤"));
    }
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }
    if (req.user.id !== course.coach_id) {
      return next(generateError(403, "權限不足，您未擁有這門課程"));
    }
    //檢查通過，則將控制權交給下個middleware或路由處理函數
    next();
  } catch (error) {
    next(error);
  }
};
