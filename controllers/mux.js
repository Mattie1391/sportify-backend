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
const { isNotValidString, isNotValidInteger, isNotValidUUID } = require("../utils/validators");
const { unixTot8zYYYYMMDD } = require("../utils/formatDate");
const maskString = require("../utils/maskString");
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
    //從前端取得必要的欄位資訊，用以建立章節。章節與小節號碼是為了辨明第一章第一節要為公開影片
    const {
      extension, //副檔名
      size,
      subChapterId,
      courseId, //如果是編輯已存在的課程表單，則請前端送入courseId，否則會是空值
    } = req.body;

    //驗證資料格式
    if (
      isNotValidString(extension) ||
      isNotValidInteger(size) ||
      isNotValidUUID(subChapterId) ||
      (courseId && isNotValidUUID(courseId))
    ) {
      return next(generateError(400, "請求資料格式錯誤"));
    }

    //驗證檔案格式與大小
    if (size > 4 * 1024 * 1024 * 1024) {
      return next(generateError(400, "影片過大，請勿超過4GB"));
    }
    if (!["mp4", "mov", "webm"].includes(extension.toLowerCase())) {
      return next(generateError(400, "不支援的影片格式。請上傳mp4、mov、webm格式檔案"));
    }

    //取得可用的courseId(編輯已存在課程的情況)，否則是檢查或建立空白課程(建立新課程)
    let courseIdToUse = courseId;
    if (!courseId) {
      let emptyCourse = await courseRepo.findOne({
        where: { coach_id: coachId, name: IsNull() },
      });
      if (!emptyCourse) {
        logger.info("需建立新課程id");
        emptyCourse = courseRepo.create({
          coach_id: coachId,
          is_approved: false,
        });
        await courseRepo.save(emptyCourse);
        logger.info(`課程id已建立:${maskString(emptyCourse.id, 5)}`);
      } else {
        logger.info(`已有空白課程: ${maskString(emptyCourse.id, 5)}`);
      }
      courseIdToUse = emptyCourse.id;
    } else {
      logger.info(`此為已建立的課程: ${maskString(courseId, 5)}`);
    }

    //檢查小節id是否已經建檔，若無則在資料庫建檔
    const hasSubChapter = await chapterRepo.findOneBy({ id: subChapterId });

    if (!hasSubChapter) {
      const subChapterToSave = chapterRepo.create({
        course_id: courseIdToUse,
        id: subChapterId,
      });
      await chapterRepo.save(subChapterToSave);
      logger.info(`小節id ${maskString(subChapterId, 5)}建檔成功`);
    } else {
      logger.info(`小節id ${maskString(subChapterId, 5)}已建過檔`);
    }

    //將course_id、subChapterId壓縮成json格式字串，以從passthrough傳出
    const passthroughData = JSON.stringify({
      course_id: courseIdToUse,
      sub_chapter_id: subChapterId,
    });
    //送出post request到 https://api.mux.com/video/v1/uploads
    const upload = await mux.video.uploads.create({
      cors_origin: "https://sportify.zeabur.app", //上線後要改為同網域內
      timeout: 7200, //上傳任務時限。由於上傳任務多，先設20分鐘看看。
      new_asset_settings: {
        playback_policy: ["signed"],
        max_resolution_tier: "2160p",
        video_quality: "plus",
        passthrough: passthroughData, //以章節副標題id作為識別碼
        meta: {
          creator_id: coachId, //應設定教練id
        },
      },
    });
    res.json({
      url: upload.url,
      sub_chapter_id: subChapterId,
      course_id: courseIdToUse,
    });
  } catch (error) {
    next(error);
  }
};

//mux 接收webhook通知
const muxWebhookHandler = async (req, res, next) => {
  //外層try : 驗證webhook有效性
  try {
    mux.webhooks.verifySignature(JSON.stringify(req.body), req.headers, webhookSecret);

    const event = req.body;

    switch (event.type) {
      case "video.asset.ready": {
        const asset = event.data;
        logger.info(`資料接收成功， ${event.type}`);

        const { id: asset_id, duration, passthrough, status, created_at } = asset;
        const playbackId = asset.playback_ids[0].id;

        //內層try : 業務邏輯與資料處理
        try {
          if (!passthrough) {
            return next(generateError(400, "passthrough 為空。由於未傳入章節id，無法儲存影片資料"));
          }
          const { course_id, sub_chapter_id } = JSON.parse(passthrough);
          //更新到Course_Chapter資料表
          const existingVideo = await chapterRepo.findOneBy({ mux_asset_id: asset_id });
          if (existingVideo) {
            return next(generateError(409, "已儲存過此影片"));
          }
          logger.info(
            `已接收passthrough。asset_id為 ${maskString(asset_id, 5)} 課程id為 ${maskString(course_id, 5)} 開始更新資料庫`
          );

          //檢查資料庫有無課程建檔，沒有的話就新建一個空殼課程
          let course = await courseRepo.findOneBy({ id: course_id });
          if (!course) {
            course = courseRepo.create({
              coach_id: course_id,
              is_approved: false,
            });
            await courseRepo.save(course);
          }
          //檢查資料庫有無小節建檔，沒有的話新建一個
          const hasSubChapter = await chapterRepo.findOneBy({ id: sub_chapter_id });

          if (!hasSubChapter) {
            const subChapterToSave = chapterRepo.create({
              course_id: course.id,
              id: sub_chapter_id,
            });
            await chapterRepo.save(subChapterToSave);
          }
          //確定已有小節檔案的情況，就更新影片資訊

          const updateVideoAsset = await chapterRepo.update(
            {
              id: sub_chapter_id,
            },
            {
              course_id: course_id,
              mux_asset_id: asset_id,
              mux_playback_id: playbackId,
              duration: duration,
              status: status,
              uploaded_at: unixTot8zYYYYMMDD(created_at), //換算上傳時間，轉換unix時間為+8時區的時間格式
            }
          );
          if (updateVideoAsset.affected === 0) {
            return next(generateError(400, "影片資料儲存失敗"));
          }
          logger.info("已更新資料庫");
          //取得所有該課程影片的時長(單位為秒數)
          const subChapters = await chapterRepo
            .createQueryBuilder("c")
            .select("SUM(c.duration)", "total_duration")
            .where("c.course_id = :course_id", { course_id: course_id })
            .getRawOne();

          //換算加總值為小時
          const total_hours = Math.ceil(subChapters.total_duration / 3600);
          await courseRepo.update(
            { id: course_id },
            {
              total_hours: total_hours,
            }
          );
          return res.status(200).send("Webhook processed: video.asset.ready");
        } catch (dataError) {
          logger.error("Webhook處理失敗，資料庫邏輯錯誤", dataError);
          return res.status(200).send("Webhook received but failed to process");
        }
      }
      //處理其他事件
      case "video.asset.deleted":
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
    logger.warn("webhook錯誤", error.name, error.message);
    return res.status(400).send("Webhook signature/format error");
  }
};

module.exports = { muxUploadHandler, muxWebhookHandler };
