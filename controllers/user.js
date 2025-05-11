const AppDataSource = require("../db/data-source");
const userRepo = AppDataSource.getRepository("User");
const favoriteRepo = AppDataSource.getRepository("User_Course_Favorite");
const subscriptionRepo = require("../db/data-source").getRepository("Subscription");
const subscriptionSkillRepo = AppDataSource.getRepository("Subscription_Skill");
const {
  isUndefined,
  isNotValidString,
  isNotValidArray,
  isNotValidUUID,
  isNotValidUrl,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const {
  checkCategoryAccess,
  hasActiveSubscription,
  getLatestSubscription,
} = require("../services/checkServices");
const { getTypeByStudentCount } = require("../services/getTypeByStudentCount");
const formatDate = require("../utils/formatDate"); // 引入日期格式化工具函數
const bcrypt = require("bcryptjs");

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
    const plans = await AppDataSource.getRepository("Plan").find();
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

    // email及使用者ID無法修改,前端email欄位同步寫死，不能輸入
    const { name, profile_image_url, oldPassword, newPassword, newPassword_check } = req.body;

    //目前暫無email驗證功能，禁止修改email
    if ("email" in req.body) {
      return next(generateError(403, "禁止修改 email"));
    }

    //？.trim
    // 若值為字串，就回傳去掉前後空白的結果，空字串""就會回傳false
    // 若值為null或undefined,就不執行trim()，直接回傳undefined（false）

    //判斷機制提取
    const nameValidCheck = Boolean(name?.trim()); //name合格會回傳true
    let changeNameCheck = false;
    if (nameValidCheck) {
      changeNameCheck = name.trim() !== user.name; //name變更會回傳true
    }

    const profileValidCheck = Boolean(profile_image_url?.trim()); //url合格會回傳true
    let changeProfileCheck = false;
    if (profileValidCheck) {
      changeProfileCheck = profile_image_url.trim() !== user.profile_image_url; //url變更會回傳true
    }

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

    //修改變更的資料
    if (nameValidCheck && changeNameCheck) {
      user.name = name.trim();
    }
    if (profileValidCheck && changeProfileCheck) {
      user.profile_image_url = profile_image_url.trim();
    }
    if (hasAllPasswordFields) {
      user.password = await bcrypt.hash(newPassword, 10);
    }
    await userRepo.save(user);

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      profile_image_url: user.profile_image_url,
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

    //確認該使用者是否有訂閱此課程的類別
    const result = await checkCategoryAccess(userId, courseId);
    if (!result) {
      throw generateError(403, "未訂閱該課程類別");
    }
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
    //確認該使用者是否有訂閱此課程的類別
    const result = await checkCategoryAccess(userId, courseId);
    if (!result) {
      throw generateError(403, "未訂閱該課程類別");
    }
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
    let isEagerness = false;
    let result = [];

    //判斷訂閱是否有效
    const isActive = await hasActiveSubscription(userId);
    if (!isActive) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }

    //取得此人最新的訂閱紀錄
    const latestSubscription = await getLatestSubscription(userId);

    //如果是eagerness方案,取得所有類別
    if (Number(latestSubscription.Plan.sports_choice) === 0) {
      result = await getTypeByStudentCount();
      isEagerness = true;
    } else {
      //若非eagerness,取得類別的id、名稱、學生人數（依照學生人數排序）
      result = await subscriptionSkillRepo
        .createQueryBuilder("ss") // s = SubscriptionSkill資料表
        .innerJoin("ss.Skill", "sk") // sk = Skill資料表
        .innerJoin("sk.Course", "c") // c = Course資料表
        .select(["sk.id AS skill_id", "sk.name AS course_type"]) // 選擇 skill.id 和 skill.name 欄位
        .addSelect("SUM(c.student_amount) AS student_count") // 計算該類別學生
        .where("ss.subscription_id = :Id", { Id: latestSubscription.id }) //關聯最新訂閱紀錄
        .groupBy("sk.id") // 聚合相同課程類別，這樣可以計算每個類別下有多少學生
        .orderBy("student_count", "DESC") // 按學生人數排序，讓熱門課程類別排在前面
        .getRawMany();
    }
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

// 新增訂閱紀錄
async function postSubscription(req, res, next) {
  try {
    const userId = req.user.id; // 從驗證中獲取使用者 ID
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
    const orderNumber = `20250501${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")}`;

    // 建立訂閱資料
    const subscriptionRepo = AppDataSource.getRepository("Subscription");
    const newSubscription = subscriptionRepo.create({
      user_id: userId,
      order_number: orderNumber,
      plan_id: plan.id,
      price: plan.pricing,
    });

    // 儲存訂閱紀錄
    const savedSubscription = await subscriptionRepo.save(newSubscription);
    if (!savedSubscription) {
      return next(generateError(400, "更新資料失敗"));
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
    const userRepo = AppDataSource.getRepository("User");
    const user = await userRepo.findOneBy({ id: userId });

    if (!user) {
      return next(generateError(400, "使用者不存在"));
    }

    user.subscription_id = savedSubscription.id; // 設定訂閱 ID
    user.is_subscribed = true; // 更新訂閱狀態為已訂閱

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
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// 取消訂閱方案
async function patchSubscription(req, res, next) {
  try {
    const userId = req.user.id; // 從驗證中獲取使用者 ID

    // 確認使用者是否存在
    const user = await userRepo.findOneBy({ id: userId });

    // 確認使用者是否有訂閱方案
    if (!user.subscription_id) {
      return next(generateError(400, "找不到訂閱資料或已取消"));
    }

    // 更新使用者資料：清空 subscription_id 並將 is_subscribed 設為 false
    user.subscription_id = null;
    user.is_subscribed = false;

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
    //分頁設定
    const page = parseInt(req.query.page) || 1; //當前頁數
    const limit = 20;
    const skip = (page - 1) * limit; // 要跳過的資料筆數

    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return next(generateError(400, "分頁參數格式不正確，頁數需為正整數"));
    }

    //取得排序後的資料
    const userId = req.user.id;
    const [subscriptions, total] = await subscriptionRepo.findAndCount({
      where: { user_id: userId },
      order: { purchased_at: "DESC" },
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
      return {
        id: s.id,
        purchased_at: formatDate(s.purchased_at),
        order_number: s.order_number,
        plan: s.Plan.name,
        period: `${formatDate(s.start_at)} - ${formatDate(s.end_at)}`,
        end_at: formatDate(s.end_at),
        payment_method: s.payment_method,
        invoice_image_url: s.invoice_image_url,
        price: s.price,
        next_payment: formatDate(addDays(s.end_at, 1)),
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

module.exports = {
  getProfile,
  getPlans,
  getAllCourseType,
  patchProfile,
  postLike,
  deleteUnlike,
  getCourseType,
  postSubscription,
  patchSubscription,
  getSubscriptions,
};
