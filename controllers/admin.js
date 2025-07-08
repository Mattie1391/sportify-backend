const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const planRepo = AppDataSource.getRepository("Plan");
const coachRepo = AppDataSource.getRepository("Coach");
const subscriptionRepo = AppDataSource.getRepository("Subscription");
const userRepo = AppDataSource.getRepository("User");
const skillRepo = AppDataSource.getRepository("Skill");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
const coachLisenseRepo = AppDataSource.getRepository("Coach_License");
const paymentRepo = AppDataSource.getRepository("Payment_Transfer");
const { Mux } = require("@mux/mux-node");
const mux = new Mux();
const config = require("../config/index");
const { muxSigningKeyForPublic, muxSigningKeySecretForPublic } = config.get("mux");
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
  isNotValidUrl,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const paginate = require("../utils/paginate");
const { parseYYYYMMDD } = require("../utils/formatDate");
const { formatDate, addDays } = require("../utils/formatDate");
const { sendReviewEmail} = require("../utils/sendEmail");

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
      .leftJoin("c.Course", "course")
      .select([
        "c.id AS coach_id",
        "c.nickname AS coach_name",
        "c.job_title AS coach_title",
        "c.about_me AS coach_about_me",
        "c.is_verified AS coach_is_verified",
        "SUM(course.numbers_of_view) AS numbers_of_view",
      ])
      .groupBy("c.id")
      .addGroupBy("c.is_verified")
      .orderBy("numbers_of_view", sort)
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

//取得教練詳細資料
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
    const coachSkillData = await coachSkillRepo.find({
      where: { coach_id: coachId },
      relations: ["Skill"],
    });
    // 取得教練技能資料
    let coachSkills = [];
    if (coachSkillData.length > 0) {
      coachSkills = coachSkillData.map((cs) => ({
        name: cs.Skill.name,
      }));
    }
    // 整理教練個人資料
    const coachData = {
      id: coach.id,
      email: coach.email,
      nickname: coach.nickname,
      skills: coachSkills, //技能陣列
      profile_image_url: coach.profile_image_url,
      background_image_url: coach.background_image_url,
      job_title: coach.job_title,
      about_me: coach.about_me,
      hobby: coach.hobby,
      experience: coach.experience,
      favorite_words: coach.favorite_words,
      motto: coach.motto,
      is_verified: coach.is_verified,
      realname: coach.realname,
      id_number: coach.id_number,
      phone_number: coach.phone_number,
      birthday: coach.birthday,
      lisence: coach.lisence,
      bank_code: coach.bank_code,
      bank_account: coach.bank_account,
      bankbook_copy_url: coach.bankbook_copy_url,
      skill_description: coach.skill_description,
      experience_years: coach.experience_years,
      created_at: formatDate(coach.created_at),
      updated_at: formatDate(coach.updated_at),
    };
    // 取得教練證照檔案
    const coachLicenseData = await coachLisenseRepo.find({
      where: { coach_id: coachId },
    });
    let coachLicenses = [];
    if (coachLicenseData.length > 0) {
      coachLicenses = coachLicenseData.map((cl) => ({
        id: cl.id,
        name: cl.filename,
        file_public_id: cl.file_public_id,
        file_url: cl.file_url,
      }));
    }
    const coachCourseData = await courseRepo.find({
      where: { coach_id: coachId },
      relations: ["Skill"],
    });
    let coachCourses = [];
    if (coachCourseData.length > 0) {
      coachCourses = coachCourseData.map((cc) => ({
        course_type: cc.Skill.name,
        id: cc.id,
        name: cc.name,
        approved_at: cc.approved_at,
        is_approved: cc.is_approved,
      }));
    }
    // 取得教練匯款紀錄
    const coachPaymentData = await paymentRepo.find({
      where: { coach_id: coachId },
    });
    let coachPayments = [];
    if (coachPaymentData.length > 0) {
      coachPayments = coachPaymentData.map((cp) => ({
        id: cp.id,
        amount: cp.amount,
        transfer_at: cp.transfer_at,
        is_transfered: cp.is_transfered,
      }));
    }
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: {
        coachDetails: coachData,
        licenses: coachLicenses || [],
        payment_transfer: coachPayments || [],
        courses: coachCourses || [],
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
    const { status, review_comment: reviewComment } = req.body;
    const allowedStatus = ["approved", "rejected"];
    if (!status || !allowedStatus.includes(status)) {
      return next(generateError(400, "status 參數錯誤，必須為 approved 或 rejected"));
    }
    //審核建議在通過時為選填，但若審核未通過則為必填
    if (status === "rejected" && !reviewComment) {
      return next(generateError(400, "若審核未通過，請填寫建議"));
    }
    if (reviewComment && reviewComment.length > 200) {
      return next(generateError(400, "審核建議限制字數為200字"));
    }

    //取得課程資料
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }
    //更新課程審核狀態
    course.is_approved = status === "approved";
    course.review_comment = reviewComment;
    if (status === "approved") {
      course.approved_at = new Date(); // 只有審核通過才更新 approved_at
    } else {
      course.approved_at = null;
    }

    await courseRepo.save(course);

    //取得課程對應的教練資料
    const coach = await coachRepo.findOneBy({ id: course.coach_id });

    //回傳訊息
    if (status === "approved") {
      sendReviewEmail(
        coach.email,
        "Sportify+ 課程審核通過通知",
        `恭喜！您的課程 "${course.name}" 已通過審核`,
        reviewComment
      );
      return res.status(200).json({
        status: true,
        message: "課程審核成功，狀態已更新為 approved",
      });
    } else {
      sendReviewEmail(
        coach.email,
        "Sportify+ 課程審核未通過通知",
        `很抱歉！您的課程 "${course.name}" 未通過審核`,
        reviewComment
      );
      return res.status(200).json({
        status: true,
        message: "課程審核未通過，狀態已更新為 rejected",
      });
    }
  } catch (error) {
    next(error);
  }
}

//審核教練資格
async function patchReviewCoach(req, res, next) {
  try {
    // 取得 route param coachId 並驗證
    const { coachId } = req.params;
    if (!coachId || isNotValidUUID(coachId)) {
      return next(generateError(400, "教練 ID 格式不正確"));
    }

    // 檢查 body 參數
    const { status, reviewComment } = req.body;
    const allowedStatus = ["approved", "rejected"];
    if (!status || !allowedStatus.includes(status)) {
      return next(generateError(400, "status 參數錯誤，必須為 approved 或 rejected"));
    }

    // 取得教練資料
    const coach = await coachRepo.findOne({ where: { id: coachId } });
    if (!coach) {
      return next(generateError(404, "查無此教練"));
    }

    // 更新教練審核狀態
    coach.is_verified = status === "approved";
    await coachRepo.save(coach);

    // 回傳訊息
    if (status === "approved") {
      sendReviewEmail(
        coach.email,
        "Sportify+ 教練資格審核通過通知",
        `恭喜！您的教練資格已通過審核`,
        reviewComment
      );
      return res.status(200).json({
        status: true,
        message: "教練資格審核成功，狀態已更新為 approved",
      });
    } else {
      sendReviewEmail(
        coach.email,
        "Sportify+ 教練資格審核未通過通知",
        `很抱歉！您的教練資格未通過審核`,
        reviewComment
      );
      return res.status(200).json({
        status: true,
        message: "教練資格審核未通過，狀態已更新為 rejected",
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

//取得課程詳細資訊
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
    if (!coach) {
      return next(generateError(404, "查無此教練"));
    }
    //取得章節資訊
    const chapters = await chapterRepo.find({
      where: { course_id: courseId },
      order: {
        chapter_number: "ASC", //先按照主標題排序
        sub_chapter_number: "ASC", //按照副標題排序
      },
    });
    let formattedChapters = [];
    let trailer_url = null;
    if (chapters && chapters.length !== 0) {
      formattedChapters = await Promise.all(
        chapters.map(async (chapter) => {
          const playbackId = chapter.mux_playback_id;
          //製作播放url
          let baseOptions = {
            keyId: muxSigningKeyForPublic,
            keySecret: muxSigningKeySecretForPublic,
            expiration: "2h", //設定url 2小時有效
            start_time: 0,
            end_time: 7200,
            params: {
              max_resolution: "2160p", //設定最大解析度
            },
          };
          const token = await mux.jwt.signPlaybackId(playbackId, {
            ...baseOptions,
            type: "video",
          });

          //生成播放網址
          const streamURL = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
          return {
            id: chapter.id,
            title: chapter.title,
            subtitle: chapter.subtitle,
            video_url: streamURL, // 使用生成的播放網址
            duration: chapter.duration,
            uploaded_at: formatDate(chapter.uploaded_at),
          };
        })
      );
      trailer_url = formattedChapters[0].video_url; //預告片為第一個影片
    }

    const data = {
      course: {
        id: course.id,
        name: course.name,
        score: course.score,
        numbers_of_view: course.numbers_of_view,
        hours: course.total_hours,
        trailer_url: trailer_url,
        image_url: course.image_url,
        description: course.description,
        review_comment: course.review_comment,
      },
      coach: {
        id: coach.id,
        name: coach.nickname,
        title: coach.job_title,
        intro: coach.about_me,
        profile_image_url: coach.profile_image_url,
        coachPage_Url: `https://tteddhuang.github.io/sportify-plus/coaches/${coachId}`,
      },
      chapters: formattedChapters,
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

//取得後台數據分析
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

//取得使用者列表
async function getUsers(req, res, next) {
  try {
    // 僅允許特定 query 參數
    const validQuerys = ["page", "userId", "subscriptionPlan"];
    const queryKeys = Object.keys(req.query);
    const invalidQuerys = queryKeys.filter((key) => !validQuerys.includes(key));
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }

    // 取得所有使用者資料與訂閱資料
    const rawUsers = await userRepo
      .createQueryBuilder("u")
      .leftJoinAndSelect("u.Subscription", "s", "s.id = u.subscription_id") // 關聯到最新訂閱
      .leftJoin("s.Plan", "p")
      .leftJoin("s.Subscription_Skills", "ss")
      .leftJoin("ss.Skill", "sk")
      .select([
        "u.id AS id",
        "u.name AS name",
        "u.email AS email",
        "u.profile_image_url AS profile_image_url",
        "p.name AS plan",
        "s.start_at AS start_at",
        "s.end_at AS end_at",
        "s.purchased_at AS purchased_at",
        "u.created_at AS created_at",
        "s.is_renewal AS is_renewal", // 是否開啟續訂
      ])
      .addSelect("ARRAY_AGG(sk.name)", "skills")
      .groupBy("u.id, p.name, s.start_at, s.end_at, s.purchased_at, u.created_at, s.is_renewal")
      .getRawMany();

    // 篩選 userId
    let filteredUsers = rawUsers;
    if (req.query.userId) {
      const userId = req.query.userId;
      if (isNotValidUUID(userId)) {
        return next(generateError(400, "userId 格式不正確"));
      }
      filteredUsers = filteredUsers.filter((user) => user.id === userId);
    }

    // 篩選訂閱方案
    if (req.query.subscriptionPlan) {
      const planName = req.query.subscriptionPlan;
      const matchedPlan = await planRepo.findOneBy({ name: planName });
      if (!matchedPlan) {
        return next(generateError(400, "查無此訂閱方案"));
      }
      filteredUsers = filteredUsers.filter((user) => user.plan === planName);
    }

    // 若沒有符合的使用者
    if (filteredUsers.length === 0) {
      return next(generateError(400, "查無此會員"));
    }

    // 分頁處理
    const rawPage = req.query.page;
    const page = rawPage === undefined ? 1 : parseInt(rawPage);
    const limit = 20;
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }

    const { paginatedData, pagination } = await paginate(filteredUsers, page, limit);
    const totalPages = pagination.total_pages;
    if (page > totalPages && totalPages !== 0) {
      return next(generateError(400, "頁數超出範圍"));
    }

    // 格式化回傳資料
    const data = paginatedData.map((user) => {
      const hasStart = user.start_at !== null;
      const hasEnd = user.end_at !== null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_image_url: user.profile_image_url,
        plan: user.plan,
        course_type: user.skills?.filter(Boolean) || [],
        createdAt: formatDate(user.created_at),
        period:
          hasStart && hasEnd ? `${formatDate(user.start_at)} - ${formatDate(user.end_at)}` : null,
        end_at: hasEnd ? formatDate(user.end_at) : null,
        next_payment: user.is_renewal && hasEnd ? formatDate(addDays(user.end_at, 1)) : null,
      };
    });

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data,
      pagination,
    });
  } catch (error) {
    next(generateError(500, "無法取得會員資料"));
  }
}

module.exports = {
  postPlan,
  postSportsType,
  getCoaches,
  getCoachDetails,
  patchReviewCourse,
  getCourses,
  getCourseDetails,
  getCoachTypes,
  getCourseTypes,
  getDataAnalysis,
  getUsers,
  patchReviewCoach,
};
