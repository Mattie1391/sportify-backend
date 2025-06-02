const pino = require("pino");

// 根據環境決定 logger 配置
if (process.env.NODE_ENV === "production") {
  const logger = pino({
    level: "info", // 生產環境：只記錄重要資訊
    timestamp: pino.stdTimeFunctions.isoTime,
  });
} else {
  const logger = pino({
    level: "debug", // 開發環境：記錄更多詳細資訊
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  });
}

module.exports = logger;
