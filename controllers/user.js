const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;
const logger = require("pino")({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});
const { MoreThan, Like, In } = require("typeorm");
//repo
const AppDataSource = require("../db/data-source");
const userRepo = AppDataSource.getRepository("User");
const coachRepo = AppDataSource.getRepository("Coach");
const courseRepo = AppDataSource.getRepository("Course");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");
const favoriteRepo = AppDataSource.getRepository("User_Course_Favorite");
const subscriptionRepo = AppDataSource.getRepository("Subscription");
const videoRepo = AppDataSource.getRepository("Course_Video");
//services
const {
  getLatestSubscription,
  checkActiveSubscription,
  checkCourseAccess,
  checkSkillAccess,
} = require("../services/checkServices");
const { getViewableCourseTypes } = require("../services/typeServices");
const { courseFilter } = require("../services/filterServices");
const { fullCourseFields } = require("../services/courseSelectFields");
const { getChapters } = require("../services/chapterServices");
const { checkValidQuerys } = require("../services/queryServices");
//utils
const {
  isUndefined,
  isNotValidString,
  isNotValidArray,
  isNotValidUUID,
  isNotValidUrl,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const paginate = require("../utils/paginate");
const { formatDate, formatYYYYMMDD } = require("../utils/formatDate"); // 引入日期格式化工具函數
const generateOrderNumber = require("../utils/generateOrderNumber"); // 引入生成訂單編號的工具函數

//取得使用者資料
async function getProfile(req, res, next) {
  try {
    const userId = req.params.userId;
    if (!userId || isNotValidString(userId) || userId.length === 0 || isNotValidUUID(userId)) {
      return next(generateError(400, "使用者 ID 格式不正確"));
    }
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      return next(generateError(404, "使用者不存在"));
    }

    //檢查頭貼網址是否正確，不正確則設為null
    if (
      !user.profile_image_url ||
      typeof user.profile_image_url !== "string" ||
      isNotValidUrl(user.profile_image_url)
    ) {
      user.profile_image_url = null;
    }
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      profile_image_url: user.profile_image_url,
    };
    res.status(200).json({ status: true, message: "成功取得資料", data: userData });
  } catch (error) {
    next(error);
  }
}

//取得所有訂閱方案類別
async function getPlans(req, res, next) {
  try {
    const plans = await AppDataSource.getRepository("Plan").find({
      where: { pricing: MoreThan(0) },
    });
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: plans,
    });
  } catch (error) {
    next(error);
  }
}

//取得所有運動類別
async function getAllCourseType(req, res, next) {
  try {
    const outdoor = await AppDataSource.getRepository("Skill").find({
      select: ["id", "name"],
      where: { activity_location_type: "室外運動" },
    });
    const indoor = await AppDataSource.getRepository("Skill").find({
      select: ["id", "name"],
      where: { activity_location_type: "室內運動" },
    });
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: { indoor, outdoor },
    });
  } catch (error) {
    next(error);
  }
}

//修改使用者資料
async function patchProfile(req, res, next) {
  try {
    const userId = req.params.userId;
    if (!userId || isNotValidString(userId) || userId.length === 0 || isNotValidUUID(userId))
      return next(generateError(400, "使用者 ID 格式不正確"));

    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return next(generateError(400, "使用者不存在"));

    // email及使用者ID無法修改,前端email欄位同步寫死，不能輸入
    const {
      name,
      profile_image_url,
      profile_image_public_id,
      oldPassword,
      newPassword,
      newPassword_check,
    } = req.body;

    //目前暫無email驗證功能，禁止修改email
    if ("email" in req.body) {
      return next(generateError(403, "禁止修改 email"));
    }

    //？.trim
    // 若值為字串，就回傳去掉前後空白的結果，空字串""就會回傳false
    // 若值為null或undefined,就不執行trim()，直接回傳undefined（false）

    // 檢查 name 是否有效（非空字串）
    const nameValidCheck = Boolean(name?.trim()); //name合格會回傳true
    let changeNameCheck = false;
    if (nameValidCheck) {
      changeNameCheck = name.trim() !== user.name; //name變更會回傳true
    }

    // 檢查頭像圖片網址是否有效（非空字串）
    const profileValidCheck = Boolean(profile_image_url?.trim()); //url合格會回傳true
    let changeProfileCheck = false;
    if (profileValidCheck) {
      changeProfileCheck = profile_image_url.trim() !== user.profile_image_url; //url變更會回傳true
    }

    //檢查 public_id是否有效（非空字串）
    const publicIdValidCheck = Boolean(profile_image_public_id?.trim());

    // 若使用者想修改 name，檢查是否符合填寫規則
    if (nameValidCheck && changeNameCheck) {
      if (isNotValidString(name)) {
        return next(generateError(400, "欄位未填寫正確"));
      }
      if (name.length < 2 || name.length > 20) {
        return next(generateError(400, "用戶名長度需為 2~20 字"));
      }
    }

    // 若使用者想修改大頭貼，檢查是否符合規則
    if (profileValidCheck && changeProfileCheck) {
      if (isNotValidUrl(profile_image_url)) {
        return next(generateError(400, "頭貼網址格式不正確"));
      }
      // 如果有新圖片URL，必須要有對應的 public_id
      if (!publicIdValidCheck) {
        return next(generateError(400, "更新頭像時必須提供有效的 public_id"));
      }
      // 檢查 public_id 格式（應該包含 user-avatars/ 前綴）
      const trimmedPublicId = profile_image_public_id.trim();
      if (!trimmedPublicId.startsWith("user-avatars/")) {
        return next(generateError(400, "public_id 格式不正確"));
      }
    }

    // 若使用者想修改密碼，必須三個欄位都填寫
    const hasAnyPasswordField = Boolean(
      oldPassword?.trim() || newPassword?.trim() || newPassword_check?.trim()
    );

    const hasAllPasswordFields = Boolean(
      oldPassword?.trim() && newPassword?.trim() && newPassword_check?.trim()
    );

    //如果有修改任一密碼欄位，但並沒有完全填寫全部密碼欄位
    if (hasAnyPasswordField && !hasAllPasswordFields) {
      return next(generateError(400, "請完整填寫密碼欄位"));
    }

    //如果全部密碼欄位都有填寫，檢查填寫是否符合規範
    if (hasAllPasswordFields) {
      // 密碼規則：至少8個字元，最多16個字元，至少一個數字，一個小寫字母和一個大寫字母，不允許空白字元
      const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[^\s]{8,16}$/;
      if (!passwordPattern.test(newPassword)) {
        return next(
          generateError(
            400,
            "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字，不允許空白字元"
          )
        );
      }
      if (newPassword === oldPassword) {
        return next(generateError(409, "新密碼不可與舊密碼相同"));
      }
      if (newPassword !== newPassword_check) {
        return next(generateError(400, "密碼確認錯誤"));
      }

      //檢查舊密碼是否正確 (使用 bcrypt.compare比對加密後的密碼)
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return next(generateError(400, "舊密碼錯誤"));
      }
    }

    // 最後判斷資料是否完全沒有變更過
    // name/profile欄位都符合（欄位沒有填寫 或 欄位內容一樣）且 三個密碼欄位都完全沒有填寫
    if (
      (!nameValidCheck || !changeNameCheck) &&
      (!profileValidCheck || !changeProfileCheck) &&
      !hasAnyPasswordField
    ) {
      return next(generateError(400, "無資料需變更，請輸入欲修改的內容"));
    }
    // 在更新資料庫前，先準備刪除舊圖片
    let oldImagePublicId = null;
    if (
      profileValidCheck &&
      changeProfileCheck &&
      user.profile_image_url &&
      user.profile_image_public_id
    ) {
      oldImagePublicId = user.profile_image_public_id || null;
    }

    //修改變更的資料
    if (nameValidCheck && changeNameCheck) {
      user.name = name.trim();
    }
    if (profileValidCheck && changeProfileCheck) {
      user.profile_image_url = profile_image_url.trim();
      user.profile_image_public_id = profile_image_public_id.trim();
    }
    if (hasAllPasswordFields) {
      user.password = await bcrypt.hash(newPassword, 10);
    }
    await userRepo.save(user);

    //資料庫更新成功後，在cloudinary刪除舊圖片
    if (oldImagePublicId && oldImagePublicId !== profile_image_public_id?.trim()) {
      try {
        const deleteResult = await cloudinary.uploader.destroy(oldImagePublicId);
        if (deleteResult.result === "ok") {
          logger.info(`舊圖片刪除成功: ${deleteResult.result} (${oldImagePublicId})`);
        } else {
          logger.warn(`舊圖片刪除異常: ${deleteResult.result} (${oldImagePublicId})`);
        }
      } catch (error) {
        logger.error(`舊圖片刪除失敗，請手動處理:${error}, public_id: ${oldImagePublicId}`);
      }
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      profile_image_url: user.profile_image_url,
      profile_image_public_id: user.profile_image_public_id,
      updated_at: user.updated_at,
    };
    res.status(200).json({ status: true, message: "成功更新資料", data: userData });
  } catch (error) {
    next(error);
  }
}

//收藏課程
async function postLike(req, res, next) {
  try {
    const userId = req.params.userId;
    const courseId = req.params.courseId;
    if (isNotValidUUID(userId)) {
      return next(generateError(400, "使用者 ID 格式不正確"));
    }
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }
    //判斷訂閱是否有效
    const hasActiveSubscription = req.user.hasActiveSubscription;
    if (!hasActiveSubscription) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }
    //若訂閱有效，判斷此人是否可觀看此類別
    const canWatchType = await checkCourseAccess(userId, courseId);
    if (!canWatchType) throw generateError(403, "未訂閱該課程類別");

    // 確認是否已收藏過此課程
    const exist = await favoriteRepo.findOneBy({
      user_id: userId,
      course_id: courseId,
    });
    if (exist) return next(generateError(409, "已收藏過此課程"));

    // 新增收藏紀錄到資料庫
    const newFavorite = favoriteRepo.create({
      user_id: userId,
      course_id: courseId,
    });
    await favoriteRepo.save(newFavorite);
    res.status(201).json({
      status: true,
      message: "收藏成功",
    });
  } catch (error) {
    next(error);
  }
}

//取消收藏課程
async function deleteUnlike(req, res, next) {
  try {
    const userId = req.params.userId;
    const courseId = req.params.courseId;
    if (isNotValidUUID(userId)) {
      return next(generateError(400, "使用者 ID 格式不正確"));
    }
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }
    //判斷訂閱是否有效
    const hasActiveSubscription = req.user.hasActiveSubscription;
    if (!hasActiveSubscription) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }
    //若訂閱有效，判斷此人是否可觀看此類別
    const canWatchType = await checkCourseAccess(userId, courseId);
    if (!canWatchType) throw generateError(403, "未訂閱該課程類別");
    // 確認是否已收藏過此課程
    const exist = await favoriteRepo.findOneBy({
      user_id: userId,
      course_id: courseId,
    });
    if (!exist) return next(generateError(409, "尚未收藏此課程"));
    // 刪除收藏紀錄
    await favoriteRepo.delete(exist);
    //TODO: 204只會回傳狀態碼，沒有資料，討論是否要改成200就好。
    res.status(204).json({ status: true, message: "取消收藏成功" });
  } catch (error) {
    next(error);
  }
}

//取得可觀看的課程類別
async function getCourseType(req, res, next) {
  try {
    const userId = req.user.id;
    const hasActiveSubscription = req.user.hasActiveSubscription;
    //判斷訂閱是否有效
    if (!hasActiveSubscription) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }
    //取得此人可觀看的類別id、名稱、該類別學生總人數以及是否為eagerness
    const { isEagerness, result } = await getViewableCourseTypes(userId);
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      isEagerness: isEagerness,
      data: result,
      meta: {
        sort: "desc",
        sort_by: "popular",
      },
    });
  } catch (error) {
    next(error);
  }
}

//取得可觀看的課程
async function getCourses(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["page", "category", "skillId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    const userId = req.user.id;
    //判斷訂閱是否有效
    const hasActiveSubscription = req.user.hasActiveSubscription;
    if (!hasActiveSubscription) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }

    //取得所有可觀看類別ID陣列
    const { typeIds } = await getViewableCourseTypes(userId);

    //取得可觀看課程資料
    const rawCourses = await AppDataSource.getRepository("Course")
      .createQueryBuilder("c")
      .innerJoin("c.Skill", "s")
      .innerJoin("c.Coach", "coach")
      .where("s.id IN (:...ids)", { ids: typeIds }) //取出skill_id包含在可觀看類別id的課程
      .select(fullCourseFields)
      .orderBy("c.student_amount", "DESC")
      .getRawMany();

    //取得已收藏的課程ID陣列
    const favoritedCourses = await favoriteRepo.find({
      where: { user_id: userId },
      select: ["course_id"],
    });
    const favoritedCourseIds = favoritedCourses.map((f) => f.course_id);
    //在資料中加入 isFavorited 欄位
    const courses = rawCourses.map((course) => ({
      ...course,
      isFavorited: favoritedCourseIds.includes(course.course_id),
    }));

    //分類設定
    const category = req.query.category || "all"; //當前顯示類別，預設顯示所有類別
    const validCategories = ["all", "favorite", "skill"]; //所有類別、已收藏、特定類別（如：瑜伽）
    if (!validCategories.includes(category)) return next(generateError(400, "無此類別"));
    //依照分類篩選課程資料
    let filteredCourses;
    if (category === "all") {
      if (req.query.skillId) {
        return next(generateError(400, "當類別為 all 時，請勿帶入skillId"));
      }
    }
    if (category === "skill") {
      const skillId = req.query.skillId; //若category="skill"，前端再回傳一個參數skillId
      const canWatch = await checkSkillAccess(userId, skillId);
      if (!canWatch) throw generateError(403, "未訂閱該課程類別");
      if (!skillId || isNotValidUUID(skillId))
        return next(generateError(400, "類別為 skill 時必須提供合法的 skillId"));
      //取得對應分類的資料
      filteredCourses = await courseFilter(courses, category, skillId);
    } else {
      //取得對應分類的資料
      filteredCourses = await courseFilter(courses, category);
    }

    //分頁設定
    const rawPage = req.query.page; //當前頁數
    const page = rawPage === undefined ? 1 : parseInt(rawPage); //如果rawPage===undefined，page為1，否則為parseInt(rawPage)
    const limit = 8; //每頁最多顯示9堂課程
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
          category: category, //篩選類別
          sort: "desc", //後端寫死
          sort_by: "popular", //依照學生人數排序，後端寫死
        },
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

//新增訂閱紀錄
async function postSubscription(req, res, next) {
  try {
    const userId = req.user.id; // 從驗證中獲取使用者 ID

    //檢查是否訂閱中
    const validSubscription = await subscriptionRepo.findOne({
      where: { user_id: userId, is_renewal: true },
    });
    if (validSubscription) {
      return next(generateError(400, "已存在有效的訂閱紀錄，請先取消訂閱"));
    }

    //檢查是否存在尚未到期的訂閱紀錄(上面已檢查過is_renewal，所以這邊如果有撈到資料代表訂閱已取消但尚未到期)
    let availableCanceledSubscription;
    if (checkActiveSubscription(userId)) {
      availableCanceledSubscription = await getLatestSubscription(userId);
    }

    const { subscription_name, course_type } = req.body;

    if (
      isUndefined(subscription_name) ||
      isNotValidString(subscription_name) ||
      isUndefined(course_type) ||
      isNotValidArray(course_type)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }

    // 從 Plan 表中動態撈取所有有效的 plan_name
    const planRepo = AppDataSource.getRepository("Plan");
    const plans = await planRepo.find();

    // 確保 plans 不為空
    if (!plans || plans.length === 0) {
      return next(generateError(400, "未找到任何訂閱方案"));
    }

    // 從 plans 中找到符合的訂閱方案
    const plan = plans.find((p) => p.name === subscription_name);
    if (!plan) {
      return next(generateError(400, "訂閱方案不存在"));
    }

    // 驗證 course_type 是否為字串陣列，且數量為 0、1 或 3
    if (!(course_type.length === 0 || course_type.length === 1 || course_type.length === 3)) {
      return next(generateError(400, "課程類別格式不正確"));
    }

    if (Number(plan.sports_choice) !== course_type.length) {
      return next(
        generateError(
          400,
          `課程類別數量不符合方案限制，方案要求 ${plan.sports_choice} 個課程，但提供了 ${course_type.length} 個`
        )
      );
    }
    // 初始化 validSkills 為空陣列
    let validSkills = [];

    // 如果 course_type 非空，執行技能的驗證邏輯
    if (course_type.length > 0) {
      // 驗證 course_type 中的技能是否存在於資料庫
      const skillRepo = AppDataSource.getRepository("Skill");
      validSkills = await skillRepo
        .createQueryBuilder("skill")
        .where("skill.name IN (:...names)", { names: course_type })
        .getMany();

      if (validSkills.length !== course_type.length) {
        return next(generateError(400, "部分課程類別不存在"));
      }
    }

    // 建立訂單編號（假設格式為：年份月份日+遞增數字）
    // 從subscriptionRepo中取得今天購買的所有order_number並找出最大的數字
    // 今天的日期字串 YYYYMMDD
    const today = new Date();
    const todayStr = formatYYYYMMDD(today);
    // 從資料庫撈出今天的訂單（order_number 開頭是今天的日期），照 order_number 做遞減排序，取最大值
    const todayMaxOrder = await subscriptionRepo.findOne({
      where: { order_number: Like(`${todayStr}%`) }, // 前 8 碼為今天日期
      order: { order_number: "DESC" }, // 照字串遞減排序（越大的越前面）
      take: 1, // 只取最新的一筆
    });
    // 若有訂單，就用該最大訂單號；否則給預設值
    const startingOrderNumber = todayMaxOrder?.order_number || todayStr + "0000";

    // 產生新的訂單號
    const orderNumber = generateOrderNumber(startingOrderNumber);

    // 建立訂閱資料
    const newSubscription = subscriptionRepo.create({
      user_id: userId,
      order_number: orderNumber,
      plan_id: plan.id,
      price: plan.pricing,
      is_paid: false,
    });

    // 儲存訂閱紀錄
    const savedSubscription = await subscriptionRepo.save(newSubscription);
    if (!savedSubscription) {
      return next(generateError(400, "更新資料失敗"));
    }

    // 成功儲存訂閱紀錄後，如果有未到期的已取消訂閱紀錄，將其到期日設為當前時間，強制結束
    if (availableCanceledSubscription) {
      availableCanceledSubscription.end_at = new Date();
      await subscriptionRepo.save(availableCanceledSubscription);
    }

    // 建立與技能的關聯
    if (validSkills.length > 0) {
      const subscriptionSkillRepo = AppDataSource.getRepository("Subscription_Skill");
      const newSubscriptionSkills = validSkills.map((skill) => {
        return subscriptionSkillRepo.create({
          subscription_id: savedSubscription.id,
          skill_id: skill.id,
        });
      });

      // 儲存技能關聯
      await subscriptionSkillRepo.save(newSubscriptionSkills);
    }

    // 更新 User 資料表的 subscription_id 和 is_subscribed 欄位
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      return next(generateError(400, "使用者不存在"));
    }

    user.subscription_id = savedSubscription.id; // 設定訂閱 ID

    // 儲存更新後的使用者資料
    await userRepo.save(user);

    // 回傳成功訊息
    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: {
        subscription: {
          id: savedSubscription.id,
          user_id: savedSubscription.user_id,
          plan: subscription_name,
          course_type: course_type,
          order_number: savedSubscription.order_number,
          price: savedSubscription.price,
          is_paid: savedSubscription.is_paid,
          created_at: formatDate(savedSubscription.created_at),
          updated_at: formatDate(savedSubscription.updated_at),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

//取消訂閱方案
//TODO:金流端先取消成功，平台資料庫才會修改訂閱紀錄，待討論是否直接跟postCancelConfirm API合併
async function patchSubscription(req, res, next) {
  try {
    const userId = req.user.id; // 從驗證中獲取使用者 ID

    // 確認使用者是否存在
    const user = await userRepo.findOneBy({ id: userId });

    // 確認使用者是否有訂閱方案
    if (!user.subscription_id) {
      return next(generateError(400, "找不到訂閱資料或已取消"));
    }

    // 更新使用者資料：清空 subscription_id
    user.subscription_id = null;

    // 儲存更新後的使用者資料
    const updatedUser = await userRepo.save(user);
    if (!updatedUser) {
      return next(generateError(400, "資料刪除失敗"));
    }

    // 回傳成功訊息
    res.status(200).json({
      status: true,
      message: "訂閱已成功取消",
    });
  } catch (error) {
    next(error);
  }
}

//取得訂閱紀錄
async function getSubscriptions(req, res, next) {
  try {
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["page"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }

    //分頁設定
    const rawPage = req.query.page; //當前頁數
    const page = rawPage === undefined ? 1 : parseInt(rawPage); //如果rawPage===undefined，page為1，否則為parseInt(rawPage)
    const limit = 20;
    const skip = (page - 1) * limit; // 要跳過的資料筆數

    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }

    //取得排序後的資料
    const userId = req.user.id;
    const [subscriptions, total] = await subscriptionRepo.findAndCount({
      where: { user_id: userId },
      order: { order_number: "DESC" },
      relations: ["Plan"],
      skip: skip, // 要跳過的資料筆數
      take: limit, // 取得的資料筆數
    });

    // 計算總頁數
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages) {
      return next(generateError(400, "頁數超出範圍"));
    }

    //若查無訂閱紀錄
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        status: true,
        message: "尚未訂閱，暫無訂閱紀錄",
      });
    }

    //扣款日期為訂閱結束日順延一日
    function addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }

    //取出回傳資料
    const data = subscriptions.map((s) => {
      // 格式化日期（若尚未付款，不會產生以下時間參數，值為null）
      const purchasedAt = s.purchased_at ? formatDate(s.purchased_at) : null;
      const startAt = s.start_at ? formatDate(s.start_at) : null;
      const endAt = s.end_at ? formatDate(s.end_at) : null;
      return {
        id: s.id,
        order_number: s.order_number, //訂單編號
        plan: s.Plan.name, //方案名稱
        price: s.price, //價格
        purchased_at: purchasedAt, //購買日期
        end_at: endAt, //訂閱到期時間
        period: `${startAt} - ${endAt}`, //訂閱期間
        payment_method: s.payment_method, //付款方式
        invoice_image_url: s.invoice_image_url, //發票網址
        is_paid: s.is_paid, //是否已付款
        is_renewal: s.is_renewal, //是否續訂
        next_payment: s.is_renewal && s.end_at ? formatDate(addDays(s.end_at, 1)) : null, //下次付款日期（若有開啟續訂）
        created_at: formatDate(s.created_at), //訂單創建時間
        updated_at: formatDate(s.updated_at), //訂單更新時間
      };
    });

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data,
      meta: {
        sort: "desc", //後端寫死，前端不可改
        sort_by: "time", //後端寫死，前端不可改
        page: page, //目前頁數
        limit: limit, //每頁顯示筆數
        total: total, //全部資料筆數
        total_pages: totalPages, //總共頁數
        has_next: page < totalPages, //是否有下一頁
        has_previous: page > 1, //是否有前一頁
      },
    });
  } catch (error) {
    next(error);
  }
}

//取得上課頁面詳細資訊
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
    //判斷訂閱是否有效
    const hasActiveSubscription = req.user.hasActiveSubscription;
    if (!hasActiveSubscription) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }
    //若訂閱有效，判斷此人是否可觀看此類別
    const userId = req.user.id;
    const canWatchType = await checkCourseAccess(userId, courseId);
    if (!canWatchType) throw generateError(403, "未訂閱該課程類別");
    //取得教練資訊
    const coachId = course.coach_id;
    const coach = await coachRepo.findOneBy({ id: coachId });
    if (!coach) return next(generateError(404, "查無此教練"));
    // 禁止前端亂輸入參數，如 banana=999
    const invalidQuerys = checkValidQuerys(req.query, ["chapterId"]);
    if (invalidQuerys.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
    }
    //取得章節資訊
    const { chapters, firstChapterId } = await getChapters(courseId);
    if (!chapters || chapters.length === 0) {
      return next(generateError(404, "查無章節"));
    }
    //若未回傳參數chapterId，則預設顯示第一個章節的第一小節標題
    let chapterId = req.query.chapterId || firstChapterId;
    if (isNotValidUUID(chapterId)) {
      return next(generateError(400, "章節 ID 格式不正確"));
    }
    const currentChapter = await courseChapterRepo.findOneBy({ id: chapterId });
    if (!currentChapter) {
      return next(generateError(404, "查無此章節"));
    }
    //整理回傳資料
    const data = {
      course: {
        id: course.id,
        name: course.name,
        chapterId: currentChapter.id,
        chapterTitle: currentChapter.title,
        chapterSubtitle: currentChapter.subtitle,
        score: course.score,
        student_amount: course.student_amount,
        hours: course.total_hours,
        image_url: course.image_url,
        video_url: course.trailer_url, //TODO:待確認網址格式，所有課程的第一部影片皆需設為公開
        description: course.description,
      },
      coach: {
        id: coach.id,
        name: coach.nickname,
        title: coach.job_title,
        intro: coach.about_me,
        profile_image_url: coach.profile_image_url,
        coachPage_Url: `https://example.com/courses/coaches/${coachId}/details`, //TODO:待跟前端確認
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

//取得課程章節側邊欄資訊
async function getCourseChaptersSidebar(req, res, next) {
  try {
    const { courseId } = req.params;

    // 檢查是否有提供課程 ID
    if (!courseId) {
      return next(generateError(400, "請提供課程 ID"));
    }

    // 查詢課程資料
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(400, "查無此課程"));
    }

    // 查詢課程底下所有章節，依照章節與子章節順序排序
    const chapters = await courseChapterRepo.find({
      where: { course_id: courseId },
      order: {
        chapter_number: "ASC",
        sub_chapter_number: "ASC",
      },
    });

    // 這段程式碼將所有章節的影片資料依照章節 ID 分組
    // 每個章節會有一個 videos 屬性，內容為該章節所有影片組成的陣列

    // 取出所有章節 ID 用來查詢影片資料
    const chapterIds = chapters.map((c) => c.id);

    // 查詢所有屬於這些章節的影片
    const videos = await videoRepo.find({
    where: {
    chapter_subtitle_set_id: In(chapterIds),
    },
    });

    // 假設你已經有 chapters 跟 videos 兩個陣列
    // videos 陣列裡每個物件都有 chapter_subtitle_set_id（對應章節 id）與 duration（秒數）

    // 1. 建立一個以章節 ID 為 key，影片陣列為 value 的對照表
    const videoListMap = {};
    videos.forEach(video => {
      const key = video.chapter_subtitle_set_id;
      if (!videoListMap[key]) videoListMap[key] = [];
      videoListMap[key].push(video);
    });

    // 2. 依據 chapters 產生 fakeProgress，每個章節取得該章節所有影片
    //TODO:模擬章節觀看進度（未連接使用者資料，之後可整合 user_progress 資料）
    const fakeProgress = chapters.map((chapter, index) => {
      // 取得此章節所有影片的陣列
      const videoArr = videoListMap[chapter.id] || [];
      // 計算該章節所有影片的總時長（秒）
      const totalDuration = videoArr.reduce((sum, video) => sum + (video.duration || 0), 0);
      // 轉換成幾分幾秒的格式
      const lengthStr = videoArr.length
        ? `${Math.floor(totalDuration / 60)}分${Math.round(totalDuration % 60)}秒`
        : "未提供";
      // 回傳進度物件
      return {
        name: chapter.subtitle,
        length: lengthStr,
        isFinished: index < 2, // 假設前兩個已完成
        isCurrentWatching: index === 2, // 假設第三個正在觀看
      };
    });

    // 回傳符合格式的 JSON 結構
    return res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: {
        courseName: course.name,
        chapter: fakeProgress,
      },
    });
  } catch (error) {
    next(error);
  }
}




module.exports = {
  getProfile,
  getPlans,
  getAllCourseType,
  patchProfile,
  postLike,
  deleteUnlike,
  getCourseType,
  getCourses,
  postSubscription,
  patchSubscription,
  getSubscriptions,
  getCourseDetails,
  getCourseChaptersSidebar,
};
