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
//取得教練資訊
async function getCoachDetails(req, res, next) {
  try {
    const coachId = req.params.coachId;
    if (isNotValidUUID(coachId)) {
      return next(generateError(400, "教練 ID 格式不正確"));
    }
    const coach = await coachRepo.findOneBy({ id: coachId });
    if (!coach) {
      return next(generateError(404, "查無此教練"));
    }

    const data = {
      id: coach.id,
      nickname: coach.nickname,
      job_title: coach.job_title,
      about_me: coach.about_me,
      hobby: coach.hobby,
      experience: coach.experience,
      favoriteWords: coach.favoriteWords,
      motto: coach.motto,
      profile_image_url: coach.profile_image_url,
      background_image_url: coach.background_image_url,
    };

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCourseType,
  getCoachType,
  getCoachDetails,
};
