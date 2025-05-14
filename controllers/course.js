const AppDataSource = require("../db/data-source");
const coachRepo = AppDataSource.getRepository("Coach");
const courseRepo = AppDataSource.getRepository("Course");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");
const { getAllCourseTypes } = require("../services/typeServices");
const { filterByCategory } = require("../services/filterServices");
const { fullCourseFields } = require("../services/courseSelectFields");
const generateError = require("../utils/generateError");
const paginate = require("../utils/paginate");
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

//取得課程列表
async function getCourses(req, res, next) {
  try {
    //禁止前端亂輸入參數，如banana=999
    const validQuerys = ["page", "sortBy", "category", "skillId"];
    const queryKeys = Object.keys(req.query);
    const invalidQuerys = queryKeys.filter((key) => !validQuerys.includes(key));
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    //排序設定
    const sort = "DESC"; //後端寫死
    const sortBy = req.query.sortBy || "popular"; //預設按照熱門程度排序
    const validSortBy = ["popular", "score"];
    if (!validSortBy.includes(sortBy)) return next(generateError(400, "無此排序方式"));
    //在撈資料前預先設定排序方式對應的參數
    const validSortParams = {
      popular: "c.student_amount",
      score: "c.score",
    };
    //根據sortBy query取出參數
    const sortParam = validSortParams[sortBy];
    if (!sortParam) {
      return next(generateError(400, "排序欄位參數不正確"));
    }
    //取得課程資料
    const rawCourses = await AppDataSource.getRepository("Course")
      .createQueryBuilder("c") //c=Course
      .innerJoin("c.Skill", "s") //s=Skill
      .innerJoin("c.Coach", "coach")
      .select(fullCourseFields)
      .orderBy(sortParam, "DESC") //根據前端參數，載入排序設定
      .getRawMany();

    //分類設定
    const category = req.query.category || "all"; //當前顯示類別，預設顯示所有類別
    const validCategories = ["all", "skill"]; //所有類別、已收藏、特定類別（如：瑜伽）
    if (!validCategories.includes(category)) return next(generateError(400, "無此類別"));
    let filteredCourses;
    if (category === "skill") {
      const skillId = req.query.skillId; //若category="skill"，前端再回傳一個參數skillId
      if (!skillId || isNotValidUUID(skillId))
        return next(generateError(400, "類別為 skill 時必須提供合法的 skillId"));
      //取得對應分類的資料
      filteredCourses = await filterByCategory(rawCourses, category, skillId);
    } else {
      //取得對應分類的資料
      filteredCourses = await filterByCategory(rawCourses, category);
    }

    //分頁設定
    const page = parseInt(req.query.page) || 1; //當前頁數
    const limit = 9; //每頁最多顯示9堂課程
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }
    //取得當前分頁資料，以及分頁資訊
    const { paginatedData, pagination } = await paginate(filteredCourses, page, limit);
    //若頁數超出範圍，回傳錯誤
    const totalPages = pagination.total_pages;
    if (page > totalPages && totalPages !== 0) {
      return next(generateError(400, "頁數超出範圍"));
    }

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: paginatedData,
      meta: {
        filter: {
          category, //篩選類別
          sort, //排序（desc/asc）
          sortBy, //排序方式
        },
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

//取得你可能會喜歡課程列表
async function getRecommandCourses(req, res, next) {
  try {
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }

    //排序設定
    const sort = "DESC"; //後端寫死
    const sortBy = "popular"; //後端寫死

    //取得課程資料
    const rawCourses = await AppDataSource.getRepository("Course")
      .createQueryBuilder("c") //c=Course
      .innerJoin("c.Skill", "s") //s=Skill
      .innerJoin("c.Coach", "coach")
      .select(fullCourseFields)
      .orderBy("c.student_amount", "DESC") //按照課程學生人數排序
      .getRawMany();

    //只取前三筆推薦課程，且不包含當前頁面的課程
    const recommandCourses = rawCourses
      .filter((course) => course.course_id !== courseId)
      .slice(0, 3);

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: recommandCourses,
      meta: {
        sort,
        sortBy,
      },
    });
  } catch (error) {
    next(error);
  }
}

//取得教練已開設課程列表
async function getCoachCourses(req, res, next) {
  try {
    const coachId = req.params.coachId;
    if (isNotValidUUID(coachId)) {
      return next(generateError(400, "教練 ID 格式不正確"));
    }

    //排序設定
    const sort = "DESC"; //後端寫死
    const sortBy = "popular"; //後端寫死

    //取得課程資料
    const rawCourses = await AppDataSource.getRepository("Course")
      .createQueryBuilder("c") //c=Course
      .innerJoin("c.Skill", "s") //s=Skill
      .innerJoin("c.Coach", "coach")
      .select(fullCourseFields)
      .where("coach.id = :coachId", { coachId })
      .orderBy("c.student_amount", "DESC") //按照課程學生人數排序
      .getRawMany();

    //取出前三筆
    const coachCourses = rawCourses.slice(0, 3);

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: coachCourses,
      meta: {
        sort,
        sortBy,
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
  getCourses,
  getRecommandCourses,
  getCoachCourses,
  getCoachDetails,
  getCourseDetails,
};
