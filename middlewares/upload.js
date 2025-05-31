const multer = require("multer");
const path = require("path");

// 設定 multer 的儲存配置
const storage = multer.diskStorage({
  // 設定檔案儲存目錄
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // 儲存到 uploads 資料夾
  },
  // 設定檔案命名規則
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // 取得原始檔案的副檔名
    cb(null, `${Date.now()}${ext}`); // 以時間戳命名，避免檔名重複
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
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    fileCount: 1, // 只允許上傳單一檔案
  },
});

module.exports = upload;
