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

// 設定cloudinary的儲存配置
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "user-avatars", // Cloudinary 資料夾
    format: async (req, file) => "jpg", //儲存格式
    public_id: (req, file) => `avatar_${req.user.id}_${Date.now()}`, // 自定義檔案名稱
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
    files: 1, // 只允許上傳單一檔案
  },
});

module.exports = upload;
