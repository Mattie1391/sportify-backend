const AppDataSource = require("../db/data-source");
const planRepo = AppDataSource.getRepository("Plan");
const skillRepo = AppDataSource.getRepository("Skill");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
const generateError = require("../utils/generateError");
const {
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isNotValidUUID,
} = require("../utils/validators");
const { coachFilter } = require("../services/filterServices");
const paginate = require("../utils/paginate");

//新增訂閱方案，目前沒有畫管理員相應UI的線稿
async function postPlan(req, res, next) {
  try {
    const { name, intro, pricing, max_resolution, livestream, sports_choice } = req.body;
    if (
      isUndefined(name) ||
      isNotValidString(name) ||
      isUndefined(intro) ||
      isNotValidString(intro) ||
      isUndefined(pricing) ||
      isNotValidInteger(pricing) ||
      isUndefined(max_resolution) ||
      isNotValidInteger(max_resolution) ||
      isUndefined(livestream) ||
      typeof livestream !== "boolean" ||
      isUndefined(sports_choice) ||
      isNotValidInteger(sports_choice)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    const existingPlan = await planRepo.find({
      where: { name },
    });

    if (existingPlan.length > 0) {
      return next(generateError(409, "方案名稱不可重覆"));
    }
    const newPlan = await planRepo.create({
      name,
      intro,
      pricing,
      max_resolution,
      livestream,
      sports_choice,
    });
    const result = await planRepo.save(newPlan);
    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
//新增運動種類，目前沒有畫管理員相應UI的線稿
async function postSportsType(req, res, next) {
  try {
    const { name, activity_location_type } = req.body;
    if (
      isUndefined(name) ||
      isNotValidString(name) ||
      isUndefined(activity_location_type) ||
      isNotValidString(activity_location_type)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    const existingSports = await skillRepo.find({
      where: { name },
    });
    if (existingSports.length > 0) {
      return next(generateError(409, "運動種類不可重複"));
    }
    const newSportsType = skillRepo.create({
      name,
      activity_location_type,
    });
    const result = await skillRepo.save(newSportsType);
    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

//取得教練列表
async function getCoaches(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const validQuerys = ["page", "skillId", "coachId"];
    const queryKeys = Object.keys(req.query);
    const invalidQuerys = queryKeys.filter((key) => !validQuerys.includes(key));
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }

    // 先篩選skillId才能篩選coachId
    if (req.query.coachId && !req.query.skillId) {
      return next(generateError(400, "請先選擇技能類別"));
    }

    // 排序設定
    const sort = "DESC"; // 後端寫死
    const sortBy = "popular"; // 後端寫死

    // 取得教練資料
    const rawCoaches = await AppDataSource.getRepository("Coach")
      .createQueryBuilder("c")
      .innerJoin("c.Course", "course")
      .select([
        "c.id AS coach_id",
        "c.nickname AS coach_name",
        "c.job_title AS coach_title",
        "c.about_me AS coach_about_me",
        "SUM(course.student_amount) AS student_amount",
      ])
      .groupBy("c.id")
      .orderBy("student_amount", sort)
      .getRawMany();

    // 取得所有教練對應技能的資料
    const coachSkills = await coachSkillRepo.find({
      select: ["coach_id", "skill_id", "Skill.name"],
      relations: ["Skill"],
    });

    const coaches = rawCoaches.map((coach) => {
      const skills = coachSkills
        .filter((cs) => cs.coach_id === coach.coach_id)
        .map((cs) => ({
          skill_id: cs.skill_id,
          skill_name: cs.Skill.name,
        }));
      return {
        ...coach,
        coach_skills: skills,
      };
    });

    // 依照分類篩選課程資料
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

    // coachId 篩選
    if (req.query.coachId) {
      const coachId = req.query.coachId;
      if (isNotValidUUID(coachId)) return next(generateError(400, "coachId 格式不正確"));
      filteredCoaches = filteredCoaches.filter((coach) => coach.coach_id === coachId);
    }

    // 若沒有符合的教練，回傳 400
    if (filteredCoaches.length === 0) {
      return next(generateError(400, "查無此教練"));
    }
    // 分頁設定
    const rawPage = req.query.page;
    const page = rawPage === undefined ? 1 : parseInt(rawPage);
    const limit = 9;
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }

    const { paginatedData, pagination } = await paginate(filteredCoaches, page, limit);
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
          sort,
          sortBy,
          coachId: req.query.coachId || null,
        },
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

//審核課程是否上架
async function patchReviewCourse(req, res, next) {
  try {
    //取得 route param courseId 並驗證
    const { courseId } = req.params;
    if (!courseId || isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }

    //檢查 body 參數
    const { status, reviewComment } = req.body;
    const allowedStatus = ["approved", "rejected"];
    if (!status || !allowedStatus.includes(status)) {
      return next(generateError(400, "status 參數錯誤，必須為 approved 或 rejected"));
    }

    //取得課程資料
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }

    //更新課程審核狀態
    course.is_approved = status === "approved";
    if (status === "approved") {
      course.approved_at = new Date(); // 只有審核通過才更新 approved_at
    }

    await courseRepo.save(course);

    //回傳訊息
    if (status === "approved") {
      return res.status(200).json({
        status: true,
        message: "課程審核成功，狀態已更新為 approved"
      });
    } else {
      return res.status(200).json({
        status: true,
        message: "課程審核未通過，狀態已更新為 rejected"
      });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postPlan,
  postSportsType,
  getCoaches,
  patchReviewCourse,
};
