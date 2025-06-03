const Mux = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret } = config.get("mux");
const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
});

const muxUploadHandler = async (req, res, next) => {
  try {
    //送出post request到 https://api.mux.com/video/v1/uploads
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      timeout: 7200, //上傳任務時限。由於上傳任務多，先設20分鐘看看。
      new_asset_settings: {
        plaback_policy: ["signed"],
        test: true, //設定該上傳影片為試用，不產生費用，但限制時長10秒鐘、24小時候刪除
        max_resolution_tier: "2160p",
        video_quality: "plus", //至少要plus才符合提供最高2160p畫質的需求，更高階可設premium，但錢包炸裂更快。
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

module.exports = { muxUploadHandler };
