const AppDataSource = require("../db/data-source");
const skillRepo = AppDataSource.getRepository("Skill");
const coachRepo = AppDataSource.getRepository("Coach");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
const courseRepo = AppDataSource.getRepository("Course");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const config = require("../config/index");
const { Mux } = require("@mux/mux-node");
const { muxSigningKeyForPublic, muxSigningKeySecretForPublic } = config.get("mux");
const mux = new Mux();

//services
const { getAllCourseTypes } = require("../services/typeServices");
const { courseFilter, coachFilter } = require("../services/filterServices");
const { fullCourseFields } = require("../services/courseSelectFields");
const { getChapters } = require("../services/chapterServices");
const { checkValidQuerys } = require("../services/queryServices");

//utils
const generateError = require("../utils/generateError");
const paginate = require("../utils/paginate");
const { isNotValidUUID } = require("../utils/validators");

//取得課程類別（依照觀看總人次排序）
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

//取得教練類別（依照觀看總人次排序）
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

//取得教練列表
async function getCoaches(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["page", "skillId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    //排序設定
    const sort = "DESC"; //後端寫死
    const sortBy = "popular"; //後端寫死

    //取得教練資料
    const rawCoaches = await AppDataSource.getRepository("Coach")
      .createQueryBuilder("c") //c=Coach
      .innerJoin("c.Course", "course")
      .select([
        "c.id AS coach_id", //教練id
        "c.nickname AS coach_name", //教練名稱
        "c.job_title AS coach_title", //教練title
        "c.profile_image_url AS coach_profile_image_url", //教練頭像
        "c.about_me AS coach_about_me", //教練自我介紹
        "SUM(course.numbers_of_view) AS numbers_of_view", //教練觀看人次總數
      ])
      .where("c.is_verified = :isVerified", { isVerified: true }) //只取得已認證的教練資料
      .andWhere("course.is_approved = :isApproved", { isApproved: true }) //必須有已審核的課程資料
      .groupBy("c.id") // 將相同教練的資料聚合,計算每個教練的總觀看人次
      .orderBy("numbers_of_view", sort) //按觀看人次排序，讓熱門課程類別排在前面
      .getRawMany();

    //取得所有教練對應技能的資料
    const coachSkills = await coachSkillRepo.find({
      select: ["coach_id", "skill_id", "Skill.name"],
      relations: ["Skill"],
    });

    const coaches = rawCoaches.map((coach) => {
      // 從所有 coachSkills 中，找出該教練擁有的技能資料
      const skills = coachSkills
        .filter((cs) => cs.coach_id === coach.coach_id) //篩選出該教練id對應的課程資料
        .map((cs) => ({
          //重新整理要回傳的資料
          skill_id: cs.skill_id, //技能id
          skill_name: cs.Skill.name, //技能名稱
        }));
      //在每筆教練資料中加入對應的coach_skills欄位
      return {
        ...coach, //保留原本的教練資料
        coach_skills: skills, //新增每個教練對應的技能欄位
      };
    });

    //依照分類篩選課程資料
    let filteredCoaches = coaches;
    const skillId = req.query.skillId;
    //若有回傳skillId,取得對應分類的資料
    if (skillId) {
      if (isNotValidUUID(skillId)) return next(generateError(400, "類別 ID 格式不正確"));
      // 確認 skillId 是否存在於資料庫
      const skill = await skillRepo.findOneBy({ id: skillId });
      if (!skill) {
        return next(generateError(404, "查無此課程類別"));
      }
      filteredCoaches = await coachFilter(coaches, skillId);
    }

    //分頁設定
    const rawPage = req.query.page; //當前頁數
    const page = rawPage === undefined ? 1 : parseInt(rawPage); //如果rawPage===undefined，page為1，否則為parseInt(rawPage)
    const limit = 9; //每頁最多顯示9堂課程
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }
    //取得當前分頁資料，以及分頁資訊
    const { paginatedData, pagination } = await paginate(filteredCoaches, page, limit);
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

//取得課程列表
async function getCourses(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["page", "sortBy", "skillId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    //排序設定
    const sort = "DESC"; //後端寫死
    const sortBy = req.query.sortBy || "popular"; //預設按照熱門程度排序
    const validSortBy = ["popular", "score"];
    if (!validSortBy.includes(sortBy))
      return next(generateError(400, `無此排序方式：${sortBy}，可用值為 popular 或 score`));
    //在撈資料前預先設定排序方式對應的參數
    const validSortParams = {
      popular: "c.numbers_of_view",
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
      .where("c.is_approved = :isApproved", { isApproved: true }) //只取得已審核的課程資料
      .orderBy(sortParam, "DESC") //根據前端參數，載入排序設定
      .getRawMany();

    //依照分類篩選課程資料
    let filteredCourses = rawCourses;
    const skillId = req.query.skillId;
    //若有回傳skillId,取得對應分類的資料
    if (skillId) {
      if (isNotValidUUID(skillId)) return next(generateError(400, "類別 ID 格式不正確"));
      // 確認 skillId 是否存在於資料庫
      const skill = await skillRepo.findOneBy({ id: skillId });
      if (!skill) {
        return next(generateError(404, "查無此課程類別"));
      }
      filteredCourses = await courseFilter(rawCourses, null, skillId);
    }
    //分頁設定
    const rawPage = req.query.page; //當前頁數
    const page = rawPage === undefined ? 1 : parseInt(rawPage); //如果rawPage===undefined，page為1，否則為parseInt(rawPage)
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

//取得你可能會喜歡課程列表(推薦網站前三筆熱門課程)
async function getRecommandCourses(req, res, next) {
  try {
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
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
      .where("c.is_approved = :isApproved", { isApproved: true }) //只取得已審核的課程資料
      .orderBy("c.numbers_of_view", "DESC") //按照課程觀看人次排序
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
    const coach = await coachRepo.findOneBy({ id: coachId });
    if (!coach) {
      return next(generateError(404, "查無此教練"));
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
      .andWhere("c.is_approved = :isApproved", { isApproved: true })
      .orderBy("c.numbers_of_view", "DESC") //按照課程觀看人次排序
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
      favorite_words: coach.favorite_words,
      motto: coach.motto,
      profile_image_url: coach.profile_image_url,
      background_image_url: coach.background_image_url,
      is_verified: coach.is_verified,
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
    //取得教練資訊
    const coachId = course.coach_id;
    const coach = await coachRepo.findOneBy({ id: coachId });
    if (!coach) return next(generateError(404, "查無此教練"));

    //取得章節資訊
    const { chapters, playbackId } = await getChapters(courseId);
    if (!chapters || chapters.length === 0) {
      return next(generateError(404, "查無章節"));
    }

    //製作播放url
    let baseOptions = {
      keyId: muxSigningKeyForPublic,
      keySecret: muxSigningKeySecretForPublic,
      expiration: "1h", //設定url 1小時有效
      start_time: 0,
      end_time: 300,
      params: {
        max_resolution: "1080p", //試看不求最高畫質?
      },
    };
    const token = await mux.jwt.signPlaybackId(playbackId, {
      ...baseOptions,
      type: "video",
    });

    //生成播放網址
    const streamURL = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;

    const data = {
      course: {
        id: course.id,
        name: course.name,
        score: course.score,
        numbers_of_view: course.numbers_of_view,
        hours: course.total_hours,
        image_url: course.image_url,
        trailer_url: streamURL,
        description: course.description,
      },
      coach: {
        id: coach.id,
        name: coach.nickname,
        title: coach.job_title,
        intro: coach.about_me,
        profile_image_url: coach.profile_image_url,
        coachPage_Url: `https://tteddhuang.github.io/sportify-plus/coaches/${coachId}`,
      },
      chapters: chapters,
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

//取得首頁的播放連結(專門用於非上課網頁的，故不用驗證)
const getHomepagePlayUrl = async (req, res, next) => {
  try {
    //輸入運動種類(從名稱取得id，名稱讓前端針對頁面寫死?)
    const { skill } = req.query;
    if (!skill) {
      return next(generateError(400, "運動種類為必填"));
    }

    // 從運動種類找最熱門課程的id;
    const course = await courseRepo
      .createQueryBuilder("c")
      .leftJoin("c.Skill", "s")
      .select("c.id AS course_id")
      .where("s.name = :name", { name: skill })
      .orderBy("c.numbers_of_view", "DESC")
      .getRawOne();

    if (!course) {
      return next(generateError(404, "查無該類別最熱門課程"));
    }

    //取得該課程的第一章第一節playbackId
    const subChapter = await chapterRepo.findOneBy({
      course_id: course.id,
      chapter_number: 1,
      sub_chapter_number: 1,
    });

    if (!subChapter) {
      return next(generateError(404, "無法取得該課程試看章節"));
    }

    //製作播放url
    let baseOptions = {
      keyId: muxSigningKeyForPublic,
      keySecret: muxSigningKeySecretForPublic,
      expiration: "6h", //設定url 6小時有效
      start_time: 0, //播放開始時間
      end_time: 30, //播放區段結束時間30秒
      params: {
        max_resolution: "1080p", //試看不求最高畫質?
      },
    };
    const token = await mux.jwt.signPlaybackId(subChapter.mux_playback_id, {
      ...baseOptions,
      type: "video",
    });

    //生成播放網址
    const streamURL = `https://stream.mux.com/${subChapter.mux_playback_id}.m3u8?token=${token}`;

    //用小節id取得播放影片
    res.status(200).json({
      status: true,
      message: "成功取得播放URL",
      data: streamURL,
    });
  } catch (error) {
    next(error);
  }
};

//取得課程-首頁搜索框
const getKeywordCourses = async (req, res, next) => {
  try {
    const { keyword } = req.query;
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["keyword"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    if (!keyword) {
      return next(generateError(400, "關鍵字為必填"));
    }
    if (typeof keyword !== "string") {
      return next(generateError(400, "關鍵字應為字串格式"));
    }
    //搜索順序，技能名稱>課程名稱>教練名稱
    const searchFields = ["s.name", "c.name", "coach.nickname"];
    let courses = [];
    let message = "成功取得關聯資料";
    // 依序搜尋各個欄位
    for (const field of searchFields) {
      courses = await courseRepo
        .createQueryBuilder("c")
        .innerJoin("c.Skill", "s")
        .innerJoin("c.Coach", "coach")
        .where(`LOWER(${field}) LIKE LOWER(:keyword)`, { keyword: `%${keyword}%` })
        .andWhere("c.is_approved = :isApproved", { isApproved: true })
        .select(fullCourseFields)
        .getRawMany();
      if (courses.length > 0) break; // 找到就停止
    }

    // 沒找到就推薦熱門課程
    if (courses.length === 0) {
      message = "查無關鍵字，改為推薦平台熱門課程，按照觀看人次排序";
      courses = await courseRepo
        .createQueryBuilder("c")
        .innerJoin("c.Skill", "s")
        .innerJoin("c.Coach", "coach")
        .select(fullCourseFields)
        .where("c.is_approved = :isApproved", { isApproved: true })
        .orderBy("c.numbers_of_view", "DESC")
        .getRawMany();
    }

    res.status(200).json({
      status: true,
      message,
      keyword: keyword,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourseType,
  getCoachType,
  getCourses,
  getCoaches,
  getRecommandCourses,
  getCoachCourses,
  getCoachDetails,
  getCourseDetails,
  getKeywordCourses,
  getHomepagePlayUrl,
};
