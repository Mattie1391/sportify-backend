const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "伺服器錯誤";

  // 處理 multer 錯誤
  if (err.message === "僅支援 JPG 或 PNG 檔案格式") {
    statusCode = 400;
  }
  // multer官方提供的錯誤代碼
  if(err.code === "LIMIT_FILE_COUNT"){
    statusCode = 400
    message = "上傳的檔案數量超過限制"
  }


  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message = "不允許的檔案欄位，請確認欄位名稱是否正確";
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "檔案太大，請上傳小於 2MB 的圖片";
  }

  // 預設錯誤回應
  res.status(statusCode).json({
    status: false,
    message: message,
  });
};

module.exports = errorHandler;
