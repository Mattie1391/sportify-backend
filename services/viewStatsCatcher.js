// //這是每天特定時間從mux抓取影片觀看數據的功能
// const MuxData = require("@mux/mux-node");
// const config = require("../config/index");
// //導入cron，純javascript的排程工具
// const cron = require("node-cron");
// const AppDataSource = require("../db/data-source");
// const viewRepo = AppDataSource.getRepository("View_Stat");
// const formatDate = require("../utils/formatDate");

// //初始化mux client
// const muxData = new MuxData({
//   tokenId: config.get("mux.muxTokenId"),
//   muxTokenSecret: config.get("mux.muxTokenSecret"),
// });

// // 設定每日排程，早上八點開始，從左到右每個*對應分、時、日...
// // cron.schedule("* * * * *", async () => {
// //   await fetchMuxViewStats();
// // });

// // 抓取所有影片觀看統計
// async function fetchMuxViewStats() {
//   try {
//     const videoId = null; // 可選: 指定影片 ID，例如 'your_video_id'

//     //取得昨天日期
//     function getYesterdayFormatted() {
//       const today = new Date();
//       const yesterday = new Date(today);
//       yesterday.setDate(today.getDate() - 1);
//       return formatDate(yesterday);
//     }
//     const lastday = getYesterdayFormatted();

//     const response = await muxData.data.metrics.list({
//       timeframe: ["24:hours"],
//     });
//     // const response = await muxData.data.metrics.list({
//     //   dimension: "video_id", //asset id
//     //   timeframe: ["24:hours"],
//     // });
//     if (!response.data || response.data.length === 0) {
//       console.log(`${lastday}沒有資料可更新`);
//     }

//     for (const video of response.data) {
//       const { value: asset_id, total_views: total_views } = video;
//       // console.log(video);
//       // await viewRepo.save({ asset_id, total_views, date: lastday });
//     }
//     console.log(`Mux統計已更新:${lastday}`);
//   } catch (err) {
//     console.error(`呼叫mux api發生錯誤`, err);
//   }
// }

// module.exports = {
//   fetchMuxViewStats,
// };
