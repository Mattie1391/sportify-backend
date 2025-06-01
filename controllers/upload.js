const generateError = require("../utils/generateError");

// 上傳大頭貼功能模組
const uploadAvatar = (req, res, next) => {
  // 檢查是否有接收到檔案
  if (!req.file) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  if (req.file.fieldname !== "avatar") {
    return next(generateError(400, `欄位名稱錯誤: ${req.file.fieldname}，應為 avatar`));
  }

  // 建立完整url路徑
  const data = {
    userId: req.user.id,
    filename: req.file.filename, // 檔案名稱
    publicId: req.file.filename, // Cloudinary 的 public_id = 檔案名稱
    url: req.file.path, // Cloudinary URL
    mimeType: req.file.mimetype, // 檔案類型
    size: req.file.size, // 檔案大小
  };
  res.status(200).json({ status: true, data });
};

module.exports = { uploadAvatar };
