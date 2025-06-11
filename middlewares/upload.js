const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const config = require("../config/index");
const { cloud_name, api_key, api_secret } = config.get("cloudinary");

// 引入配置檔
cloudinary.config({
  cloud_name: cloud_name,
  api_key: api_key,
  api_secret: api_secret,
});

// 上傳單個檔案，設定cloudinary的儲存配置
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    //取用req.body或檔案來源來判斷性質
    const type = req.body?.type || file.fieldname || "default";
    if (!["avatar", "coachAvatar", "background", "bankbook", "license"].includes(type)) {
      throw new Error("不支援的上傳類型");
    }
    let folder = "";
    const public_id = `${file.fieldname}_${req.user.id}_${Date.now()}`; // 自定義檔案名稱

    switch (type) {
      case "avatar":
        folder = "user-avatars";
        break;
      case "coachAvatar":
        folder = "coach/avatars";
        break;
      case "bankbook":
        folder = "coach/bankbook";
        break;
      case "background":
        folder = "coach/background";
        break;
      case "license":
        folder = "coach/license";
        break;
    }
    return {
      folder,
      public_id,
      format: "jpg",
    };
  },
});

// 檢查檔案類型
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowedTypes.includes(file.mimetype)) {
    // 若格式不符合，則不儲存檔案
    return cb(new Error("僅支援 JPG 或 PNG 檔案格式"), false);
  }
  cb(null, true);
};

// 建立 upload 實例
const upload = multer({
  storage, // 使用 CloudinaryStorage
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

module.exports = upload;
