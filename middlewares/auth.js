const logger = require("../config/logger");
const secret = process.env.JWT_SECRET;
const generateError = require("../utils/generateError");
const { verifyJWT } = require("../utils/jwtUtils");
const { checkHasTrial, checkActiveSubscription } = require("../services/checkServices");
const AppDataSource = require("../db/data-source");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
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
    const userId = payload.id;
    const role = payload.role;

    //檢查payload資訊中的role對應身分
    const AppDataSource = require("../db/data-source");
    const User = require("../entities/User");
    const Coach = require("../entities/Coach");
    const Admin = require("../entities/Admin");

    let repository;
    switch (role) {
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
    const user = await repository.findOneBy({ id: userId });
    if (!user) {
      logger.warn(`[Auth] 找不到使用者 ID: ${userId}`);
      return next(generateError(401, "請先登入"));
    }

    // 根據角色設定displayName
    let displayName;
    switch (role) {
      case "USER":
        displayName = user.name;
        break;
      case "COACH":
        displayName = user.nickname;
        break;
      case "ADMIN":
        displayName = user.email.split("@")[0];
        break;
      default:
        logger.warn("[Auth] 角色資訊無效");
        return next(generateError(401, "請先登入"));
    }

    //判斷此人是否有試用資格
    const hasTrial = await checkHasTrial(userId);
    //判斷此人最新一筆訂閱是否仍有效
    const hasActiveSubscription = await checkActiveSubscription(userId);
    //設定要回傳的使用者資料內容
    if (role === "COACH") {
      const coachSkillData = await coachSkillRepo.find({
        where: { coach_id: userId },
        relations: ["Skill"],
      });
      const coachSkills = [];
      if (coachSkillData.length > 0) {
        coachSkillData.map((cs) => coachSkills.push(cs.Skill.name));
      }
      req.user = {
        id: userId, //id
        role: role, //角色
        displayName: displayName, //顯示名稱
        is_verified: user.is_verified, //是否已驗證
        skills: coachSkills, //教練技能
      };
    } else if (role === "ADMIN") {
      req.user = {
        id: userId, //id
        role: role, //角色
        displayName: displayName, //顯示名稱
      };
    } else {
      req.user = {
        id: userId, //id
        role: role, //角色
        displayName: displayName, //顯示名稱
        profile_image_url: user.profile_image_url || null, //大頭貼url
        is_verified: user.is_verified, //是否已驗證
        hasTrial: hasTrial, //是否有試用資格
        hasActiveSubscription: hasActiveSubscription, //最新訂閱是否有效
      };
    }
    next();
  } catch (error) {
    logger.error("[Auth]error:%s", error);
    next(error);
  }
};
