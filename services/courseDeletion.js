//排程刪除錯誤建立的空白課程與空白章節資料 : 上傳影片後未送出而關閉頁面導致

const AppDataSource = require("../db/data-source");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const courseRepo = AppDataSource.getRepository("Course");
const { IsNull, LessThan, In } = require("typeorm");

//模組
const cron = require("node-cron"); //導入cron，純javascript的排程工具
const logger = require("../config/logger");

// 設定每日排程，(utc+8)早上八點執行，從左到右每個*對應分、時、日...
function scheduleCourseDeletion() {
  cron.schedule("0 8 * * *", async () => {
    await courseDeletion();
  });
}

async function courseDeletion() {
  try {
    //找尋已創建、欄位有空白，且update後超過一天未更新的課程
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const coursesToDeleteArr = await courseRepo.find({
      where: { name: IsNull(), updated_at: LessThan(twentyFourHoursAgo) },
      select: ["id"],
    });
    if (coursesToDeleteArr.length === 0) {
      logger.info("[CourseDeletion] 查無須刪除的課程資料");
      return;
    }
    //找到課程的小節資料
    const coursesToDeleteIds = coursesToDeleteArr.map((c) => c.id);
    const subToDeleteArr = await chapterRepo.find({
      where: { course_id: In(coursesToDeleteIds) },
      select: ["id"],
    });
    if (subToDeleteArr.length === 0) {
      logger.info("[CourseDeletion] 查無須刪除的小節資料");
    }
    const subToDeleteIds = subToDeleteArr.map((s) => s.id);
    //執行課程跟小節資料的刪除

    await chapterRepo.delete(subToDeleteIds);
    await courseRepo.delete(coursesToDeleteIds);
    logger.info(`已刪除多餘課程 ${coursesToDeleteIds.length}筆、多餘小節 ${subToDeleteIds}筆`);
  } catch (error) {
    logger.info("刪除無用課程失敗", error);
  }
}

module.exports = { scheduleCourseDeletion, courseDeletion };
