const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const planRepo = AppDataSource.getRepository("Plan");
const coachRepo = AppDataSource.getRepository("Coach");
const subscriptionRepo = AppDataSource.getRepository("Subscription");
const userRepo = AppDataSource.getRepository("User");
const skillRepo = AppDataSource.getRepository("Skill");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
//services
const { getAllCourseTypes } = require("../services/typeServices");
const { courseFilter, coachFilter } = require("../services/filterServices");
const { checkValidQuerys } = require("../services/queryServices");
//utils
const {
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isNotValidUUID,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const paginate = require("../utils/paginate");
const { parseYYYYMMDD } = require("../utils/formatDate");

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

//取得類別（教練列表）
async function getCoachTypes(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["skillId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    // 若沒有回傳skillId
    let skillTypes = await getAllCourseTypes(); //預設取得所有技能類別（依照學生總人數排序）
    let skilledCoaches = []; //預設技能對應的教練列表為空陣列
    // 取得skillId並判斷是否為有效id
    const skillId = req.query.skillId;
    // 若有正確回傳skillId
    if (skillId) {
      if (isNotValidUUID(skillId)) return next(generateError(400, "類別 ID 格式不正確"));
      // 確認 skillId 是否存在於資料庫
      const skillId_exist = await skillRepo.findOneBy({ id: skillId });
      if (!skillId_exist) {
        return next(generateError(404, "查無此課程類別"));
      }
      // 取得對應分類的教練列表(id和nickname);
      skilledCoaches = await coachSkillRepo
        .createQueryBuilder("cs")
        .innerJoin("cs.Coach", "c")
        .where("cs.skill_id = :skillId", { skillId })
        .select(["c.id AS coach_id", "c.nickname AS coach_nickname"])
        .getRawMany();
    }
    // 回傳資料（技能類別和技能對應的教練列表）
    const data = {
      skillTypes,
      skilledCoaches,
    };
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: data,
      meta: {
        skillId: skillId || null, //回傳選擇的技能類別ID
        type: "coach", //顯示的是教練資料的篩選類別
      },
    });
  } catch (error) {
    next(error);
  }
}

//取得類別（課程列表）
async function getCourseTypes(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["skillId", "coachId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    // 若沒有回傳skillId
    let skillTypes = await getAllCourseTypes(); //預設取得所有技能類別（依照學生總人數排序）
    let skilledCoaches = []; //預設技能對應的教練列表為空陣列
    let allStatuses = []; //預設教練對應的課程狀態列表為空陣列

    // 取得skillId並判斷是否為有效id
    const skillId = req.query.skillId;
    const coachId = req.query.coachId;

    // 若有回傳skillId
    if (skillId) {
      if (isNotValidUUID(skillId)) return next(generateError(400, "類別 ID 格式不正確"));
      // 確認 skillId 是否存在於資料庫
      const skillId_exist = await skillRepo.findOneBy({ id: skillId });
      if (!skillId_exist) {
        return next(generateError(404, "查無此課程類別"));
      }
      // 取得對應分類的教練列表(id和nickname);
      skilledCoaches = await coachSkillRepo
        .createQueryBuilder("cs")
        .innerJoin("cs.Coach", "c")
        .where("cs.skill_id = :skillId", { skillId })
        .select(["c.id AS coach_id", "c.nickname AS coach_nickname"])
        .getRawMany();

      //若有回傳coachId
      if (coachId) {
        if (isNotValidUUID(coachId)) return next(generateError(400, "教練 ID 格式不正確"));
        // 確認 coachId 是否存在於資料庫
        const coachId_exist = await coachRepo.findOneBy({ id: coachId });
        if (!coachId_exist) {
          return next(generateError(404, "查無此教練"));
        }
        // 若coachId包含在對應skillId的教練資料中，則為合格的教練ID
        const isMatched = skilledCoaches.some((coach) => coach.coach_id === coachId);
        if (!isMatched) {
          return next(generateError(404, "該教練與選擇的技能類別不符"));
        }
        // 若有正確回傳coachId，取出該教練對應的課程資料
        const coachCourses = await courseRepo.findBy({ coach_id: coachId });
        // 取得所有課程的審核狀態，若課程已審核通過，則為上架中，否則為待審核
        allStatuses = coachCourses.map((c) => (c.is_approved ? "上架中" : "待審核"));
        // 移除重複的狀態
        allStatuses = [...new Set(allStatuses)];
      }
    }
    // 回傳資料（技能類別/技能對應的教練列表）
    const data = {
      skillTypes,
      skilledCoaches,
      allStatuses,
    };
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: data,
      meta: {
        skillId: skillId || null, //回傳選擇的技能類別ID
        coachId: coachId || null, //回傳選擇的教練ID
        type: "course", //顯示的是課程資料的篩選類別
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
        message: "課程審核成功，狀態已更新為 approved",
      });
    } else {
      return res.status(200).json({
        status: true,
        message: "課程審核未通過，狀態已更新為 rejected",
      });
    }
  } catch (error) {
    next(error);
  }
}

//取得課程列表
async function getCourses(req, res, next) {
  try {
    // 僅允許的查詢參數
    const validQuerys = ["page", "skillId", "coachId", "isApproved"];
    const queryKeys = Object.keys(req.query);
    const invalidQuerys = queryKeys.filter((key) => !validQuerys.includes(key));
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }

    // 參數依賴性檢查：先有 skillId 才能有 coachId，再來才能有 isApproved
    if (req.query.coachId && !req.query.skillId) {
      return next(generateError(400, "請先選擇技能類別"));
    }
    if (req.query.isApproved && (!req.query.skillId || !req.query.coachId)) {
      return next(generateError(400, "請先選擇技能類別與教練"));
    }

    // 取得全部課程資料，並關聯教練與技能名稱
    const rawCourses = await AppDataSource.getRepository("Course")
      .createQueryBuilder("course")
      .innerJoin("course.Coach", "coach")
      .innerJoin("course.Skill", "skill")
      .select([
        "course.id AS id",
        "course.name AS title",
        "skill.name AS category",
        "coach.nickname AS instructor",
        "course.created_at AS created_at",
        "course.is_approved AS is_active",
        "course.type_id AS type_id", // 用於過濾
        "course.coach_id AS coach_id", // 用於過濾
      ])
      .getRawMany();

    let filteredCourses = rawCourses;

    // skillId 篩選
    const skillId = req.query.skillId;
    if (skillId) {
      if (isNotValidUUID(skillId)) {
        return next(generateError(400, "類別 ID 格式不正確"));
      }
      const skill = await skillRepo.findOneBy({ id: skillId });
      if (!skill) {
        return next(generateError(400, "查無此課程類別"));
      }
      filteredCourses = await courseFilter(rawCourses, null, skillId);
    }

    // coachId 篩選
    const coachId = req.query.coachId;
    if (coachId) {
      if (isNotValidUUID(coachId)) {
        return next(generateError(400, "教練 ID 格式不正確"));
      }
      filteredCourses = filteredCourses.filter((course) => course.coach_id === coachId);
    }

    // isApproved 篩選
    if (req.query.isApproved) {
      const isApproved = req.query.isApproved === "true";
      filteredCourses = filteredCourses.filter((course) => course.is_active === isApproved);
    }

    // 若無資料，回傳錯誤
    if (filteredCourses.length === 0) {
      return next(generateError(400, "查無課程資料"));
    }

    // 分頁處理
    const rawPage = req.query.page;
    const page = rawPage === undefined ? 1 : parseInt(rawPage);
    const limit = 20;
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }

    const { paginatedData, pagination } = paginate(filteredCourses, page, limit);
    const totalPages = pagination.total_pages;
    if (page > totalPages && totalPages !== 0) {
      return next(generateError(400, "頁數超出範圍"));
    }

    // 整理回傳資料格式
    const formattedData = paginatedData.map((course) => ({
      id: course.id,
      title: course.title,
      category: course.category,
      instructor: course.instructor,
      created_at: course.created_at,
      is_active: course.is_active,
    }));

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: formattedData,
      pagination,
    });
  } catch (error) {
    next(generateError(400, error.message || "伺服器錯誤"));
  }
}

// 取得後台數據分析
async function getDataAnalysis(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    // 驗證查詢參數存在且為合法字串
    if (
      isUndefined(startDate) ||
      isUndefined(endDate) ||
      isNotValidString(startDate) ||
      isNotValidString(endDate)
    ) {
      return next(generateError(400, "請正確提供 startDate 和 endDate 查詢參數"));
    }

    // 將 YYYYMMDD 轉為 Date
    const start = parseYYYYMMDD(startDate);
    const end = parseYYYYMMDD(endDate);
    if (!start || !end || isNaN(start) || isNaN(end)) {
      return next(generateError(400, "日期格式錯誤，請使用 YYYYMMDD"));
    }

    const currentMonth = new Date();
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    // 查詢區間總收入
    const totalIncomeResult = await subscriptionRepo
      .createQueryBuilder("s") // 建立查詢，對 Subscription 表別名為 s
      .select("SUM(s.price)", "total") // 選取 s.price 的總和，命名為 total
      .where("s.created_at BETWEEN :start AND :end", { start, end }) // created_at 在 start 與 end 之間
      .getRawOne(); // 回傳格式為 { total: '金額' }

    // 查詢本月收入
    const currentMonthIncomeResult = await subscriptionRepo
      .createQueryBuilder("s")
      .select("SUM(s.price)", "total") // 聚合本月收入
      .where("s.created_at >= :currentMonthStart", { currentMonthStart }) // created_at 在本月初以後
      .getRawOne();

    // 查詢總會員數
    const totalMembers = await userRepo.count();

    // 查詢本月新增會員數
    const newMembersThisMonth = await userRepo
      .createQueryBuilder("u")
      .where("u.created_at >= :currentMonthStart", { currentMonthStart }) // created_at >= 本月第一天
      .getCount(); // 回傳符合條件的筆數

    // 查詢總教練數
    const totalCoaches = await coachRepo.count();

    // 查詢總課程數
    const totalCourses = await courseRepo.count();

    // 查詢各訂閱方案的訂閱數量
    const planCountsRaw = await subscriptionRepo
      .createQueryBuilder("s") // s 是 Subscription 表
      .select("p.name", "plan") // 取訂閱方案名稱
      .addSelect("COUNT(*)", "count") // 聚合該方案的訂閱筆數
      .innerJoin("s.Plan", "p") // 將 s.Plan 關聯到 Plan 表，p 是 Plan 的別名
      .groupBy("p.name") // 依照訂閱方案名稱分組
      .getRawMany(); // 回傳格式如：[{ plan: 'Fitness', count: '2' }, ...]
 
    // 建立初始方案統計物件
    const planCounts = {
      Wellness: 0,
      Fitness: 0,
      Eagerness: 0,
    };

    // 將查詢結果統整進 planCounts
    planCountsRaw.forEach((item) => {
      if (item.plan.includes("試用")) return; // 排除含「試用」的方案
    
      if (item.plan.includes("Eagerness")) {
        planCounts.Eagerness += parseInt(item.count);
      } else if (item.plan.includes("Fitness")) {
        planCounts.Fitness += parseInt(item.count);
      } else if (item.plan.includes("Wellness")) {
        planCounts.Wellness += parseInt(item.count);
      }
    });
    

    // 回傳統計資料
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: {
        totalIncome: parseInt(totalIncomeResult.total) || 0,
        currentMonthIncome: parseInt(currentMonthIncomeResult.total) || 0,
        totalMembers,
        newMembersThisMonth,
        totalCoaches,
        totalCourses,
        planCounts,
      },
    });
  } catch (error) {
    next(generateError(500, error.message || "伺服器錯誤"));
  }
}

module.exports = {
  postPlan,
  postSportsType,
  getCoaches,
  patchReviewCourse,
  getCourses,
  getCoachTypes,
  getCourseTypes,
  getDataAnalysis,
};
