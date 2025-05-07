const { getTypeByStudentCount } = require("../services/getTypeByStudentCount");
//取得課程類別（依照學生排序）
async function getCourseType(req, res, next) {
  try {
    const result = await getTypeByStudentCount();
    console.log(result);
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: result,
      meta: {
        sort: "desc",
        sort_by: "popular",
        type: "course", //幫助前端判斷顯示的是課程列表還是教練列表
      },
    });
  } catch (error) {
    next(error);
  }
}
//取得教練類別（依照學生排序）
async function getCoachType(req, res, next) {
  try {
    const result = await getTypeByStudentCount();
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: result,
      meta: {
        sort: "desc",
        sort_by: "popular",
        type: "coach", //幫助前端判斷顯示的是課程列表還是教練列表
      },
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  getCourseType,
  getCoachType,
};
