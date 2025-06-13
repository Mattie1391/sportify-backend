const generateError = require("../utils/generateError");

// 上傳學員大頭貼功能模組
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

//上傳教練大頭貼功能模組
const uploadCoachAvatar = (req, res, next) => {
  // 檢查是否有接收到檔案
  if (!req.file) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  if (req.file.fieldname !== "coachAvatar") {
    return next(generateError(400, `欄位名稱錯誤: ${req.file.fieldname}，應為 coachAvatar`));
  }

  // 建立完整url路徑
  const data = {
    coachId: req.user.id,
    filename: req.file.filename, // 檔案名稱
    publicId: req.file.filename, // Cloudinary 的 public_id = 檔案名稱
    url: req.file.path, // Cloudinary URL
    mimeType: req.file.mimetype, // 檔案類型
    size: req.file.size, // 檔案大小
  };
  res.status(200).json({ status: true, data });
};

//上傳教練存摺封面的模組
const uploadBankbook = (req, res, next) => {
  // 檢查是否有接收到檔案
  if (!req.file) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  if (req.file.fieldname !== "bankbook") {
    return next(generateError(400, `欄位名稱錯誤: ${req.file.fieldname}，應為 bankbook`));
  }

  // 建立完整url路徑
  const data = {
    coachId: req.user.id,
    filename: req.file.filename, // 檔案名稱
    publicId: req.file.filename, // Cloudinary 的 public_id = 檔案名稱
    url: req.file.path, // Cloudinary URL
    mimeType: req.file.mimetype, // 檔案類型
    size: req.file.size, // 檔案大小
  };
  res.status(200).json({ status: true, data });
};

//上傳教練證照
const uploadLicense = (req, res, next) => {
  // 檢查是否有接收到檔案
  const files = req.files
  if (!req.files) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  const filteredFiles = req.files.filter((file)=>file.fieldname!=="license")
  const wrongFields = filteredFiles.map(f=>f.fieldname).join(", ")
  if (wrongFields) {
    return next(generateError(400, `有檔案欄位名稱出錯: ${wrongFields}，只允許 license`));
  }

  // 建立完整url路徑

  let dataArray = []
  for(const item of files){
    const {originalname,filename,path,mimetype,size} = item
    dataArray.push({
      coachId:req.user.id,
      originalname,
      filename,
      publicId:filename,
      url:path,
      mimeType:mimetype,
      size
    })
  }
  res.status(200).json({ status: true, dataArray});
};

//上傳教練背景圖片
const uploadBackground = (req, res, next) => {
  // 檢查是否有接收到檔案
  if (!req.file) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  if (req.file.fieldname !== "background") {
    return next(generateError(400, `欄位名稱錯誤: ${req.file.fieldname}，應為 background`));
  }

  // 建立完整url路徑
  const data = {
    coachId: req.user.id,
    filename: req.file.filename, // 檔案名稱
    publicId: req.file.filename, // Cloudinary 的 public_id = 檔案名稱
    url: req.file.path, // Cloudinary URL
    mimeType: req.file.mimetype, // 檔案類型
    size: req.file.size, // 檔案大小
  };
  res.status(200).json({ status: true, data });
};

//上傳教練課程封面
const uploadCourseThumbnail = (req, res, next) => {
  // 檢查是否有接收到檔案
  if (!req.file) return next(generateError(400, "未收到檔案"));
  // 檢查檔案欄位名稱
  if (req.file.fieldname !== "courseThumbnail") {
    return next(generateError(400, `欄位名稱錯誤: ${req.file.fieldname}，應為 courseThumbnail`));
  }

  // 建立完整url路徑
  const data = {
    coachId: req.user.id,
    filename: req.file.filename, // 檔案名稱
    publicId: req.file.filename, // Cloudinary 的 public_id = 檔案名稱
    url: req.file.path, // Cloudinary URL
    mimeType: req.file.mimetype, // 檔案類型
    size: req.file.size, // 檔案大小
  };
  res.status(200).json({ status: true, data });
};

module.exports = {
  uploadAvatar,
  uploadCoachAvatar,
  uploadBankbook,
  uploadLicense,
  uploadBackground,
  uploadCourseThumbnail,
};
