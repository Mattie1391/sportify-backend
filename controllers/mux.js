const AppDataSource = require("../db/data-source");
const courseVideoRepo = AppDataSource.getRepository("Course_Video");
const generateError = require("../utils/generateError");
const getRawBody = require("raw-body");

const { Mux } = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret, webhookSecret } = config.get("mux");

const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
  webhookSecret,
});

// mux從本地上傳影片;
const muxUploadHandler = async (req, res, next) => {
  try {
    // ===========大量上傳的嘗試============//
    // const count = parseInt(req.query.count) || 1;
    // const uploadTasks = [];

    // for (let i = 0; 1 < count; i++) {
    //   uploadTasks.push(
    //     mux.video.uploads.create({
    //       cors_origin: "*",
    //       new_asset_settings: { playback_policy: ["signed"] },
    //     })
    //   );
    // }
    // const uploads = await Promise.all(uploadTasks);

    // res.json(
    //   uploads.map((upload) => ({
    //     id: upload.id,
    //     url: upload.url,
    //   }))
    // );

    // ===========大量上傳的嘗試============//

    // 測試設定chapter_subtitle_set_id 用假的
    let chapter_subtitle_set_id = "c3d1e98f-3714-4f4d-bb95-8d486604c531";
    // const { chapter_subtitle_set_id } = req.query;
    //送出post request到 https://api.mux.com/video/v1/uploads
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      timeout: 7200, //上傳任務時限。由於上傳任務多，先設20分鐘看看。
      new_asset_settings: {
        plaback_policy: ["signed"],
        test: true, //設定該上傳影片為試用，不產生費用，但限制時長10秒鐘、24小時候刪除
        max_resolution_tier: "2160p",
        video_quality: "plus", //至少要plus才符合提供最高2160p畫質的需求，更高階可設premium，但錢包炸裂更快。
        passthrough: chapter_subtitle_set_id, //以章節副標題id作為識別碼
        meta: {
          title: "測試影片", //影片名稱，應從教練建立課程表單取得
          creator_id: "abc123", //應設定教練id
        },
      },
    });
    res.json({ url: upload.url, id: upload.id });
  } catch (error) {
    next(error);
  }
};

// //mux webhook通知上傳結果
const muxWebhookHandler = async (req, res, next) => {
  try {
    mux.webhooks.verifySignature(JSON.stringify(req.body), req.headers, webhookSecret);
    console.log("✅ Webhook Received:", JSON.stringify(req.body, null, 2));

    const event = req.body;
    //當事件為影片上傳就緒，便儲存進資料庫
    if (event.type === "video.asset.ready") {
      const asset = event.data;
      const { id: asset_id, passthrough, duration } = asset;

      //建立signed playback id
      const { id: playback_id } = await mux.video.assets.createPlaybackId(asset_id, {
        policy: "signed",
      });

      if (passthrough === undefined) {
        return next(generateError(400, "passthrough 為空，無法儲存影片資料"));
      }
      //儲存到Course_Video資料表
      const existingVideo = await courseVideoRepo.findOneBy({ mux_asset_id: asset_id });
      if (existingVideo) {
        return next(generateError(409, "已儲存過此影片"));
      }
      const video = courseVideoRepo.create({
        chapter_subtitle_set_id: passthrough,
        mux_asset_id: asset_id,
        mux_playback_id: playback_id,
        duration,
        status: "ready",
      });
      await courseVideoRepo.save(video);
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ 簽名驗證失敗：", error.message);
    return next(error);
  }
};

module.exports = { muxUploadHandler, muxWebhookHandler };
