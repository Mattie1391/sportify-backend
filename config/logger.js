const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

let logger; // 先宣告變數

//正式環境
if (isProduction) {
  logger = pino({
    level: "info", // 設定日誌等級為 info
    timestamp: pino.stdTimeFunctions.isoTime, // 使用 ISO 時間格式
  });
} else {
  //開發環境
  logger = pino({
    level: "debug", // 設定日誌等級為 debug
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss", // 時間格式
        ignore: "pid,hostname",
      },
    },
  });
}

module.exports = logger;
