const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const generateError = require("../utils/generateError");

const { Mux } = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret, webhookSecret } = config.get("mux");

//utils
const { isNotValidString, isNotValidInteger } = require("../utils/validators");

//建立mux api客戶端實例，設定存取憑證。建立後可用以調用各種mux提供的API方法。
const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
  webhookSecret,
});

// mux從本地上傳影片;
const muxUploadHandler = async (req, res, next) => {
  try {
    //從前端取得必要的欄位資訊
    const {
      coachId,
      filename,
      extension,
      size,
      chapter_number,
      title,
      sub_chapter_number,
      subtitle,
    } = req.body;

    //驗證資料格式
    if (isNotValidString(filename) || isNotValidString(extension) || isNotValidInteger(size)) {
      return next(generateError(400, "檔案相關資料格式錯誤"));
    }
    if (
      isNotValidInteger(chapter_number) ||
      isNotValidInteger(sub_chapter_number) ||
      isNotValidString(title) ||
      isNotValidString(subtitle)
    ) {
      return next(generateError(400, "章節或小節欄位填寫錯誤"));
    }

    //驗證檔案格式與大小
    if (size > 4 * 1024 * 1024 * 1024) {
      return next(generateError(400, `${filename}影片過大，請勿超過4GB`));
    }
    if (!["mp4", "mov", "webm"].includes(extension)) {
      return next(generateError(400, `不支援${filename}的影片格式。請上傳mp4、mov、webm格式檔案`));
    }
    //建立querybuilder一次查詢課程與章節資料

    //判斷是否已建立課程資料，若無，就建立空白課程以取得course id以綁定章節資料
    const existingCourse = await courseRepo.findOneBy({ coach_id: coachId });
    if (existingCourse.length === 0) {
      const newCourse = courseRepo.create({
        coach_id: coachId,
        is_approved: false,
      });
      await courseRepo.save(newCourse);
    }
    //查詢是否已有章節資料 **若刪除影片，為保留觀看數據不可刪除Course_Chapter的id

    //在資料庫建立章節資訊

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
      const existingVideo = await chapterRepo.findOneBy({ mux_asset_id: asset_id });
      if (existingVideo) {
        return next(generateError(409, "已儲存過此影片"));
      }
      //必定已存在章節資訊，所以不用建新欄位!

      // const video = chapterRepo.create({
      //   chapter_subtitle_set_id: passthrough,
      //   mux_asset_id: asset_id,
      //   mux_playback_id: playback_id,
      //   duration,
      //   status: "ready",
      // });
      // await chapterRepo.save(video);
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ 簽名驗證失敗：", error.message);
    return next(error);
  }
};

module.exports = { muxUploadHandler, muxWebhookHandler };
