//logger套件
const pinoHttp = require("pino-http");
const logger = pinoHttp();

const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET;

//產生Error物件(錯誤狀態碼、錯誤訊息)
function generateError(statusCode, message) {
  const error = new Error(message || "驗證出現錯誤");
  error.status = statusCode;
  return error;
}

//解碼token
function verifyJWT(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (error, decoded) => {
      if (error) {
        reject(generateError(401, "請先登入"));
      } else {
        resolve(decoded); // 驗證成功：回傳token解碼後的payload資訊（id、role）
      }
    });
  });
}

module.exports = async (req, res, next) => {
  if (!secret || typeof secret !== "string") {
    logger.error("[Auth] JWT secret 不存在或格式錯誤！");
  }
  // 檢查 request header 是否有帶上 authorization 欄位
  if (
    !req.headers ||
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer")
  ) {
    logger.warn("[Auth] Authorization header 遺失或格式錯誤");
    return next(generateError(401, "請先登入"));
  }
  // 解析 header 中的 token
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    logger.warn("[Auth] Token 不存在");
    return next(generateError(401, "請先登入"));
  }
  try {
    //如果token有效，解出payload資訊，並回傳使用者身分（學生/教練/管理員）
    const payload = await verifyJWT(token, secret);

    //檢查payload資訊中的role對應身分
    const AppDataSource = require("../db/data-source");
    const User = require("../entities/User");
    const Coach = require("../entities/Coach");
    const Admin = require("../entities/Admin");
    let repository;
    switch (payload.role) {
      case "USER":
        repository = AppDataSource.getRepository(User);
        break;
      case "COACH":
        repository = AppDataSource.getRepository(Coach);
        break;
      case "ADMIN":
        repository = AppDataSource.getRepository(Admin);
        break;
      default:
        logger.warn("[Auth] 角色資訊無效");
        return next(generateError(401, "請先登入"));
    }
    // 根據token解出的id，去資料庫找對應的user（學生/教練/管理員）
    const user = await repository.findOneBy({ id: payload.id });
    if (!user) {
      logger.warn(`[Auth] 找不到使用者 ID: ${payload.id}`);
      return next(generateError(401, "請先登入"));
    }
    //回傳使用者資訊
    req.user = {
      id: payload.id,
      role: payload.role,
      name: user.name,
      profile_image_url: user.profile_image_url,
    };
    next();
  } catch (error) {
    logger.error(`[Auth] ${req.method} ${req.url}`, error);
    next(error);
  }
};
