// 僅在本地開發時才載入 .env 檔案
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
module.exports = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  ssl:
    process.env.DB_ENABLE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
};

//主要是用來連接資料庫的設定檔
//把它包裝成物件 裡面跟我要去連接typeorm所需要的環境變數 做一次的整理
