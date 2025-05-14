const AppDataSource = require("../db/data-source");
const coachRepo = AppDataSource.getRepository("Coach");
const courseRepo = AppDataSource.getRepository("Course");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");
const { getAllCourseTypes } = require("../services/getTypeServices");
const generateError = require("../utils/generateError");
const { isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數

//取得課程類別（依照學生總人數排序）
async function getCourseType(req, res, next) {
  try {
    const result = await getAllCourseTypes();
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

//取得教練類別（依照學生總人數排序）
async function getCoachType(req, res, next) {
  try {
    const result = await getAllCourseTypes();
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

//取得課程資訊
async function getCourseDetails(req, res, next) {
  try {
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }
    const coachId = course.coach_id;
    const coach = await coachRepo.findOneBy({ id: coachId });
    const chapters = await courseChapterRepo.find({
      where: { course_id: courseId },
      order: {
        chapter_number: "ASC",
        id: "ASC", // 若 subtitle 有數字順序也可用它
      },
    });
    const chaptersData = [];
    chapters
      .sort((a, b) => {
        // 確保排序順序正確：先比大章節，再比副章節
        if (a.chapter_number === b.chapter_number) {
          return a.sub_chapter_number - b.sub_chapter_number;
        }
        return a.chapter_number - b.chapter_number;
      })
      .forEach((chapter) => {
        // 嘗試找到該 title 的物件
        let group = chaptersData.find((g) => g.title === chapter.title);
        if (!group) {
          // 如果沒有這個 title，就建立一個新的物件
          group = { title: chapter.title, subtitles: [] };
          chaptersData.push(group);
        }
        group.subtitles.push(chapter.subtitle);
      });

    const data = {
      course: {
        name: course.name,
        score: course.score,
        student_amount: course.student_amount,
        hours: course.total_hours,
        image_url: course.image_url,
        trailer_url: course.trailer_url, //TODO:待確認網址格式，所有課程的第一部影片皆需設為公開
        intro: course.intro,
      },
      coach: {
        name: coach.nickname,
        title: coach.job_title,
        intro: coach.about_me,
        profile_image_url: coach.profile_image_url,
        coachPage_Url: `https://example.com/courses/coaches/${coachId}/details`, //TODO:待跟前端確認
      },
      chapters: chaptersData,
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
  getCourseDetails,
};
