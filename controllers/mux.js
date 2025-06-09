const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const chapterRepo = AppDataSource.getRepository("Course_Chapter");
const generateError = require("../utils/generateError");
const logger = require("../config/logger");
const { IsNull } = require("typeorm");

const { Mux } = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret, webhookSecret } = config.get("mux");

//utils
const { isNotValidString, isNotValidInteger } = require("../utils/validators");
const { unixTot8zYYYYMMDD } = require("../utils/formatDate");
//建立mux api客戶端實例，設定存取憑證。建立後可用以調用各種mux提供的API方法。
const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
  webhookSecret,
});

// mux從本地上傳影片;
const muxUploadHandler = async (req, res, next) => {
  try {
    const coachId = req.user.id;
    //從前端取得必要的欄位資訊，用以建立章節
    const {
      filename,
      extension, //副檔名
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
    if (!["mp4", "mov", "webm"].includes(extension.toLowerCase())) {
      return next(generateError(400, `不支援${filename}的影片格式。請上傳mp4、mov、webm格式檔案`));
    }

    //判斷是否已建立課程資料，若無，就建立空白課程以取得course id以綁定章節資料
    let course = await courseRepo.findOne({
      where: { coach_id: coachId, name: IsNull() },
    });

    //如果有未建立課程(以資料庫有該教練未填入課程名稱的課程資料為判斷依據)，就建立空白課程，如有空白課程，就取得該課程id
    if (!course) {
      logger.info("需建立新課程id");
      const newCourse = courseRepo.create({
        coach_id: coachId,
        is_approved: false,
      });
      await courseRepo.save(newCourse);
      logger.info("課程id已建立");
    }

    //建立章節資料 : 剛才建立課程的，取新課程id，已有空白課程的取舊課程id
    course = await courseRepo.findOne({
      where: { coach_id: coachId, name: IsNull() },
    });
    logger.info(`取得空白課程id ${course.id}`);
    const newSubChapter = chapterRepo.create({
      course_id: course.id,
      chapter_number,
      title,
      sub_chapter_number,
      subtitle,
    });
    await chapterRepo.save(newSubChapter);

    //取得新建立的章節小節唯一ID   **TODO若刪除影片，為保留觀看數據不可刪除Course_Chapter的id
    const chapterSubtitleSet = await chapterRepo.findOne({
      where: {
        course_id: course.id,
        chapter_number: chapter_number,
        sub_chapter_number: sub_chapter_number,
      },
    });

    //送出post request到 https://api.mux.com/video/v1/uploads
    const upload = await mux.video.uploads.create({
      cors_origin: "*", //上線後要改為同網域內
      timeout: 7200, //上傳任務時限。由於上傳任務多，先設20分鐘看看。
      new_asset_settings: {
        playback_policy: ["signed"],
        test: true, //設定該上傳影片為試用，不產生費用，但限制時長10秒鐘、24小時後刪除
        max_resolution_tier: "2160p",
        video_quality: "plus", //至少要plus才符合提供最高2160p畫質的需求，更高階可設premium，但錢包炸裂更快。
        passthrough: chapterSubtitleSet.id, //以章節副標題id作為識別碼
        meta: {
          title: subtitle, //影片名稱，應從教練建立課程表單取得
          creator_id: coachId, //應設定教練id
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

    const event = req.body;

    switch (event.type) {
      case "video.asset.ready": {
        const asset = event.data;
        logger.info(`資料接收成功， ${event.type}`);

        const { id: asset_id, passthrough, duration, status, created_at } = asset;
        const playbackId = asset.playback_ids[0].id;

        if (!passthrough) {
          return next(generateError(400, "passthrough 為空。由於未傳入章節id，無法儲存影片資料"));
        }
        //更新到Course_Chapter資料表
        const existingVideo = await chapterRepo.findOneBy({ mux_asset_id: asset_id });
        if (existingVideo) {
          return next(generateError(409, "已儲存過此影片"));
        }

        await chapterRepo.update(
          {
            id: passthrough,
          },
          {
            mux_asset_id: asset_id,
            mux_playback_id: playbackId,
            duration: duration,
            status: status,
            uploaded_at: unixTot8zYYYYMMDD(created_at), //換算上傳時間，轉換unix時間為+8時區的時間格式
          }
        );
        return res.status(200).send("Webhook processed: video.asset.ready");
      }
      //處理其他事件
      case "video.asset.uploaded":
      case "video.asset.created":
      case "video.upload.error":
        //先不做處理，只回傳2xx代碼，讓mux停止retry
        logger.info(`忽略事件: ${event.type}`);
        return res.sendStatus(204);
      //其他事件類型，也先不做處理，只回傳2xx代碼，讓mux停止retry
      default:
        logger.info(`未處理事件: ${event.type}`);
        return res.sendStatus(204);
    }
  } catch (error) {
    logger.warn("webhook錯誤", error.message);
    return next(error);
  }
};

module.exports = { muxUploadHandler, muxWebhookHandler };
