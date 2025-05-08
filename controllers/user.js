const AppDataSource = require("../db/data-source");
const userRepo = AppDataSource.getRepository("User");
const favoriteRepo = AppDataSource.getRepository("User_Course_Favorite");
const subscriptionRepo =
  require("../db/data-source").getRepository("Subscription");
const {
  isUndefined,
  isNotValidString,
  isNotValidUUID,
  isNotValidUrl,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const { checkCategoryAccess } = require("../services/checkCategoryAccess");
const bcrypt = require("bcryptjs");

//取得使用者資料
async function getProfile(req, res, next) {
  try {
    const userId = req.params.userId;
    if (
      !userId ||
      isNotValidString(userId) ||
      userId.length === 0 ||
      isNotValidUUID(userId)
    ) {
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
    res
      .status(200)
      .json({ status: true, message: "成功取得資料", data: userData });
  } catch (error) {
    next(error);
  }
}

async function getSubscriptionPlans(req, res, next) {
  try {
    const plans = await AppDataSource.getRepository("");
  } catch (error) {
    next(error);
  }
}

//修改使用者資料
async function patchProfile(req, res, next) {
  try {
    const userId = req.params.userId;
    if (
      !userId ||
      isNotValidString(userId) ||
      userId.length === 0 ||
      isNotValidUUID(userId)
    )
      return next(generateError(400, "使用者 ID 格式不正確"));

    const user = await userRepo.findOneBy({ id: userId });

    // email及使用者ID無法修改,前端email欄位同步寫死，不能輸入
    const {
      name,
      profile_image_url,
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
    res
      .status(200)
      .json({ status: true, message: "成功更新資料", data: userData });
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
    //取得類別的id、名稱、學生人數（依照學生人數排序）
    const result = await subscriptionRepo
      .createQueryBuilder("s") // s = Subscription資料表
      .innerJoin("s.Subscription_Skill", "ss") // ss = Subscription_Skill資料表
      .innerJoin("ss.Skill", "sk") // sk = Skill資料表
      .innerJoin("sk.Course", "c") // c = Course資料表
      .select(["sk.id AS skill_id", "sk.name AS course_type"]) // 選擇 skill.id 和 skill.name 欄位
      .addSelect("SUM(c.student_amount) AS student_count") // 計算該類別學生
      .where("s.user_id = :userId", { userId }) // WHERE s.user_id = userId
      .groupBy("sk.id") // 聚合相同課程類別，這樣可以計算每個類別下有多少學生
      .orderBy("student_count", "DESC") // 按學生人數排序，讓熱門課程類別排在前面
      .getRawMany();

    if (!result || result.length === 0) {
      return next(generateError(403, "未訂閱，無可觀看課程類別"));
    }
    res.status(200).json({
      status: true,
      message: "成功取得資料",
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

module.exports = {
  getProfile,
  getSubscriptionPlans,
  patchProfile,
  postLike,
  deleteUnlike,
  getCourseType,
};
