const {
  isUndefined,
  isNotValidString,
  isNotValidEmail,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
// const viewRepo = AppDataSource.getRepository("View_Stat");

//固定路由
//教練取得所有課程的觀看次數加總

//動態路由

//教練取得其一門課程的觀看次數(月度、加總)
async function getCoachViewStat(req, res, next) {
  try {
    const courseId = req.params.courseId;
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: "",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStat,
};
