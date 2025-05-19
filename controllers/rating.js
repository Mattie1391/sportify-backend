const AppDataSource = require("../db/data-source"); // 引入資料庫連線
// 取得 Rating 表的資料庫操作實例
const ratingRepo = AppDataSource.getRepository("Rating");
// 取得 User 表的資料庫操作實例
const userRepo = AppDataSource.getRepository("User");
//取得 Course 表的資料表操作實例
const courseRepo = AppDataSource.getRepository("Course");

//services
const { checkActiveSubscription, checkCourseAccess } = require("../services/checkServices");

//utils
const { isNotValidUUID, isUndefined, isNotValidString } = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError"); // 引入自定義的錯誤生成器
const formatDate = require("../utils/formatDate"); // 引入日期格式化工具函數

// 取得課程評價 API
async function getRatings(req, res, next) {
  try {
    const { courseId } = req.params; // 從路徑參數中取得課程 ID
    const { page = 1 } = req.query; // 從查詢參數中取得分頁數據，默認值為第 1 頁，每頁 10 筆
    const limit = 20; // 每頁顯示的數量，這裡設置為 20 筆

    // 驗證課程 ID 是否存在且有效
    if (!courseId || isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 不正確")); // 若課程 ID 無效，返回 400 錯誤
    }

    // 將分頁參數轉換為整數
    const pageNumber = parseInt(page, 10); // 當前頁數
    const itemsPerPage = parseInt(limit, 10); // 每頁筆數

    // 驗證分頁參數是否為有效數字
    if (isNaN(pageNumber) || isNaN(itemsPerPage)) {
      return next(generateError(400, "分頁參數格式不正確")); // 若分頁參數無效，返回 400 錯誤
    }

    // 從資料庫中查詢課程評價資料，並同時計算符合條件的總數
    const [ratings, totalRatings] = await ratingRepo.findAndCount({
      where: { course_id: courseId }, // 根據課程 ID 篩選評價
      skip: (pageNumber - 1) * itemsPerPage, // 計算分頁的起始位置
      take: itemsPerPage, // 每頁取出 N 筆資料
      order: {
        created_at: "DESC", // 按建立時間降序排列，最新的評價在最前
      },
    });

    // 查詢每條評價對應的使用者名稱，並組裝返回數據結構
    const ratingsWithUserNames = await Promise.all(
      ratings.map(async (rating) => {
        // 根據 user_id 查詢對應的用戶
        const user = await userRepo.findOne({
          where: { id: rating.user_id }, // 從資料庫中查詢對應的使用者
        });

        // 組裝返回數據，若找不到用戶，名稱設為 "未知用戶"
        return {
          id: rating.id, // 評價 ID
          username: user ? user.name : "未知用戶", // 使用者名稱，若無法找到，設為 "未知用戶"
          comment: rating.comment, // 評語留言
          score: rating.score, // 評分
          createdAt: formatDate(new Date(rating.created_at)), // 格式化建立時間
          updatedAt: formatDate(new Date(rating.updated_at)), // 格式化最後更新時間
        };
      })
    );

    // 計算總頁數（總數 / 每頁筆數，向上取整）
    const totalPages = Math.ceil(totalRatings / itemsPerPage);

    if (pageNumber > totalPages) {
      return next(generateError(400, "頁數超出範圍")); // 若頁數超出範圍，返回 400 錯誤
    }

    // 判斷是否有上一頁或下一頁
    const hasPrevious = pageNumber > 1; // 如果當前頁數大於 1，則有上一頁
    const hasNext = pageNumber < totalPages; // 如果當前頁數小於總頁數，則有下一頁

    // 返回成功響應，包含整理後的評價數據
    res.status(200).json({
      status: true, // 請求狀態
      message: "成功取得資料", // 請求成功訊息
      data: {
        ratingsWithUserNames, // 評價列表
        meta: {
          sort: "desc", // 後端預設寫死，不寫在query
          sort_by: "time", // 留言時間新到舊排序，後端預設寫死，不寫在query
          page: pageNumber, // 當前頁數
          limit: itemsPerPage, // 每頁筆數
          total: totalRatings, // 總評價數
          total_pages: totalPages, // 總頁數
          has_previous: hasPrevious, // 是否有上一頁
          has_next: hasNext, // 是否有下一頁
        },
      },
    });
  } catch (error) {
    // 捕獲錯誤並傳遞給下一個錯誤處理器
    next(error);
  }
}
async function postRating(req, res, next) {
  try {
    //驗證user id、course id格式
    const { courseId, userId } = req.params;
    if (!userId || isNotValidString(userId) || isNotValidUUID(userId)) {
      return next(generateError(400, "使用者 ID 格式不正確"));
    }

    if (!courseId || isNotValidString(courseId) || isNotValidUUID(courseId)) {
      return next(generateError(400, "課程 ID 格式不正確"));
    }
    //驗證課程是否存在
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "找不到該課程"));
    }
    //判斷訂閱是否有效
    const isSubscribed = await checkActiveSubscription(userId);
    if (!isSubscribed) {
      return next(generateError(403, "尚未訂閱或訂閱已失效，無可觀看課程類別"));
    }
    //驗證是否訂閱該課程
    const canWatchType = await checkCourseAccess(userId, courseId);
    if (!canWatchType) throw generateError(403, "未訂閱該課程類別");

    //驗證是否對該課程評過分
    const hasRating = await ratingRepo.findOne({
      where: { user_id: userId, course_id: courseId },
    });
    if (hasRating) {
      return next(generateError(400, "已有評價資料"));
    }
    //通過身分驗證，開始驗證request body內容
    const { score, comment } = req.body;

    //驗證分數格式
    if (
      typeof score !== "number" ||
      isUndefined(score) ||
      isNaN(score) ||
      score % 1 !== 0 ||
      score < 0 ||
      score > 5
    ) {
      return next(generateError(400, "評分格式錯誤，請填入0~5間的整數顆星"));
    }
    //驗證評論comment格式
    if (isNotValidString(comment) || comment.length == 0) {
      return next(generateError(400, "評論格式錯誤，請填寫內容"));
    }
    if (comment.length > 100) {
      return next(generateError(400, "評論字數以100字為限"));
    }
    //通過驗證，組成資料並存入Rating資料庫
    const newRating = await ratingRepo.create({
      user_id: userId,
      course_id: courseId,
      score,
      comment,
    });
    const data = await ratingRepo.save(newRating);
    res.status(201).json({
      status: true,
      message: "成功新增課程評價",
      data: {
        score: data.score,
        comment: data.comment,
      },
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  getRatings,
  postRating,
}; // 將路由導出以供主應用程序使用
