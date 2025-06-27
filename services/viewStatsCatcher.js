//這是每天特定時間從mux抓取影片觀看數據的功能
const { Mux } = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret } = config.get("mux");

const AppDataSource = require("../db/data-source");
const viewRepo = AppDataSource.getRepository("View_Stat");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const courseRepo = AppDataSource.getRepository("Course");

//utils
const { formatDate, addDays } = require("../utils/formatDate");
const maskString = require("../utils/maskString");

//模組
const cron = require("node-cron"); //導入cron，純javascript的排程工具
const logger = require("../config/logger");

//初始化mux client
const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
});

// 設定每日排程，早上八點開始，從左到右每個*對應分、時、日...
function scheduleMuxDaliyStats() {
  cron.schedule("0 8 * * *", async () => {
    await fetchMuxViewStats();
  });
}

// 抓取所有影片觀看統計
async function fetchMuxViewStats() {
  try {
    //取得昨天日期
    function getYesterdayFormatted() {
      const today = new Date();
      return formatDate(addDays(today, -1));
    }
    const lastday = getYesterdayFormatted();

    const response = await mux.data.metrics.listBreakdownValues("views", {
      group_by: "asset_id", //依照asset_id做分組
      measurement: "count",
      timeframe: ["24:hours"], //選擇24小時內累積的觀看次數
    });

    //檢查是否取得mux回覆
    if (!response.body || response.body.data.length === 0) {
      logger.warn(`[View_Stats] ${lastday}沒有資料可更新`);
      return; //如果沒有任何觀看數據，就不會送response來。避免catch錯誤就return中斷。
    }
    const dataList = response.body.data;

    //查出所有asset_id對應的章節與課程
    const assetIds = dataList.map((d) => d.field);

    const subChapters = await chapterRepo
      .createQueryBuilder("cc")
      .where("cc.mux_asset_id IN (:...assetIds)", { assetIds })
      .select([
        "cc.id AS chapter_sub_chapter_set_id",
        "cc.course_id AS course_id",
        "cc.mux_asset_id AS mux_asset_id",
      ])
      .getRawMany();

    //將查詢結果比對組合成View_Stat資料表更新資料
    const statsToInsert = [];
    const courseToUpdate = [];

    for (const data of dataList) {
      const { views, field: asset_id } = data;
      const subChapter = subChapters.find((s) => s.mux_asset_id === asset_id);

      if (!subChapter) {
        logger.warn(
          `[View_Stats] 找不到asset_id :${maskString(asset_id, 5)}章節資料，故不儲存觀看數據`
        );
        continue;
      }
      statsToInsert.push({
        course_id: subChapter.course_id,
        chapter_sub_chapter_set_id: subChapter.chapter_sub_chapter_set_id,
        date: lastday,
        view_count: views,
      });
      courseToUpdate.push({
        course_id: subChapter.course_id,
        view_count: views,
      });
    }

    const updateResultViewStat = await viewRepo.save(statsToInsert);
    if (subChapters.length > 0 && updateResultViewStat.affected === 0) {
      logger.warn(`[View_Stats] 觀看數據更新失敗`);
    }
    //typeorm不支持多筆不同主鍵的update，用querybuilder+sql更新
    for (const courseStat of courseToUpdate) {
      const { course_id, view_count } = courseStat;

      await courseRepo
        .createQueryBuilder()
        .update()
        .set({ numbers_of_view: () => `"numbers_of_view"+${view_count}` })
        .where("id = :id", { id: course_id })
        .execute();
    }

    logger.info(`[View_Stats] Mux統計已更新:${lastday}`);
  } catch (err) {
    logger.info(`[View_Stats] 呼叫mux api發生錯誤`, err);
  }
}

module.exports = { scheduleMuxDaliyStats, fetchMuxViewStats };
