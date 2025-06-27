//排程刪除錯誤建立的空白課程與空白章節資料 : 上傳影片後未送出而關閉頁面導致

const AppDataSource = require("../db/data-source");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const courseRepo = AppDataSource.getRepository("Course");
const { IsNull, LessThan, In } = require("typeorm");

//utils
const { formatDate, addDays } = require("../utils/formatDate");
const maskString = require("../utils/maskString");

//模組
const cron = require("node-cron"); //導入cron，純javascript的排程工具
const logger = require("../config/logger");

// 設定每日排程，早上八點開始，從左到右每個*對應分、時、日...
function scheduleCourseDeletion() {
  cron.schedule("* * * * *", async () => {
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
    console.log(coursesToDeleteArr);
    if (coursesToDeleteArr.length === 0) {
      logger.info("[CourseDeletion] 查無須刪除課程及小節資料");
    }
    //刪除該課程資料與小節資料
    const coursesToDeleteIds = coursesToDeleteArr.map((c) => c.id);
    const subToDeleteArr = await chapterRepo.find({
      where: { course_id: In(coursesToDeleteIds) },
      select: ["id"],
    });
    console.log(coursesToDeleteIds);
    await chapterRepo.delete();

    // await courseRepo.
    //     const statsToInsert = [];
    // const courseToUpdate = [];

    // for (const data of dataList) {
    //   const { views, field: asset_id } = data;
    //   const subChapter = subChapters.find((s) => s.mux_asset_id === asset_id);
    // for (const id of coursesToDelete) {
    //   const subChaptersOfCourse = await chapterRepo.find({ where: { course_id: id } });
    //   console.log(subChaptersOfCourse);
    // }

    //找尋
  } catch (error) {
    console.error(error);
    logger.info("刪除無用課程失敗", error);
  }
}

module.exports = { scheduleCourseDeletion, courseDeletion };
